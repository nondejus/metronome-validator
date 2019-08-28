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
const MetronomeContracts = require('metronome-contracts')
const crypto = require('crypto')
const reader = require('../lib/file-reader')
const HDWalletProvider = require('truffle-hdwallet-provider')
const Chain = require('../lib/chain')
const QChain = require('../lib/qChain')
var config = require('config')
const constant = require('../lib/const')
const Web3 = require('web3')
require('dotenv').config()
// create contract object from abi
function initContracts () {
  return new Promise(async (resolve, reject) => {
    let ethChain, etcChain, qChain
    var config = createConfigObj()
    let metronomeContracts = reader.readMetronome()
    var web3 = new Web3(config.eth.httpURL)
    var wallet = await ethers.Wallet.fromMnemonic(config.eth.walletMnemonic)
    const account = web3.eth.accounts.privateKeyToAccount(wallet.signingKey.privateKey)
    web3.eth.accounts.wallet.add(account)
    web3.eth.defaultAccount = account.address
    ethChain = new Chain(config.eth)
    ethChain.createContractObj()
    ethChain.contracts = new MetronomeContracts(web3, config.eth.network)

    etcChain = new Chain(config.etc)
    etcChain.createContractObj()
    // var options = { timeout: 50000000, autoReconnect: true }
    var etcWeb3 = new Web3(new Web3.providers.HttpProvider(config.etc.httpURL))
    etcWeb3.eth.accounts.wallet.add(account)
    etcWeb3.eth.defaultAccount = account.address
    etcChain.contracts = new MetronomeContracts(etcWeb3, config.etc.network)
    qChain = new QChain(config.qtum, metronomeContracts.qtum, config.httpURL)
    qChain.createContractObj()
    resolve({
      eth: ethChain,
      qtum: qChain,
      etc: etcChain
    })
  })
}

function createConfigObj () {
  preareConfig('eth')
  preareConfig('etc')
  preareConfig('qtum')
  return config
}

function preareConfig (chain) {
  config[chain] = { ...config[chain], ...constant[chain] }
  config[chain].chainName = chain
  config[chain].httpURL = process.env[chain + '_http_url']
  config[chain].wsURL = process.env[chain + '_ws_url']
  config[chain].address = process.env[chain + '_validator_address']
  config[chain].password = process.env[chain + '_validator_password']
  config[chain].walletMnemonic = process.env[chain + '_walletMnemonic']
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
  var logExportReceipt = await chain.getPastExportReceipts(options)
  const returnValues = logExportReceipt[0].returnValues
  if (returnValues.burnSequence > 15) {
    i = returnValues.burnSequence - 15
  }
  while (i <= returnValues.burnSequence) {
    var burnHash = await chain.call(chain.contracts.TokenPorter, 'exportedBurns', [i])
    burnHash = burnHash.indexOf('0x') !== 0 ? '0x' + burnHash : burnHash
    burnHashes.push(burnHash)
    i++
  }
  let genesisTime = await chain.call(chain.contracts.Auctions, 'genesisTime')
  let dailyAuctionStartTime = await chain.call(chain.contracts.Auctions, 'dailyAuctionStartTime', [])
  return {
    addresses: [
      returnValues.destinationMetronomeAddr,
      returnValues.destinationRecipientAddr
    ],
    burnHashes: [returnValues.prevBurnHash, returnValues.currentBurnHash],
    importData: [
      ethers.utils.bigNumberify(returnValues.blockTimestamp.toString()),
      ethers.utils.bigNumberify(returnValues.amountToBurn.toString()),
      ethers.utils.bigNumberify(returnValues.fee.toString()),
      ethers.utils.bigNumberify(returnValues.currentTick.toString()),
      ethers.utils.bigNumberify(genesisTime.toString()),
      ethers.utils.bigNumberify(returnValues.dailyMintable.toString()),
      ethers.utils.bigNumberify(returnValues.burnSequence.toString()),
      ethers.utils.bigNumberify(dailyAuctionStartTime.toString())
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
  let metBalance = await chain.contracts.METToken.methods.balanceOf(recepient).call()
  metBalance = ethers.utils.bigNumberify(metBalance)
  if (metBalance.gt(ethers.utils.bigNumberify('1000000000000000'))) {
    return
  }
  var web3 = chain.web3
  let mintable = await chain.contracts.Auctions.methods
    .mintable()
    .call()
  mintable = ethers.utils.bigNumberify(mintable)
  if (mintable.gt(ethers.utils.bigNumberify('10000000000000000000'))) {
    await web3.eth.sendTransaction({
      to: chain.contracts.Auctions.options.address,
      from: recepient,
      value: 2e14
    })
    return
  }
  await chain.contracts.AutonomousConverter.methods
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
