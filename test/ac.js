const assert = require('chai').assert
const util = require('./testUtil')
require('dotenv').config()

var qChain, chains

before(async () => {
  chains = await util.initContracts()
  qChain = chains.qtum
})

describe('Autonomous converter test in qtum', () => {
  before(async () => {
  })

  beforeEach(async () => {
  })

  it('Should be able to sell MET in AC', () => {
    return new Promise(async (resolve, reject) => {
      let amount = 100
      let buyer = await qChain.qtum.rawCall('gethexaddress', [process.env.qtum_validator_address])
      let metBalanceBefore = await qChain.call(qChain.contracts.metToken, 'balanceOf', [buyer])
      let metBalanceACBefore = await qChain.call(qChain.contracts.metToken, 'balanceOf', [qChain.contracts.autonomousConverter.info.address])
      let prediction = await qChain.call(qChain.contracts.autonomousConverter, 'getQtumForMetResult', [amount])
      await qChain.send(qChain.contracts.metToken, 'approve',
        [qChain.contracts.autonomousConverter.info.address, amount],
        { from: process.env.qtum_validator_address })
      await qChain.send(qChain.contracts.autonomousConverter, 'convertMetToQtum', [amount, 1], { from: process.env.qtum_validator_address })
      let metBalanceAfter = await qChain.call(qChain.contracts.metToken, 'balanceOf', [buyer])
      let metBalanceACAfter = await qChain.call(qChain.contracts.metToken, 'balanceOf', [qChain.contracts.autonomousConverter.info.address])
      assert(metBalanceACAfter - metBalanceACBefore, amount, 'MET balance in AC is wrong after exchange')
      assert(metBalanceBefore - metBalanceAfter, amount, 'MET balance in AC is wrong after exchange')
      resolve()
    })
  })

  it('Should be able to buy MET from AC', () => {
    return new Promise(async (resolve, reject) => {
      let qtumAmount = 1000e8
      let buyer = await qChain.qtum.rawCall('gethexaddress', [process.env.qtum_validator_address])
      let metBalanceBefore = await qChain.call(qChain.contracts.metToken, 'balanceOf', [buyer])
      let metBalanceACBefore = await qChain.call(qChain.contracts.metToken, 'balanceOf', [qChain.contracts.autonomousConverter.info.address])
      let prediction = await qChain.call(qChain.contracts.autonomousConverter, 'getMetForQtumResult', [qtumAmount])
      assert(prediction > 0, 'Low liquidiy in AC. Supply higher qtum amount or dump MET in AC')
      await qChain.send(qChain.contracts.autonomousConverter, 'convertQtumToMet', [1], { from: process.env.qtum_validator_address, amount: qtumAmount / 1e8, gasPrice: 0.000001 })
      let metBalanceAfter = await qChain.call(qChain.contracts.metToken, 'balanceOf', [buyer])
      let metBalanceACAfter = await qChain.call(qChain.contracts.metToken, 'balanceOf', [qChain.contracts.autonomousConverter.info.address])
      assert(metBalanceACBefore - metBalanceACAfter, prediction, 'MET balance in AC is wrong after exchange')
      assert(metBalanceAfter - metBalanceBefore, prediction, 'MET balance in AC is wrong after exchange')
      resolve()
    })
  })
})
