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

var validator = process.env.eth_validator_address
var ethChain, qChain, chains

before(async () => {
  chains = await util.initContracts()
  ethChain = chains.eth
  qChain = chains.qtum
})

describe('Chain hop test cases- Proposal', () => {
  // it('Test case 1: Should be able to propose new validator in eth chain', () => {
  //   return new Promise(async (resolve, reject) => {
  //     var newVal = '0xabf5029fd710d227630c8b7d338051b8e76d50b5'
  //     var receipt = await ethChain.contracts.Proposals.methods.proposeNewValidator(newVal, 0).send({ from: validator, gas: 900000 })
  //     console.log('receipt', receipt)
  //     resolve()
  //   })
  // })

  // it('Test case 1: Should be able to propose to remove a validator in eth chain', () => {
  //   return new Promise(async (resolve, reject) => {
  //     var receipt = await ethChain.contracts.Proposals.methods.proposeRemoveValidator('0xAE4E3Af55872601461897D82ce4165ba635C50a1', 0).send({ from: validator, gas: 900000 })
  //     console.log('receipt', receipt)
  //     resolve()
  //   })
  // })

  // it('Test case 1: Vote for proposal in eth chain', () => {
  //   return new Promise(async (resolve, reject) => {
  //     console.log('validator', validator)
  //     var receipt = await ethChain.contracts.Proposals.methods.voteForProposal(12, false).send({ from: validator, gas: 900000 })
  //     console.log('receipt', receipt)
  //     resolve()
  //   })
  // })

  it('Test case 3: Should be able to propose to add a validator in eth chain', () => {
    return new Promise(async (resolve, reject) => {
      var tx = await qChain.send(qChain.contracts.Proposals, 'proposeNewValidator', ['0xabf5029fd710d227630c8b7d338051b8e76c50a3', 0], { gas: 380000 })
      console.log('tx', tx)
      resolve()
    })
  })

  // it('Test case 3: Should be able to propose to remove a validator in eth chain', () => {
  //   return new Promise(async (resolve, reject) => {
  //     var tx = await qChain.send(qChain.contracts.Proposals, 'proposeRemoveValidator', ['0xad8fbc9c87f2b72aa3e040dfc023ee85c94f1705', 0], { gas: 380000 })
  //     console.log('tx', tx)
  //     resolve()
  //   })
  // })

  // it('Test case 3: Vote for proposal', () => {
  //   return new Promise(async (resolve, reject) => {
  //     var tx = await qChain.send(qChain.contracts.Proposals, 'proposeRemoveValidator', ['0xad8fbc9c87f2b72aa3e040dfc023ee85c94f1705', 0], { gas: 380000 })
  //     console.log('tx', tx)
  //     resolve()
  //   })
  // })
})
