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

var ethBuyer = process.env.eth_validator_address
var ethPassword = process.env.eth_validator_password

var ethChain, qChain, chains

before(async () => {
  chains = await util.initContracts()
  ethChain = chains.ETH
  qChain = chains.qtum
})

describe('Chain hop test cases- ETH to QTUM', () => {
  var metBalance
  var receipt = ''
  var fee = ethers.utils.bigNumberify(2e14)
  var amount = ethers.utils.bigNumberify(4e14)
  var extraData = 'D'

  before(async () => {
    await util.getMET(ethChain, ethBuyer)
    metBalance = await ethChain.contracts.metToken.methods
      .balanceOf(ethBuyer)
      .call()
    assert(metBalance > 0, 'Exporter has no MET token balance')
    metBalance = ethers.utils.bigNumberify(metBalance)
  })

  beforeEach(async () => {
    ethChain.web3.eth.personal.unlockAccount(ethBuyer, ethPassword)
  })

  it('Test case 1: Should be able to export from eth', () => {
    return new Promise(async (resolve, reject) => {
      let recepient = await qChain.qtum.rawCall('gethexaddress', [process.env.qtum_validator_address])
      recepient = '0x' + recepient
      let totalSupplybefore = await ethChain.contracts.metToken.methods
        .totalSupply()
        .call()
      totalSupplybefore = ethers.utils.bigNumberify(totalSupplybefore)
      try {
        receipt = await ethChain.contracts.metToken.methods.export(
          ethChain.web3.utils.toHex('qtum'),
          qChain.contracts.metToken.info.address,
          recepient,
          amount,
          fee,
          ethChain.web3.utils.toHex(extraData)
        ).send({ from: ethBuyer })
      } catch (error) {
        console.log('error', error)
        return reject(error)
      }

      let totalSupplyAfter = await ethChain.contracts.metToken.methods.totalSupply().call()
      totalSupplyAfter = ethers.utils.bigNumberify(totalSupplyAfter)
      amount = ethers.utils.bigNumberify(ethChain.web3.utils.toHex(amount))
      fee = ethers.utils.bigNumberify(ethChain.web3.utils.toHex(fee))
      assert(totalSupplybefore.sub(totalSupplyAfter).eq(amount.add(fee)),
        'Export from ETH failed'
      )
      resolve()
    })
  })

  it('Test case 2: Should be able to submit import request in qtum', () => {
    return new Promise(async (resolve, reject) => {
      // var burnHash = '0x6b906747a7bf888e5ff8e89f9a08e4aee450d57df46300e370a0e13ef48c2840'
      var burnSequence = await ethChain.contracts.tokenPorter.methods.burnSequence().call()
      var burnHash = await ethChain.contracts.tokenPorter.methods.exportedBurns(burnSequence - 1).call()
      var filter = { currentBurnHash: burnHash }
      var options = { filter, fromBlock: 0, toBlock: 'latest' }
      let importDataObj = await util.prepareImportData(ethChain, options)
      try {
        await qChain.send(qChain.contracts.metToken, 'importMET', [
          ethChain.web3.utils.toHex('ETH'),
          importDataObj.destinationChain,
          importDataObj.addresses,
          importDataObj.extraData,
          importDataObj.burnHashes,
          importDataObj.supplyOnAllChains,
          importDataObj.importData,
          importDataObj.root]
        )
        let root = await qChain.call(qChain.contracts.tokenPorter, 'merkleRoots', [importDataObj.burnHashes[1]])
        root = '0x' + root
        assert.equal(root, importDataObj.root, 'Import request is failed')
        resolve()
      } catch (error) {
        return reject(error)
      }
    })
  })

  it('Test case 3: Validators should be able to validate and attest export receipt in qtum', () => {
    return new Promise(async (resolve, reject) => {
      var validator = new Validator(chains, qChain)
      // var burnHash = '0x6b906747a7bf888e5ff8e89f9a08e4aee450d57df46300e370a0e13ef48c2840'
      var burnSequence = await ethChain.contracts.tokenPorter.methods.burnSequence().call()
      var burnHash = await ethChain.contracts.tokenPorter.methods.exportedBurns(burnSequence - 1).call()
      var filter = { currentBurnHash: burnHash }
      var options = { filter, fromBlock: 0, toBlock: 'latest' }
      var logExportReceipt = await ethChain.getPastExportReceipts(options)
      const returnValues = logExportReceipt[0].returnValues
      let originChain = 'ETH'
      let response = await validator.validateHash(originChain, returnValues.currentBurnHash)
      assert(response.hashExist, 'Validations failed')
      let attstBefore = await qChain.call(qChain.contracts.validator, 'attestationCount', [returnValues.currentBurnHash])
      let balanceBefore = await qChain.call(qChain.contracts.metToken, 'balanceOf', [returnValues.destinationRecipientAddr])
      await validator.attestHash(originChain, returnValues)
      let attstAfter = await qChain.call(qChain.contracts.validator, 'attestationCount', [returnValues.currentBurnHash])
      assert(attstAfter, attstBefore + 1, 'attestation failed')
      let threshold = await qChain.call(qChain.contracts.validator, 'threshold')
      if (threshold.toString() === '1') {
        let hashClaimed = await qChain.call(qChain.contracts.validator, 'hashClaimed', [returnValues.currentBurnHash])
        assert(hashClaimed, 'Minting failed after attestation')
        let balanceAfter = await qChain.call(qChain.contracts.metToken, 'balanceOf', [returnValues.destinationRecipientAddr])
        balanceAfter = ethers.utils.bigNumberify(balanceAfter.toString())
        balanceBefore = ethers.utils.bigNumberify(balanceBefore.toString())
        assert(balanceAfter.eq(balanceBefore.add(amount.add(fee))))
      }
      resolve()
    })
  })
})
