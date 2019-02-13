/*
    The MIT License (MIT)

    Copyright 2018 - 2019, Autonomous Software.

    Permission is hereby granted, free of charge, to any person obtaining
    a copy of this software and associated documentation files (the
    "Software"), to deal in the Software without restriction, including
    without limitation the rights to use, copy, modify, merge, publish,
    distribute, sublicense, and/or sell copies of the Software, and to
    permit persons to whom the Software is furnished to do so, subject to
    the following conditions:

    The above copyright notice and this permission notice shall be included
    in all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
    OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
    MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
    IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
    CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
    TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
    SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

const ethers = require('ethers')
const MerkleTreeJs = require('merkletreejs')
const crypto = require('crypto')
const reader = require('../lib/file-reader')
const parser = require('../lib/parser')
const Chain = require('../lib/chain')
require('dotenv').config({path: 'validator.env'})
var config
// create contract object from abi
function initContracts () {
  return new Promise(async (resolve, reject) => {
    let ethChain, etcChain
    var config = createConfigObj()
    let metronome = reader.readMetronome()
    let metronomeContracts = parser.parseMetronome(metronome)
    // create chain object to get contracts
    ethChain = new Chain(config.eth, metronomeContracts.eth)
    etcChain = new Chain(config.etc, metronomeContracts.etc)
    resolve({
      ETH: ethChain,
      ETC: etcChain
    })
  })
}

function createConfigObj () {
  config = { eth: {}, etc: {}, qtum: {} }
  config.eth.chainName = 'ETH'
  config.eth.httpURL = process.env.eth_http_url
  config.eth.wsURL = process.env.eth_ws_url
  config.eth.address = process.env.eth_validator_address
  config.eth.password = process.env.eth_validator_password

  config.etc.chainName = 'ETC'
  config.etc.httpURL = process.env.etc_http_url
  config.etc.wsURL = process.env.etc_ws_url
  config.etc.address = process.env.etc_validator_address
  config.etc.password = process.env.etc_validator_password

  config.qtum.chainName = 'QTUM'
  config.qtum.httpURL = process.env.qtum_http_url
  config.qtum.wsURL = process.env.qtum_ws_url
  config.qtum.address = process.env.qtum_validator_address
  config.qtum.password = process.env.qtum_validator_password
  return config
}

// Create account and send some ether in it
async function setupAccount (web3) {
  // let accounts = await web3.eth.getAccounts()
  let user = await web3.eth.personal.newAccount('password')
  await web3.eth.personal.unlockAccount(config.etc.address, config.etc.password)
  await web3.eth.sendTransaction({
    to: user,
    from: config.etc.address,
    value: 2e18
  })
  return user
}

// Configure chain: Add destination chain and add validators
async function configureChain (chain, destChain) {
  let destChainName = chain.web3.utils.toHex(destChain.name)
  let destinationChain = await chain.contracts.tokenPorter.methods
    .destinationChains(destChainName)
    .call()
    .catch(error => {
      console.log(error)
    })
  let owner = await chain.contracts.tokenPorter.methods.owner().call()
  await chain.web3.eth.personal.unlockAccount(owner, '')
  if (destinationChain === '0x0000000000000000000000000000000000000000') {
    var destTokanAddress = destChain.contracts.metToken.options.address
    await chain.contracts.tokenPorter.methods
      .addDestinationChain(destChainName, destTokanAddress)
      .send({ from: owner })
  }
}

// Prepare import data using export receipt
async function prepareImportData (chain, options) {
  let burnHashes = []
  let i = 0
  var logExportReceipt = await chain.contracts.tokenPorter.getPastEvents('LogExportReceipt', options)
  const returnValues = logExportReceipt[0].returnValues

  if (returnValues.burnSequence > 15) {
    i = returnValues.burnSequence - 15
  }
  while (i <= returnValues.burnSequence) {
    burnHashes.push(
      await chain.contracts.tokenPorter.methods.exportedBurns(i).call()
    )
    i++
  }
  let genesisTime = await chain.contracts.auctions.methods.genesisTime().call()
  let dailyAuctionStartTime = await chain.contracts.auctions.methods.dailyAuctionStartTime().call()
  return {
    addresses: [
      returnValues.destinationMetronomeAddr,
      returnValues.destinationRecipientAddr
    ],
    burnHashes: [returnValues.prevBurnHash, returnValues.currentBurnHash],
    importData: [
      ethers.utils.bigNumberify(returnValues.blockTimestamp),
      ethers.utils.bigNumberify(returnValues.amountToBurn),
      ethers.utils.bigNumberify(returnValues.fee),
      ethers.utils.bigNumberify(returnValues.currentTick),
      ethers.utils.bigNumberify(genesisTime),
      ethers.utils.bigNumberify(returnValues.dailyMintable),
      ethers.utils.bigNumberify(returnValues.burnSequence),
      ethers.utils.bigNumberify(dailyAuctionStartTime)
    ],
    root: getMerkleRoot(burnHashes),
    extraData: returnValues.extraData,
    supplyOnAllChains: returnValues.supplyOnAllChains,
    destinationChain: returnValues.destinationChain
  }
}

async function mineBlocks (chain, count, recepient) {
  for (let i = 0; i < count; i++) {
    await chain.web3.eth.sendTransaction({
      to: recepient,
      from: recepient,
      value: 10
    })
  }
}

async function getMET (chain, recepient) {
  let metBalance = await chain.contracts.metToken.methods
    .balanceOf(recepient)
    .call()
  metBalance = ethers.utils.bigNumberify(metBalance)
  if (metBalance.gt(ethers.utils.bigNumberify('1000000000000000'))) {
    return
  }
  var web3 = chain.web3
  let mintable = await chain.contracts.auctions.methods
    .mintable()
    .call()
  mintable = ethers.utils.bigNumberify(mintable)
  if (mintable.gt(ethers.utils.bigNumberify('10000000000000000000'))) {
    await web3.eth.sendTransaction({
      to: chain.contracts.auctions.options.address,
      from: recepient,
      value: 2e14
    })
    return
  }
  await chain.contracts.autonomousConverter.methods
    .convertEthToMet(1)
    .send({ from: recepient, value: 1e16 })
}

// Calculate merkle root for given hashes
function getMerkleRoot (hashes) {
  const leaves = hashes.map(x => Buffer.from(x.slice(2), 'hex'))
  const tree = new MerkleTreeJs(leaves, data => {
    return crypto
      .createHash('sha256')
      .update(data)
      .digest()
  })
  return '0x' + tree.getRoot().toString('hex')
}

module.exports = { initContracts, prepareImportData, getMET, mineBlocks }
