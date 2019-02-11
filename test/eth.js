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
var etcBuyer = process.env.eth_validator_address
var etcPassword = process.env.eth_validator_password
var chains
var ethChain, etcChain

before(async () => {
  chains = await util.initContracts()
  ethChain = chains.ETH
  etcChain = chains.ETC
})

describe('Export test. ETH to ETC', () => {
  var metBalance
  var receipt = ''
  var fee = ethers.utils.bigNumberify(2e14)
  var amount = ethers.utils.bigNumberify(1e14)
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
    await ethChain.web3.eth.personal.unlockAccount(ethBuyer, ethPassword)
    await etcChain.web3.eth.personal.unlockAccount(etcBuyer, etcPassword)
  })

  it('Should be able to export from eth', () => {
    return new Promise(async (resolve, reject) => {
      let totalSupplybefore = await ethChain.contracts.metToken.methods
        .totalSupply()
        .call()
      totalSupplybefore = ethers.utils.bigNumberify(totalSupplybefore)
      try {
        receipt = await ethChain.contracts.metToken.methods.export(
          ethChain.web3.utils.toHex('ETC'),
          etcChain.contracts.metToken.options.address,
          etcBuyer,
          amount,
          fee,
          ethChain.web3.utils.toHex(extraData)
        ).send({ from: ethBuyer })
      } catch (error) {
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

  it('Should be able to import in etc', () => {
    return new Promise(async (resolve, reject) => {
      var filter = {}
      // var burnHash = '0xa51675480858c4f492752ba63ba3a102da1400baca2c54ae3e6378767b74050f'
      // filter = { currentBurnHash: burnHash }
      // var options = { filter, fromBlock: '0', toBlock: 'latest' }
      var options = { filter, fromBlock: receipt.blockNumber, toBlock: receipt.blockNumber }
      let importDataObj = await util.prepareImportData(ethChain, options)
      try {
        await etcChain.contracts.metToken.methods.importMET(
          ethChain.web3.utils.toHex('ETH'),
          importDataObj.destinationChain,
          importDataObj.addresses,
          importDataObj.extraData,
          importDataObj.burnHashes,
          importDataObj.supplyOnAllChains,
          importDataObj.importData,
          importDataObj.root
        ).send({ from: etcBuyer })
        let root = await etcChain.contracts.tokenPorter.methods.merkleRoots(importDataObj.burnHashes[1]).call()
        assert.equal(root, importDataObj.root, 'Import request is failed')
        resolve()
      } catch (error) {
        return reject(error)
      }
    })
  })

  it('Should be able to validate and attest export receipt', () => {
    return new Promise(async (resolve, reject) => {
      var validator = new Validator(chains, etcChain)
      var filter = {}
      var options = { filter, fromBlock: receipt.blockNumber, toBlock: receipt.blockNumber }
      var logExportReceipt = await ethChain.getPastExportReceipts(options)
      const returnValues = logExportReceipt[0].returnValues
      let originChain = 'ETH'
      let response = await validator.validateHash(originChain, returnValues.currentBurnHash)
      assert(response.hashExist, 'Validations failed')
      let attstBefore = await etcChain.contracts.validator.methods.attestationCount(returnValues.currentBurnHash).call()
      let balanceBefore = await ethChain.contracts.metToken.methods
        .balanceOf(returnValues.destinationRecipientAddr)
        .call()
      await validator.attestHash(originChain, returnValues)
      let attstAfter = await etcChain.contracts.validator.methods.attestationCount(returnValues.currentBurnHash).call()
      assert(attstAfter, attstBefore + 1, 'attestation failed')

      let threshold = await etcChain.contracts.validator.methods.threshold().call()
      if (threshold === 1) {
        let hashClaimed = await etcChain.contracts.validator.methods.hashClaimed(returnValues.currentBurnHash).call()
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
