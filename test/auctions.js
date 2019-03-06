const assert = require('chai').assert
const util = require('./testUtil')
require('dotenv').config()

var qChain, chains

before(async () => {
  chains = await util.initContracts()
  qChain = chains.qtum
})

describe('Auction test in qtum', () => {
  before(async () => {
  })

  beforeEach(async () => {
  })

  it('Should be able to buy from Auction', () => {
    return new Promise(async (resolve, reject) => {
      var mintableBefore = await qChain.call(qChain.contracts.auctions, 'mintable', [])
      assert(mintableBefore > 0, 'Auction has no mintable. Cants run this test case')
      let hexAddress = await qChain.qtum.rawCall('gethexaddress', [process.env.qtum_validator_address])
      let metBalanceBefore = await qChain.call(qChain.contracts.metToken, 'balanceOf', [hexAddress])
      console.log('metBalanceBefore', metBalanceBefore.toString())
      let tx = await qChain.qtum.rawCall('sendtocontract', [qChain.contracts.auctions.info.address, '00', 10, 2500000, 0.000001, from])
      console.log('tx', tx)
      var mintableAfter = await qChain.call(qChain.contracts.auctions, 'mintable', [])
      console.log('mintableAfter', mintableAfter.toString())
      var metBalanceAfter = await qChain.call(qChain.contracts.metToken, 'balanceOf', [hexAddress])
      console.log('metBalanceAfter', metBalanceAfter.toString())
      assert(metBalanceAfter > metBalanceBefore, 'Failed buy in auction. MET balance wrong')
      assert(mintableBefore > mintableAfter, 'Failed buy in auction. Mintable remains same')
      resolve()
    })
  })
})
