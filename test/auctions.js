const assert = require('chai').assert
const util = require('./testUtil')
require('dotenv').config()

var qChain, chains, wallet

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
      let hexAddress = await qChain.qtum.rawCall('gethexaddress', ['qY3Dc6fwnStAfW1gHKLjmD56uwizq58LHQ'])
      console.log('qChain.contracts.METToken.info.address', qChain.contracts.METToken.info.address)
      let fromHex = await qChain.qtum.rawCall('fromhexaddress', [qChain.contracts.METToken.info.address])
      console.log('fromHex', fromHex)
      let metBalanceBefore = await qChain.call(qChain.contracts.METToken, 'transfer', [hexAddress, 1])
      console.log('metBalanceBefore', metBalanceBefore.toString())
      var mintableBefore = await qChain.call(qChain.contracts.Auctions, 'mintable', [])
      console.log('mintableBefore', mintableBefore.toString())
      assert(mintableBefore > 0, 'Auction has no mintable. Cants run this test case')
      let tx = await qChain.qtum.rawCall('sendtocontract', [qChain.contracts.Auctions.info.address, '00', 10, 2500000, 0.000001, 'qY3Dc6fwnStAfW1gHKLjmD56uwizq58LHQ'])
      console.log('tx', tx)
      var mintableAfter = await qChain.call(qChain.contracts.Auctions, 'mintable', [])
      console.log('mintableAfter', mintableAfter.toString())
      var metBalanceAfter = await qChain.call(qChain.contracts.METToken, 'balanceOf', [hexAddress])
      console.log('metBalanceAfter', metBalanceAfter.toString())
      assert(metBalanceAfter > metBalanceBefore, 'Failed buy in auction. MET balance wrong')
      assert(mintableBefore > mintableAfter, 'Failed buy in auction. Mintable remains same')
      resolve()
    })
  })
})
