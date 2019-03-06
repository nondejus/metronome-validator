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
  before(async () => {
  })

  beforeEach(async () => {
    ethChain.web3.eth.personal.unlockAccount(ethBuyer, ethPassword)
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
