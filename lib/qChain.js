
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
      options = { senderAddress: _options.from, gasLimit: 3000000 }
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
    var searchBlocks = {fromBlock: 0, toBlock: 'latest'}
    if (args.fromBlock) {
      searchBlocks.fromBlock = args.fromBlock
    }
    if (args.toBlock) {
      searchBlocks.toBlock = args.toBlock
    }
    var addresses = [contracts.METToken.info.address]
    // Todo: Encode it using abi definition
    // keccak256(LogExportReceipt(bytes8,address,address,uint256,uint256,bytes,uint256,uint256,bytes32,bytes32,uint256,uint256[],uint256,address))
    var topics = ['ca44de332c14dded5f8ccbe1ff70f6b5848247af65567e31a815d3fb61be0792']
    if (args.filter) {
      args.filter.destinationRecipientAddr ? topics.push(args.filter.destinationRecipientAddr) : topics.push(null)
      args.filter.currentBurnHash ? topics.push(args.filter.currentBurnHash) : topics.push(null)
      args.filter.exporter ? topics.push(args.filter.exporter) : topics.push(null)
    }
    var logs = await contracts.TokenPorter.waitLogs({ fromBlock: searchBlocks.fromBlock, toBlock: searchBlocks.toBlock, filter: { addresses: addresses, topics: topics } })
    return (logs.entries.map(log => transferQtumEventData(log)))
  }
}

function transferQtumEventData (eventData) {
  eventData.address = eventData.contractAddress
  eventData.returnValues = eventData.event
  eventData.event = eventData.returnValues.type
  return eventData
}

module.exports = QChain
