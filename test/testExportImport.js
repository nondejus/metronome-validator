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
const _ = require('lodash')
const ethers = require('ethers')
const fs = require('fs')
const util = require('./testUtil')
const BN = require('bn.js')
const ethers = require('ethers')
var ethBuyer1
var etcBuyer1
var eth
var etc

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
    eth.web3.utils.toHex(currentTotalSupply)
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
  eth = response.ethChain
  ethBuyer1 = response.ethBuyer
  etc = response.etcChain
  etcBuyer1 = response.etcBuyer
})

after(() => {
  console.log('closing ws connection')
  eth.web3.currentProvider.connection.close()
  etc.web3.currentProvider.connection.close()
})

describe('cross chain testing', () => {
  beforeEach(async () => {
    eth.web3.eth.personal.unlockAccount(ethBuyer1, 'password')
    etc.web3.eth.personal.unlockAccount(etcBuyer1, 'password')
  })

  it('Export test 1. ETH to ETC', () => {
    return new Promise(async (resolve, reject) => {
      let flatFee = ethers.utils.bigNumberify(10e12)
      let feePerTenThousand = 1
      // Buy some MET
      await util.getMET(eth, ethBuyer1)
      // util.waitForTx(tx, eth.web3.eth)
      let metBalance = await eth.contracts.metToken.methods
        .balanceOf(ethBuyer1)
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
      // const calculatedFee = amount.mul(feePerTenThousand).div(10000)
      assert(
        fee.gt(amount.mul(feePerTenThousand).div(10000)),
        'Fee should be greater than defined fee'
      )
      let extraData = 'D'
      let totalSupplybefore = await eth.contracts.metToken.methods
        .totalSupply()
        .call()
      totalSupplybefore = ethers.utils.bigNumberify(totalSupplybefore)
      try {
        var receipt = ''
        console.log('exporting - test 1')
        // amount = 9114360669749024
        receipt = await eth.contracts.metToken.methods
          .export(
            eth.web3.utils.toHex('ETC'),
            etc.contracts.metToken.options.address,
            etcBuyer1,
            amount,
            fee,
            eth.web3.utils.toHex(extraData)
          )
          .send({ from: ethBuyer1 })
          .on('error', async error => {
            console.log('in error', error)
            reject(error)
          })
      } catch (e) {
        console.log('in catch', e)
        reject(e)
      }

      let totalSupplyAfter = await eth.contracts.metToken.methods
        .totalSupply()
        .call()
      totalSupplyAfter = ethers.utils.bigNumberify(totalSupplyAfter)
      amount = ethers.utils.bigNumberify(eth.web3.utils.toHex(amount))
      fee = ethers.utils.bigNumberify(eth.web3.utils.toHex(fee))
      assert(
        totalSupplybefore.sub(totalSupplyAfter).eq(amount.add(fee)),
        'Export from ETH failed'
      )
      console.log('preparing import data')
      let importDataObj = await util.prepareImportData(eth, receipt)
      let etcTotalSupply = await etc.contracts.metToken.methods
        .totalSupply()
        .call()
      etcTotalSupply = ethers.utils.bigNumberify(etcTotalSupply)
      // TODO: how to add (+) value returned from call() function
      let expectedTotalSupply = etcTotalSupply.add(amount).add(fee)
      var etcBalance = await etc.contracts.metToken.methods
        .balanceOf(etcBuyer1)
        .call()
      etcBalance = ethers.utils.bigNumberify(eth.web3.utils.toHex(etcBalance))
      let expectedBalanceOfRecepient = etcBalance.add(amount)
      console.log('importing - test 1')
      receipt = await etc.contracts.metToken.methods
        .importMET(
          eth.web3.utils.toHex('ETH'),
          importDataObj.destinationChain,
          importDataObj.addresses,
          importDataObj.extraData,
          importDataObj.burnHashes,
          importDataObj.supplyOnAllChains,
          importDataObj.importData,
          importDataObj.root
        )
        .send({ from: etcBuyer1 })
        .on('error', error => {
          reject(error)
        })
      // util.waitForTx(tx, etc.web3.eth)
      if (!receipt.status) {
        reject(new Error('importMET function reverted'))
      }
      // wait for minting to happen
      var subs = etc.contracts.tokenPorter.events.LogImport(
        async (err, response) => {
          if (err) {
            console.log('export error', err)
          } else {
            console.log('Attestation done. Validating mint amount')
            if (
              importDataObj.burnHashes[1] === response.returnValues.currentHash
            ) {
              try {
                await subs.unsubscribe()
                await validateMinting(
                  etc,
                  etcBuyer1,
                  expectedTotalSupply,
                  expectedBalanceOfRecepient
                )
              } catch (e) {
                reject(e)
              }
              resolve()
            }
          }
        }
      )
    })
  })

  it('Export test 2. ETC to ETH', () => {
    return new Promise(async (resolve, reject) => {
      let amount = await etc.contracts.metToken.methods
        .balanceOf(etcBuyer1)
        .call()
      assert(amount > 0, 'Exporter has no MET token balance')
      amount = ethers.utils.bigNumberify(amount)
      let fee = ethers.utils.bigNumberify(3e14)
      amount = amount.sub(fee)
      let extraData = 'D'
      let totalSupplybefore = await etc.contracts.metToken.methods
        .totalSupply()
        .call()
      totalSupplybefore = ethers.utils.bigNumberify(totalSupplybefore)
      console.log('exporting - test 2')
      let receipt = await etc.contracts.metToken.methods
        .export(
          eth.web3.utils.toHex('ETH'),
          eth.contracts.metToken.options.address,
          ethBuyer1,
          amount,
          fee,
          eth.web3.utils.toHex(extraData)
        )
        .send({ from: etcBuyer1 })
        .on('error', error => {
          reject(error)
        })
      if (!receipt.status) {
        reject(new Error('Export function reverted'))
      }
      let totalSupplyAfter = await etc.contracts.metToken.methods
        .totalSupply()
        .call()
      totalSupplyAfter = ethers.utils.bigNumberify(totalSupplyAfter)
      assert(
        totalSupplybefore.sub(totalSupplyAfter).eq(amount.add(fee)),
        'Export from ETH failed'
      )
      let importDataObj = await util.prepareImportData(etc, receipt)
      let ethTotalSupply = await eth.contracts.metToken.methods
        .totalSupply()
        .call()
      ethTotalSupply = ethers.utils.bigNumberify(ethTotalSupply)
      let expectedTotalSupply = ethTotalSupply.add(amount).add(fee)
      let balanceOfRecepient = await eth.contracts.metToken.methods
        .balanceOf(importDataObj.addresses[1])
        .call()
      balanceOfRecepient = ethers.utils.bigNumberify(balanceOfRecepient)
      let expectedBalanceOfRecepient = balanceOfRecepient.add(amount)
      receipt = await eth.contracts.metToken.methods
        .importMET(
          eth.web3.utils.toHex('ETC'),
          importDataObj.destinationChain,
          importDataObj.addresses,
          importDataObj.extraData,
          importDataObj.burnHashes,
          importDataObj.supplyOnAllChains,
          importDataObj.importData,
          importDataObj.root
        )
        .send({ from: ethBuyer1 })
        .on('error', error => {
          reject(error)
        })
      if (!receipt.status) {
        reject(new Error('importMET function reverted'))
      }

      // wait for minting to happen
      var subs = eth.contracts.tokenPorter.events.LogImport(
        async (err, response) => {
          if (err) {
            console.log('export error', err)
          } else {
            console.log('Attestation done. Validating minted amount')
            if (
              importDataObj.burnHashes[1] === response.returnValues.currentHash
            ) {
              try {
                await subs.unsubscribe()
                await validateMinting(
                  eth,
                  ethBuyer1,
                  expectedTotalSupply,
                  expectedBalanceOfRecepient
                )
              } catch (e) {
                reject(e)
              }
              resolve()
            }
          }
        }
      )
    })
  })

  // it('ETH to ETC: Fake export receipt, should pass on-chain validation and fail on off-chain validation', () => {
  //   return new Promise(async (resolve, reject) => {
  //     // Buy some MET
  //     let receipt = await eth.web3.eth.sendTransaction({ to: eth.contracts.auctions.options.address, from: ethBuyer1, value: 2e16 })
  //     let metBalance = await eth.contracts.metToken.methods.balanceOf(ethBuyer1).call()
  //     console.log('metBalance', metBalance)
  //     assert(metBalance > 0, 'Exporter has no MET token balance')
  //     let fee = Math.floor(metBalance / 2)
  //     let amount = metBalance - fee
  //     console.log('amount', amount)
  //     console.log('fee', fee)
  //     let extraData = 'D'
  //     let totalSupplybefore = await eth.contracts.metToken.methods.totalSupply().call()
  //     totalSupplybefore = new BN(totalSupplybefore, 10)
  //     receipt = await eth.contracts.metToken.methods.export(
  //       eth.web3.utils.toHex('ETC'),
  //       etc.contracts.metToken.options.address,
  //       etcBuyer1,
  //       ethers.utils.bigNumberify(amount),
  //       ethers.utils.bigNumberify(fee),
  //       eth.web3.utils.toHex(extraData))
  //       .send({ from: ethBuyer1 })
  //       .on('error', console.error)
  //     console.log('receipt', receipt)
  //     if (!receipt.status) {
  //       reject(new Error('export function reverted'))
  //     }
  //     let totalSupplyAfter = await eth.contracts.metToken.methods.totalSupply().call()
  //     totalSupplyAfter = new BN(totalSupplyAfter, 10)
  //     amount = new BN(amount, 10)
  //     fee = new BN(fee, 10)
  //     console.log('1')
  //     assert(totalSupplybefore.sub(totalSupplyAfter), amount.add(fee), 'Export from ETH failed')
  //     console.log('2')
  //     const importDataJson = JSON.parse(getDataForImport())
  //     console.log('importDataJson', importDataJson)
  //     var data = importDataJson.intData
  //     data = data.map(x => ethers.utils.bigNumberify(x.toString()))
  //     const burnHashes = importDataJson.burnHashes
  //     const addresses = importDataJson.addresses
  //     var filter = { 'transactionHash': receipt.transactionHash }
  //     var logExportReceipt = await eth.contracts.tokenPorter.getPastEvents(
  //       'ExportReceiptLog', { filter, fromBlock: receipt.blockNumber, toBlock: receipt.blockNumber })
  //     const returnValues = logExportReceipt[0].returnValues

  //     // let outcome = await etc.contracts.metToken.methods.importMET(
  //     //   importDataJson.eth,
  //     //   importDataJson.etc,
  //     //   addresses,
  //     //   importDataJson.extraData,
  //     //   burnHashes,
  //     //   returnValues.supplyOnAllChains,
  //     //   data,
  //     //   importDataJson.root).call({ from: etcBuyer1 })
  //     // assert(outcome, 'call to importMET should return true')
  //     receipt = await etc.contracts.metToken.methods.importMET(
  //       importDataJson.eth,
  //       importDataJson.etc,
  //       addresses,
  //       importDataJson.extraData,
  //       burnHashes,
  //       returnValues.supplyOnAllChains,
  //       data,
  //       importDataJson.root)
  //       .send({ from: etcBuyer1 })
  //       .on('error', console.error)
  //     if (!receipt.status) {
  //       reject(new Error('importMET function reverted'))
  //     }
  //     etc.contracts.validator.events.LogAttestation((err, response) => {
  //       console.log('attestions event', response)
  //       if (err) {
  //         console.log('Attestation error', err)
  //       } else if (burnHashes[1] === response.returnValues.hash) {
  //         assert.isFalse(response.args.isValid)
  //       }
  //     })
  //     resolve()
  //   })
  // })

  it('ETH to ETC: import should fail as provided fee is less than defined fee', () => {
    return new Promise(async (resolve, reject) => {
      // Buy some MET
      await util.getMET(eth, ethBuyer1)
      let metBalance = await eth.contracts.metToken.methods
        .balanceOf(ethBuyer1)
        .call()
      metBalance = ethers.utils.bigNumberify(metBalance)
      // let fee = 10 // 10 wei MET
      // let amount = metBalance - fee
      let fee = ethers.utils.bigNumberify(2)
      let amount = metBalance.sub(fee)
      let extraData = 'D'
      await eth.contracts.metToken.methods
        .export(
          eth.web3.utils.toHex('ETC'),
          etc.contracts.metToken.options.address,
          etcBuyer1,
          amount,
          fee,
          eth.web3.utils.toHex(extraData)
        )
        .send({ from: ethBuyer1 })
        .on('receipt', receipt => {
          if (receipt.status) {
            reject(new Error('Export should revert'))
          }
        })
        .catch(error => {
          resolve(error)
        })
    })
  })
})
