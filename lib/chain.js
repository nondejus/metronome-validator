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
const MetronomeContracts = require('metronome-contracts')
const logger = require('./logger')(__filename)
const HDWalletProvider = require('truffle-hdwallet-provider')
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
    var options = { timeout: 10000, autoReconnect: true }
    this.web3.setProvider(new Web3.providers.WebsocketProvider(this.configuration.wsURL, options))
    this.createContractObj(this.web3, configuration.network)
  }

  createContractObj (web3, network) {
    this.contracts = new MetronomeContracts(web3, network)
    this.birthblock = MetronomeContracts[network].METToken.birthblock
    // Unfortunately we have apply this dirty logic here because of below bug
    // https://github.com/ethereum/web3.js/issues/2025
    var provider
    if (this.configuration.walletMnemonic) {
      // Using HD wallet
      provider = new HDWalletProvider(
        this.configuration.walletMnemonic,
        this.configuration.httpURL, this.configuration.hdwalletaddressindex, 1, true, this.configuration.derivepath)
      if (provider.addresses[0].toLowerCase() !== this.configuration.address.toLowerCase()) {
        console.log('provider.addresses[0]', provider.addresses[0])
        console.log('this.configuration.address', this.configuration.address)
        logger.error('Validator %s - Error mnenomic phrase and address provider does not match.', this.configuration.address)
        process.exit(0)
      }
    } else {
      provider = new Web3.providers.HttpProvider(this.configuration.httpURL)
    }
    let metContracts = new MetronomeContracts(new Web3(provider), network)
    this.contracts.Validator = metContracts.Validator
    this.contracts.hProposals = metContracts.Proposals
  }
}
module.exports = Chain
