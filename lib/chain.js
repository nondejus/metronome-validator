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
const constant = require('./const.js')
const logger = require('./logger')(__filename)
const camelCase = require('camelcase')

class Chain {
  /**
   * @desc Metronome off chain validator.
   * @param configuration - contains owner address for validator, passord and URL ( with port)
   *  of blockchain node i.e. http://host:port
   * @param {object} contracts
   */
  constructor (configuration, contracts = {}) {
    this.name = configuration.chainName
    this.confirmationCount = constant.confirmationCount[this.name]
    this.configuration = configuration
    this.web3 = new Web3()
    this.createContractObj(contracts)
  }

  createContractObj (_contracts) {
    this.contracts = {}
    var options = { timeout: 10000, autoReconnect: true }
    this.web3.setProvider(new Web3.providers.WebsocketProvider(this.configuration.wsURL, options))
    for (var name in _contracts) {
      let contractName = camelCase(name)
      let ethObj, contract
      if (contractName === 'validator' || contractName === 'Validator') {
        // Unfortunately we have apply this dirty logic here because of below bug
        // https://github.com/ethereum/web3.js/issues/2025
        let web3h = new Web3(new Web3.providers.HttpProvider(this.configuration.httpURL))
        ethObj = web3h.eth
      } else {
        ethObj = this.web3.eth
      }
      contract = new ethObj.Contract(_contracts[name].abi, _contracts[name].address)
      this.contracts[contractName] = contract
    }
  }

  isPasswordValid () {
    this.web3.eth.personal.unlockAccount(this.configuration.address, this.configuration.password)
      .catch((error) => {
        throw error(error)
      })
  }

  async call (contract, methodName, params) {
    let output = await contract.methods[methodName](...params).call()
    return output
  }

  async isAttestedOrRefuted (params) {
    let attested = await this.call(this.contracts.validator, 'hashAttestations', params)
    let refuted = await this.call(this.contracts.validator, 'hashRefutation', params)
    return (attested || refuted)
  }

  getBlockNumber () {
    return this.web3.eth.getBlockNumber()
  }

  async getPastEvents (contract, eventName, filter) {
    return contract.getPastEvents(eventName, filter)
  }

  async getPastExportReceipts (filter) {
    return this.getPastEvents(this.contracts.tokenPorter, 'LogExportReceipt', filter)
  }

  async getPastImportRequest (filter) {
    return this.getPastEvents(this.contracts.tokenPorter, 'LogImportRequest', filter)
  }

  async send (contract, methodName, params, options) {
    return (contract.methods[methodName](...params).send(options))
  }

  async getBlockTimeStamp () {
    return this.web3.eth.getBlock('latest').timestamp
  }

  watchImportEvent (cb) {
    this.contracts.tokenPorter.events.LogImportRequest()
      .on('data', (event) => {
        cb(event)
      }).on('error', (error) => {
        logger.error('Error occurred while watching for import request %s' + this.name, error)
        throw error(error)
      })
  }
}

module.exports = Chain
