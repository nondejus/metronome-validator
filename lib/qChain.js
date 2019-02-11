
const { Qtum } = require('qtumjs')
var chain = require('./chain.js')
const camelCase = require('camelcase')

class QChain extends chain {
/**
   * @desc Metronome off chain validator.
   * @param configuration - contains owner address for validator, passord and URL ( with port)
   *  of blockchain node i.e. http://host:port
   * @param {object} contractsRepo
   */
  constructor (configuration, contractsRepo = {}) {
    super(configuration)
    this.qtum = new Qtum(configuration.httpURL, contractsRepo)
    this.createContractObj(contractsRepo.contracts)
  }

  createContractObj (_contracts) {
    this.contracts = {}
    for (var name in _contracts) {
      let contractName = camelCase(name)
      let contract
      if (this.name === 'QTUM') {
        contract = this.qtum.contract(name)
      }
      this.contracts[contractName] = contract
    }
  }

  async getBlockNumber () {
    let info = await this.qtum.rawCall('getblockchaininfo')
    return info.blocks
  }

  async getBlockTimeStamp () {
    let info = await this.qtum.rawCall('getblockchaininfo')
    return info.mediantime
  }

  async call (contract, methodName, params) {
    let response = await contract.call(methodName, params)
    if (response.outputs && response.outputs.length === 1) {
      return response.outputs[0]
    } else {
      return response.outputs
    }
  }

  async send (contract, methodName, params, _options = {}) {
    var options = {}
    if (_options.from) {
      options = { senderAddress: _options.from, gasLimit: 300000 }
    }
    let tx = await contract.send(methodName, params, options)
    await tx.confirm(1)
    return tx
  }

  async getPastEvents (contract, eventName, filter) {
    // Todo: implement search log of qtum
    return []
  }

  watchImportEvent (cb) {
    this.contracts.metToken.logEmitter({ minconf: 0 })
      .on('LogImportRequest', (event) => {
        let eventData = transferQtumEventData(event)
        cb(eventData)
      })
  }

  async isAttestedOrRefuted (params) {
    // Check address type for qtum.
    if (params[1].length !== 40) {
      params[1] = await this.qtum.rawCall('gethexaddress', [params[1]])
    }
    return super.isAttestedOrRefuted(params)
  }
}

function transferQtumEventData (eventData) {
  eventData.address = eventData.contractAddress
  eventData.returnValues = eventData.event
  eventData.event = eventData.returnValues.type
  return eventData
}

module.exports = QChain
