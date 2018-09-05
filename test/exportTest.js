/*
    The MIT License (MIT)

    Copyright 2017 - 2018, Alchemy Limited, LLC.

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

const assert = require('chai').assert
const ethjsABI = require('ethjs-abi')
const fs = require('fs')
const Parser = require('../lib/parser')
const Validator = require('../lib/validator')
const MerkleTreeJs = require('merkletreejs')
const crypto = require('crypto')
var ethBuyer1
var etcBuyer1
var eth
var etc

const initContracts = function () {
  return new Promise(async (resolve, reject) => {
    let config = fs.readFileSync('./config.json').toString()
    let chainPath = './abi/'
    let fileName = '/metronome.js'
    let metronome = {}
    let supportedChains = fs.readdirSync(chainPath)
    for (let i = 0; i < supportedChains.length; i++) {
      metronome[supportedChains[i]] = fs.readFileSync(chainPath + supportedChains[i] + fileName).toString()
    }
    // console.log('metronome', metronome)
    // console.log('config=', config)
    let configuration = Parser.parseConfig(config)
    // console.log('configuration=', configuration)
    let metronomeContracts = Parser.parseMetronome(metronome)
    // console.log('metronomeContracts=', metronomeContracts)
    // create validator object
    eth = new Validator(configuration.eth, metronomeContracts.eth)
    etc = new Validator(configuration.etc, metronomeContracts.etc)
    ethBuyer1 = eth.web3.personal.newAccount('password')
    etcBuyer1 = etc.web3.personal.newAccount('password')
    await eth.web3.personal.unlockAccount(ethBuyer1, 'password')
    await eth.web3.eth.sendTransaction({to: ethBuyer1, from: eth.web3.eth.accounts[0], value: 2e18})
    // send some ether for gas cost
    await etc.web3.eth.sendTransaction({to: etcBuyer1, from: etc.web3.eth.accounts[0], value: 2e18})

    await eth.web3.personal.unlockAccount(ethBuyer1, 'password')
    let balance = await eth.web3.eth.getBalance(ethBuyer1)
    console.log('Balance of ethBuyer1 ', balance)
    await eth.web3.eth.sendTransaction({to: eth.auctions.address, from: ethBuyer1, value: 1e16})
    var metTokenBalance = await eth.metToken.balanceOf(ethBuyer1)
    assert(metTokenBalance.toNumber() > 0, 'Exporter has no MET token balance')
    let owner = await eth.tokenPorter.owner()
    await eth.web3.personal.unlockAccount(owner, 'newOwner')
    var tokenAddress = eth.tokenPorter.token()
    await eth.tokenPorter.addDestinationChain('ETC', tokenAddress, {from: owner})
    owner = await etc.tokenPorter.owner()
    await etc.web3.personal.unlockAccount(owner, 'newOwner')
    tokenAddress = await etc.tokenPorter.token()
    await etc.tokenPorter.addDestinationChain('ETH', tokenAddress, {from: owner})
    resolve()
  })
}

function sha256 (data) {
  // returns Buffer
  return crypto.createHash('sha256').update(data).digest()
}

async function prepareImportData (sourceChain, logExportReceipt) {
  var burnHashes = []
  var i = 0
  if (logExportReceipt.burnSequence > 16) {
    i = logExportReceipt.burnSequence - 15
  }
  while (i <= logExportReceipt.burnSequence) {
    burnHashes.push(await sourceChain.tokenPorter.exportedBurns(i))
    i++
  }
  const leaves = burnHashes.map(x => Buffer.from(x.slice(2), 'hex'))

  const tree = new MerkleTreeJs(leaves, sha256)
  var buffer = tree.getProof(leaves[leaves.length - 1])
  let merkleProof = []
  for (let i = 0; i < buffer.length; i++) {
    merkleProof.push('0x' + ((buffer[i].data).toString('hex')))
  }
  return {
    addresses: [logExportReceipt.destinationMetronomeAddr, logExportReceipt.destinationRecipientAddr],
    burnHashes: [logExportReceipt.prevBurnHash, logExportReceipt.currentBurnHash],
    importData: [logExportReceipt.blockTimestamp, logExportReceipt.amountToBurn, logExportReceipt.fee,
      logExportReceipt.currentTick, logExportReceipt.genesisTime, logExportReceipt.dailyMintable,
      logExportReceipt.burnSequence, logExportReceipt.dailyAuctionStartTime],
    merkelProof: merkleProof,
    root: '0x' + (tree.getRoot()).toString('hex'),
    extraData: logExportReceipt.extraData
  }
}

before(async () => {
  await initContracts()
})

describe('cross chain testing', () => {
  it('Export test 1. Buy token and export to ETC', () => {
    return new Promise(async (resolve, reject) => {
      eth.web3.personal.unlockAccount(ethBuyer1, 'password')
      var amount = eth.metToken.balanceOf(ethBuyer1)
      var extraData = 'D'
      var totalSupplybefore = await eth.metToken.totalSupply()
      var tx = await eth.metToken.export(
        eth.web3.fromAscii('ETC'),
        etc.metToken.address,
        etcBuyer1,
        amount.valueOf(),
        0,
        eth.web3.fromAscii(extraData),
        { from: ethBuyer1 })
      var totalSupplyAfter = eth.metToken.totalSupply()
      let receipt = eth.web3.eth.getTransactionReceipt(tx)
      const decoder = ethjsABI.logDecoder(eth.tokenPorter.abi)
      const logExportReceipt = decoder(receipt.logs)[0]
      assert(totalSupplybefore.sub(totalSupplyAfter), amount, 'Export from ETH failed')
      let importDataObj = await prepareImportData(eth, logExportReceipt)
      // Todo call import funciton
      resolve()
    })
  })
})