
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
      contract = this.qtum.contract(name)
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
    var options = { gasLimit: 1000000 }
    if (_options.from) {
      delete Object.assign(options, _options, { senderAddress: _options['from'] })['from']
    }

    if (_options.gas) {
      delete Object.assign(options, _options, { gasLimit: _options['gas'] })['gas']
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

  async getPastExportReceipts (args) {
    var searchBlocks = { fromBlock: 0, toBlock: 'latest' }
    if (args.fromBlock) {
      searchBlocks.fromBlock = args.fromBlock
    }
    if (args.toBlock) {
      searchBlocks.toBlock = args.toBlock
    }
    var addresses = [this.contracts.metToken.info.address]
    // Todo: Encode it using abi definition
    // keccak256(LogExportReceipt(bytes8,address,address,uint256,uint256,bytes,uint256,uint256,bytes32,bytes32,uint256,uint256[],uint256,address))
    var topics = ['ca44de332c14dded5f8ccbe1ff70f6b5848247af65567e31a815d3fb61be0792']
    if (args.filter) {
      var filterOptions = ['destinationRecipientAddr', 'currentBurnHash', 'exporter'] 
      for (let item of filterOptions) {
        if (args.filter[item]) {
          args.filter[item] = args.filter[item].indexOf('0x') === 0 ? args.filter[item].substr(2) : args.filter[item]
          topics.push(args.filter[item])
        } else {
          topics.push(null)
        }
      }
    }
    var logs = await this.contracts.tokenPorter.waitLogs({ minconf: 0, fromBlock: searchBlocks.fromBlock, toBlock: searchBlocks.toBlock, filter: { addresses: addresses, topics: topics } })
    return (logs.entries.map(log => transferExportReceipt(log)))
  }
}

function transferExportReceipt (eventData) {
  for (var name in eventData.event) {
    if (Array.isArray(eventData.event[name])) {
      eventData.event[name] = eventData.event[name].map(data => {
        return data.toString()
      })
    } else {
      eventData.event[name] = eventData.event[name].toString()
    }
  }
  var hexAtributes = ['destinationChain', 'destinationMetronomeAddr', 'prevBurnHash',
    'destinationRecipientAddr', 'currentBurnHash', 'exporter', 'extraData']
  for (let item of hexAtributes) {
    if ((eventData.event[item]).indexOf('0x') !== 0) {
      eventData.event[item] = '0x' + eventData.event[item]
    }
  }
  return transferQtumEventData(eventData)
}

function transferQtumEventData (eventData) {
  eventData.address = eventData.contractAddress
  eventData.returnValues = eventData.event
  eventData.event = eventData.returnValues.type
  return eventData
}

module.exports = QChain
