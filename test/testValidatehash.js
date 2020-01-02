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
const Web3 = require('web3')
const MetronomeContracts = require('metronome-contracts')
const process = require('process')
const Validator = require('../lib/validator')

describe('Test validator', () => {
  var validator
  before(async () => {
    var network = 'mainnet'
    console.log('process.env.eth_http_url', process.env.eth_http_url)
    var web3 = new Web3(process.env.eth_http_url)
    var sourceConctracts = new MetronomeContracts(web3, network)
    var dummySourceChain = { 'web3': web3, 'configuration': {}, contracts: sourceConctracts }
    var dummyDestinationChain = { 'web3': web3, 'configuration': {}, contracts: {} }
    validator = new Validator(dummySourceChain, dummyDestinationChain)
    validator.sourceTokenPorter = dummySourceChain.contracts.TokenPorter
    validator.address = '0x0'
    validator.birthblock = MetronomeContracts[network].METToken.birthblock
  })

  beforeEach(async () => {
  })

  it('Should be able tor read export receipt from source cain ', () => {
    return new Promise(async (resolve, reject) => {
      var burnHash = '0xcaad90c0071a32119fe7c2817dcb8a3f502923c2e2a358fbb596cec5004a7b8f'
      var output = await validator.validateHash(burnHash)
      console.log('output', output)
      resolve()
    })
  })
})
