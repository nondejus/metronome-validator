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
const Web3 = require('web3')
const camelCase = require('camelcase')
const constant = require('./const.js')

class Chain {
  /**
   * @desc Metronome off chain validator.
   * @param configuration - contains owner address for validator, passord and URL ( with port)
   *  of blockchain node i.e. http://host:port
   * @param {object} contracts
   */
  constructor (configuration, contracts = {}) {
    this.wsURL = configuration.wsURL
    this.name = configuration.chainName
    if (this.name === 'ETH') {
      this.confirmationCount = constant.confirmationCount.eth
    } else if (this.name === 'ETC') {
      this.confirmationCount = constant.confirmationCount.etc
    } else {
      this.confirmationCount = 1
    }
    this.configuration = configuration
    var options = { timeout: 10000, autoReconnect: true }
    this.web3 = new Web3(new Web3.providers.WebsocketProvider(this.wsURL, options))
    this.createContractObj(contracts, this.web3)
    this.isPasswordValid()
  }

  isPasswordValid () {
    this.web3.eth.personal.unlockAccount(this.configuration.address, this.configuration.password)
      .catch((error) => {
        console.log('Either account or password is invalid. Not able to unlock account of validator of chain ' + this.name)
        console.log(error)
        process.exit(1)
      })
  }
  createContractObj (_contracts, web3) {
    this.contracts = {}
    for (var name in _contracts) {
      let contractName = camelCase(name)
      let ethObj
      if (contractName === 'validator' || contractName === 'Validator') {
        // Unfortunately we have apply this dirty logic here because of below bug
        // https://github.com/ethereum/web3.js/issues/2025
        let web3h = new Web3(new Web3.providers.HttpProvider(this.configuration.httpURL))
        ethObj = web3h.eth
      } else {
        ethObj = web3.eth
      }
      let contract = new ethObj.Contract(JSON.parse(_contracts[name].abi), _contracts[name].address)
      this.contracts[contractName] = contract
    }
  }
}
module.exports = Chain
