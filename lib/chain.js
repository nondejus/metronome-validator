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
const logger = require('./logger')(__filename)
const MetronomeContracts = require('metronome-contracts')
const HDWalletProvider = require('truffle-hdwallet-provider')
var config = require('config')
class Chain {
  /**
   * @desc Metronome off chain validator.
   * @param configuration - contains owner address for validator, password and URL ( with port)
   *  of blockchain node i.e. http://host:port
   */
  constructor (configuration) {
    this.wsURL = configuration.wsURL
    this.name = configuration.chainName
    this.configuration = configuration
    this.web3 = new Web3()
  }

  async createContractObj () {
    var options = { timeout: 10000, autoReconnect: true }
    var network = this.configuration.network
    this.web3.setProvider(new Web3.providers.WebsocketProvider(this.configuration.wsURL, options))
    this.contracts = new MetronomeContracts(this.web3, network)
    this.birthblock = MetronomeContracts[network].METToken.birthblock
    // Unfortunately we have apply this dirty logic here because of below bug
    // https://github.com/ethereum/web3.js/issues/2025
    var provider = new Web3.providers.HttpProvider(this.configuration.httpURL)
    if (this.configuration.walletMnemonic) {
      // Using HD wallet
      provider = new HDWalletProvider(
        this.configuration.walletMnemonic,
        this.configuration.httpURL, this.configuration.hdwalletaddressindex, 1, true, this.configuration.derivepath)
      if (provider.addresses[0].toLowerCase() !== this.configuration.address.toLowerCase()) {
        logger.error('Validator %s - Error mnenomic phrase and address provider does not match.', this.configuration.address)
        process.exit(0)
      }
    }
    let metContracts = new MetronomeContracts(new Web3(provider), network)
    this.contracts.Validator = metContracts.Validator
    this.contracts.hProposals = metContracts.Proposals
  }

  async call (contract, methodName, params) {
    if (!params) {
      params = []
    }
    let output = await contract.methods[methodName](...params).call()
    return output
  }

  async isAttestedOrRefuted (params) {
    let attested = await this.call(this.contracts.Validator, 'hashAttestations', params)
    let refuted = await this.call(this.contracts.Validator, 'hashRefutation', params)
    return (attested || refuted)
  }

  getBlockNumber () {
    return this.web3.eth.getBlockNumber()
  }

  async getBlockTimeStamp () {
    return this.web3.eth.getBlock('latest').timestamp
  }

  async getPastEvents (contract, eventName, filter) {
    return contract.getPastEvents(eventName, filter)
  }

  async getPastExportReceipts (filter) {
    if (filter && filter.currentBurnHash && filter.currentBurnHash.indexOf('0x') !== 0) {
      filter.currentBurnHash = '0x' + filter.currentBurnHash
    }
    return this.getPastEvents(this.contracts.TokenPorter, 'LogExportReceipt', filter)
  }

  async getPastImportRequest (filter) {
    return this.getPastEvents(this.contracts.TokenPorter, 'LogImportRequest', filter)
  }

  async send (contract, methodName, params, options) {
    if (options && !options.gasPrice) {
      options.gasPrice = config.gasPrice
    }
    options.nonce = await this.web3.eth.getTransactionCount(options.from, 'pending')
    if (!this.configuration.walletMnemonic) {
      this.web3.eth.personal.unlockAccount(this.configuration.address, this.configuration.password)
    }
    return (contract.methods[methodName](...params).send(options))
  }

  watchImportEvent (cb) {
    this.contracts.TokenPorter.events.LogImportRequest()
      .on('data', (event) => {
        cb(event)
      }).on('error', (error) => {
        logger.error('Error occurred while watching for import request %s' + this.name, error)
        throw error(error)
      })
  }
}

module.exports = Chain
