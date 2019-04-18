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
  ethChain = chains.eth
  qChain = chains.qtum
  // ethChain.web3.eth.personal.unlockAccount(ethBuyer, ethPassword)
  // let owner = await qChain.call(qChain.contracts.Validator, 'owner', [])
  var destinationChain = await ethChain.contracts.TokenPorter.methods.destinationChains('0x7174756d00000000').call()
  console.log('destinationChain', destinationChain)
  // await ethChain.contracts.TokenPorter.methods.addDestinationChain(ethChain.web3.utils.toHex('qtum'), qChain.contracts.METToken.info.address)
  //   .send({ from: ethBuyer })
  // let hexAddress = await qChain.qtum.rawCall('gethexaddress', [process.env.qtum_validator_address])
  // await qChain.send(qChain.contracts.Validator, 'addValidator', [hexAddress], { senderAddress: owner })
})

describe('Chain hop test cases- ETH to QTUM', () => {
  var metBalance
  var receipt = ''
  var fee = ethers.utils.bigNumberify(1e14)
  var amount = ethers.utils.bigNumberify(6e14)
  var extraData = 'D'

  before(async () => {
    await util.getMET(ethChain, ethBuyer)
    metBalance = await ethChain.contracts.METToken.methods
      .balanceOf(ethBuyer)
      .call()
    console.log('metBalance', metBalance.toString())
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
      console.log('qChain.contracts.METToken.info.address', qChain.contracts.METToken.info.address)
      let totalSupplybefore = await ethChain.contracts.METToken.methods
        .totalSupply()
        .call()
      totalSupplybefore = ethers.utils.bigNumberify(totalSupplybefore)
      try {
        receipt = await ethChain.contracts.METToken.methods.export(
          ethChain.web3.utils.toHex('qtum'),
          qChain.contracts.METToken.info.address,
          recepient,
          amount,
          fee,
          ethChain.web3.utils.toHex(extraData)
        ).send({ from: ethBuyer })
      } catch (error) {
        console.log('error', error)
        return reject(error)
      }

      let totalSupplyAfter = await ethChain.contracts.METToken.methods.totalSupply().call()
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
      // var burnHash = '0xffc1e6814d4c59b28b11441475cc4a3d276c89f57b16b5c6103a01fc727a19e2'
      var destChainAddres = await ethChain.contracts.TokenPorter.methods.destinationChains(ethChain.web3.utils.toHex('qtum')).call()
      console.log('destChainAddres', destChainAddres)
      console.log('eth tokenPorter', ethChain.contracts.TokenPorter.options.address)
      console.log('qchain met token address', qChain.contracts.METToken.info.address)
      var burnSequence = await ethChain.contracts.TokenPorter.methods.burnSequence().call()
      console.log('burnSequence', burnSequence)
      var burnHash = await ethChain.contracts.TokenPorter.methods.exportedBurns(burnSequence - 1).call()
      console.log('burnHash', burnHash)
      var filter = { currentBurnHash: burnHash }
      var options = { filter, fromBlock: 0, toBlock: 'latest' }
      let importDataObj = await util.prepareImportData(ethChain, options)
      console.log('importDataObj', importDataObj)
      try {
        var tx = await qChain.send(qChain.contracts.METToken, 'importMET', [
          ethChain.web3.utils.toHex('ETH'),
          importDataObj.destinationChain,
          importDataObj.addresses,
          importDataObj.extraData,
          importDataObj.burnHashes,
          importDataObj.supplyOnAllChains,
          importDataObj.importData,
          importDataObj.root],
        { gas: 38000000, from: process.env.qtum_validator_address }
        )
        console.log('tx', tx)
        let root = await qChain.call(qChain.contracts.TokenPorter, 'merkleRoots', [importDataObj.burnHashes[1]])
        root = '0x' + root
        console.log('root', root)
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
      console.log('tokenPorter', ethChain.contracts.TokenPorter.options.address)
      // var burnHash = '0x6b906747a7bf888e5ff8e89f9a08e4aee450d57df46300e370a0e13ef48c2840'
      console.log('currentAuction', await ethChain.contracts.Auctions.methods.currentAuction().call())
      console.log('genesisTime', await ethChain.contracts.Auctions.methods.genesisTime().call())
      console.log('initialAuctionEndTime', await ethChain.contracts.Auctions.methods.initialAuctionEndTime().call())
      var burnSequence = await ethChain.contracts.TokenPorter.methods.burnSequence().call()
      var burnHash = await ethChain.contracts.TokenPorter.methods.exportedBurns(burnSequence - 1).call()
      var filter = { currentBurnHash: burnHash }
      var options = { filter, fromBlock: 0, toBlock: 'latest' }
      var logExportReceipt = await ethChain.getPastExportReceipts(options)
      const returnValues = logExportReceipt[0].returnValues
      let originChain = 'ETH'
      let response = await validator.validateHash(originChain.toLowerCase(), returnValues.currentBurnHash)
      console.log('response', response)
      assert(response.hashExist, 'Validations failed')
      let attstBefore = await qChain.call(qChain.contracts.Validator, 'attestationCount', [returnValues.currentBurnHash])
      console.log('attstBefore', attstBefore)
      let balanceBefore = await qChain.call(qChain.contracts.METToken, 'balanceOf', [returnValues.destinationRecipientAddr])
      await validator.attestHash(originChain, returnValues)
      // await validator.refuteHash(burnHash, returnValues.destinationRecipientAddr)
      let attstAfter = await qChain.call(qChain.contracts.Validator, 'attestationCount', [returnValues.currentBurnHash])
      console.log('attstAfter', attstAfter)
      assert(attstAfter, attstBefore + 1, 'attestation failed')
      let threshold = await qChain.call(qChain.contracts.Validator, 'threshold')
      if (threshold.toString() === '1') {
        let hashClaimed = await qChain.call(qChain.contracts.Validator, 'hashClaimed', [returnValues.currentBurnHash])
        assert(hashClaimed, 'Minting failed after attestation')
        let balanceAfter = await qChain.call(qChain.contracts.METToken, 'balanceOf', [returnValues.destinationRecipientAddr])
        balanceAfter = ethers.utils.bigNumberify(balanceAfter.toString())
        balanceBefore = ethers.utils.bigNumberify(balanceBefore.toString())
        assert(balanceAfter.eq(balanceBefore.add(amount.add(fee))))
      }
      resolve()
    })
  })
})
