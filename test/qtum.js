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
const _ = require('lodash')
const fs = require('fs')
const ethers = require('ethers')
const util = require('./testUtil')
require('dotenv').config()

var ethBuyer = process.env.eth_validator_address
var ethPassword = process.env.eth_validator_password
var etcBuyer = process.env.etc_validator_address
var etcPassword = process.env.etc_validator_password

var ethChain, etcChain, qChain

async function validateMinting (
  chain,
  recipient,
  expectedTotalSupply,
  expectedBalanceOfRecepient
) {
  let currentTotalSupply = await chain.contracts.metToken.methods
    .totalSupply()
    .call()
  currentTotalSupply = ethers.utils.bigNumberify(
    ethChain.web3.utils.toHex(currentTotalSupply)
  )
  var diff = expectedTotalSupply.sub(currentTotalSupply)
  assert.closeTo(diff.toNumber(), 0, 3, 'Total supply is wrong after import')
  let balanceOfRecepient = await chain.contracts.metToken.methods
    .balanceOf(recipient)
    .call()
  assert.equal(
    balanceOfRecepient,
    expectedBalanceOfRecepient.toString(10),
    'Balance of recepient wrong after import'
  )
}

const getDataForImport = _.memoize(function () {
  return fs.readFileSync('import-data.json').toString()
})

before(async () => {
  const response = await util.initContracts()
  ethChain = response.ethChain
  etcChain = response.etcChain
  qChain = response.qChain
})

describe('cross chain testing', () => {
  beforeEach(async () => {
    console.log('unlocking account')
    ethChain.web3.eth.personal.unlockAccount(ethBuyer, ethPassword)
    etcChain.web3.eth.personal.unlockAccount(etcBuyer, etcPassword)
    console.log('unlocked')
  })

  it('Export test 1. ETH to QTUM', () => {
    return new Promise(async (resolve, reject) => {
      let flatFee = ethers.utils.bigNumberify(10e12)
      let feePerTenThousand = 1
      var receipt = ''
      // Buy some MET
      console.log('getting MET')
      await util.getMET(ethChain, ethBuyer)
      let metBalance = await ethChain.contracts.metToken.methods
        .balanceOf(ethBuyer)
        .call()
      assert(metBalance > 0, 'Exporter has no MET token balance')
      metBalance = ethers.utils.bigNumberify(metBalance)
      let fee = metBalance.div(2)
      let amount = metBalance.sub(fee)
      assert(
        metBalance.eq(amount.add(fee)),
        'Total of amount and fee should be equal to metBalance'
      )
      assert(fee.gt(flatFee), 'Fee should be greater than defined flatFee')
      assert(
        fee.gt(amount.mul(feePerTenThousand).div(10000)),
        'Fee should be greater than defined fee'
      )
      let extraData = 'D'
      let totalSupplybefore = await ethChain.contracts.metToken.methods
        .totalSupply()
        .call()
      totalSupplybefore = ethers.utils.bigNumberify(totalSupplybefore)
      try {
        console.log('exporting - test 1')
        // amount = 9114360669749024
        receipt = await ethChain.contracts.metToken.methods
          .export(
            ethChain.web3.utils.toHex('qtum'),
            qChain.contracts.metToken.info.address,
            '0x40d82e9094c1599661a48c9db149d63d31f110ff',
            amount,
            fee,
            ethChain.web3.utils.toHex(extraData)
          )
          .send({ from: ethBuyer })
      } catch (error) {
        return reject(error)
      }

      let totalSupplyAfter = await ethChain.contracts.metToken.methods
        .totalSupply()
        .call()
      totalSupplyAfter = ethers.utils.bigNumberify(totalSupplyAfter)
      amount = ethers.utils.bigNumberify(ethChain.web3.utils.toHex(amount))
      fee = ethers.utils.bigNumberify(ethChain.web3.utils.toHex(fee))
      assert(
        totalSupplybefore.sub(totalSupplyAfter).eq(amount.add(fee)),
        'Export from ETH failed'
      )
      console.log('preparing import data')
      console.log('Auctions address', qChain.contracts.auctions.info.address)
      console.log('MET address', qChain.contracts.metToken.info.address)
      var burnHash = '0xacbbdfb8837a710e548fe6cd63ba4e1592a6ca526f23b322cec3cc62e872151c'
      console.log('receipt=', receipt)
      let importDataObj = await util.prepareImportData(ethChain, burnHash, null)
      console.log('importDataObj', importDataObj)
      let qtumTotalSupply = (await qChain.contracts.metToken.call('totalSupply')).outputs[0].toString()
      qtumTotalSupply = ethers.utils.bigNumberify(qtumTotalSupply)
      let expectedTotalSupply = qtumTotalSupply.add(importDataObj.importData[1]).add(importDataObj.importData[2])
      var qBalance = (await qChain.contracts.metToken.call('balanceOf', ['0x40d82e9094c1599661a48c9db149d63d31f110ff'])).outputs[0].toString()
      qBalance = ethers.utils.bigNumberify(ethChain.web3.utils.toHex(qBalance))
      let expectedBalanceOfRecepient = qBalance.add(importDataObj.importData[1])
      console.log('importing in qtum - test 1')
      try {
        console.log('import sequence', (await qChain.contracts.tokenPorter.call('importSequence')).outputs[0].toString())
        let tx = await qChain.contracts.metToken.send('importMET', [
          ethChain.web3.utils.toHex('ETH'),
          importDataObj.destinationChain,
          importDataObj.addresses,
          importDataObj.extraData,
          importDataObj.burnHashes,
          importDataObj.supplyOnAllChains,
          importDataObj.importData,
          importDataObj.root]
        )
        console.log('tx', tx)
        await tx.confirm(1)
        console.log('import sequence', (await qChain.contracts.tokenPorter.call('importSequence')).outputs[0].toString())
        resolve()
      } catch (error) {
        return reject(error)
      }
      // wait for minting to happen
      // var subs = etc.contracts.tokenPorter.events.LogImport(
      //   async (err, response) => {
      //     if (err) {
      //       console.log('export error', err)
      //     } else {
      //       console.log('Attestation done. Validating mint amount')
      //       if (
      //         importDataObj.burnHashes[1] === response.returnValues.currentHash
      //       ) {
      //         try {
      //           await subs.unsubscribe()
      //           await validateMinting(
      //             etc,
      //             etcBuyer1,
      //             expectedTotalSupply,
      //             expectedBalanceOfRecepient
      //           )
      //         } catch (e) {
      //           return reject(e)
      //         }
      //         resolve()
      //       }
      //     }
      //   }
      // )
    })
  })
})
