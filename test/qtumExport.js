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
const assert = require('chai').assert
const ethers = require('ethers')
const util = require('./testUtil')
const Validator = require('../lib/validator')
require('dotenv').config()

var recepient = process.env.eth_validator_address
var password = process.env.eth_validator_password
var exporter = process.env.qtum_validator_address
var exporterHexAddress

var ethChain, qChain, chains

before(async () => {
  chains = await util.initContracts()
  ethChain = chains.ETH
  qChain = chains.qtum
  exporterHexAddress = await qChain.qtum.rawCall('gethexaddress', [exporter])
})

describe('Chain hop test cases. QTUM to ETH', () => {
  var metBalance
  var receipt = ''
  var fee = ethers.utils.bigNumberify(2e14)
  var amount = ethers.utils.bigNumberify(4e14)
  var extraData = 'D'

  before(async () => {
    metBalance = await qChain.call(qChain.contracts.metToken, 'balanceOf', [ exporterHexAddress ])
    assert(metBalance > 0, 'Exporter has no MET token balance')
    metBalance = ethers.utils.bigNumberify(metBalance.toString())
  })

  beforeEach(async () => {
    ethChain.web3.eth.personal.unlockAccount(recepient, password)
  })

  it('Test case 1: Should be able to export from qtum', () => {
    return new Promise(async (resolve, reject) => {
      let totalSupplybefore = await qChain.call(qChain.contracts.metToken, 'totalSupply')
      totalSupplybefore = ethers.utils.bigNumberify(totalSupplybefore.toString())
      try {
        fee = ethers.utils.bigNumberify(1e14)
        amount = ethers.utils.bigNumberify(2e14)
        receipt = await qChain.send(qChain.contracts.metToken, 'export', [ethChain.web3.utils.toHex('ETH'),
          ethChain.contracts.metToken.options.address,
          recepient,
          amount,
          fee,
          ethChain.web3.utils.toHex(extraData)], { from: exporter })
      } catch (error) {
        console.log('error', error)
        return reject(error)
      }
      let totalSupplyAfter = await qChain.call(qChain.contracts.metToken, 'totalSupply')
      totalSupplyAfter = ethers.utils.bigNumberify(totalSupplyAfter.toString())
      amount = ethers.utils.bigNumberify(ethChain.web3.utils.toHex(amount))
      fee = ethers.utils.bigNumberify(ethChain.web3.utils.toHex(fee))
      assert(totalSupplybefore.sub(totalSupplyAfter).eq(amount.add(fee)),
        'Export from qtum failed'
      )
      resolve()
    })
  })

  it('Test case 2: Should be able to submit import request in eth chain', () => {
    return new Promise(async (resolve, reject) => {
      var burnSequence = await qChain.call(qChain.contracts.tokenPorter, 'burnSequence')
      var burnHash = await qChain.call(qChain.contracts.tokenPorter, 'exportedBurns', [burnSequence - 1])
      var filter = { currentBurnHash: burnHash }
      var options = { filter, fromBlock: 0, toBlock: 'latest' }
      let importDataObj = await util.prepareImportData(qChain, options)
      try {
        await ethChain.contracts.metToken.methods.importMET(
          ethChain.web3.utils.toHex('qtum'),
          importDataObj.destinationChain,
          importDataObj.addresses,
          importDataObj.extraData,
          importDataObj.burnHashes,
          importDataObj.supplyOnAllChains,
          importDataObj.importData,
          importDataObj.root
        ).send({ from: recepient })
        let root = await ethChain.contracts.tokenPorter.methods.merkleRoots(importDataObj.burnHashes[1]).call()
        assert.equal(root, importDataObj.root, 'Import request is failed')
        resolve()
      } catch (error) {
        return reject(error)
      }
    })
  })

  it('Test case 3: Validator should be able to validate and attest export receipt', () => {
    return new Promise(async (resolve, reject) => {
      var validator = new Validator(chains, ethChain)
      var burnSequence = await qChain.call(qChain.contracts.tokenPorter, 'burnSequence')
      var burnHash = await qChain.call(qChain.contracts.tokenPorter, 'exportedBurns', [burnSequence - 1])
      var filter = { currentBurnHash: burnHash }
      var options = { filter, fromBlock: 0, toBlock: 'latest' }
      var logExportReceipt = await qChain.getPastExportReceipts(options)
      const returnValues = logExportReceipt[0].returnValues
      let originChain = 'qtum'
      let response = await validator.validateHash(originChain, returnValues.currentBurnHash)
      assert(response.hashExist, 'Validations failed')
      let attstBefore = await ethChain.contracts.validator.methods.attestationCount(returnValues.currentBurnHash).call()
      let balanceBefore = await ethChain.contracts.metToken.methods
        .balanceOf(returnValues.destinationRecipientAddr)
        .call()
      await validator.attestHash(originChain, returnValues)
      let attstAfter = await ethChain.contracts.validator.methods.attestationCount(returnValues.currentBurnHash).call()
      assert(attstAfter, attstBefore + 1, 'attestation failed')

      let threshold = await ethChain.contracts.validator.methods.threshold().call()
      if (threshold === 1) {
        let hashClaimed = await qChain.contracts.validator.methods.hashClaimed(returnValues.currentBurnHash).call()
        assert(hashClaimed, 'Minting failed after attestation')
        let balanceAfter = await ethChain.contracts.metToken.methods
          .balanceOf(returnValues.destinationRecipientAddr)
          .call()
        balanceAfter = ethers.utils.bigNumberify(balanceAfter)
        balanceBefore = ethers.utils.bigNumberify(balanceBefore)
        assert(balanceAfter.eq(balanceBefore.add(amount)))
      }
      resolve()
    })
  })
})
