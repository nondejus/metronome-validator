
const { Qtum } = require('qtumjs')
var chain = require('./chain.js')
const qwallet = require('qtumjs-wallet')
const MetronomeContracts = require('metronome-contracts')
const Web3 = require('web3')
const reader = require('./file-reader')

class QChain extends chain {
/**
   * @desc Metronome off chain validator.
   * @param configuration - contains owner address for validator, passord and URL ( with port)
   *  of blockchain node i.e. http://host:port
   */
  constructor (configuration) {
    super(configuration)
    this.createContractObj()
  }

  createContractObj () {
    // var contractsRepo = reader.readMetronome().qtum
    // this.qtum = new Qtum(this.configuration.httpURL, contractsRepo)
    this.contracts = {}
    // for (var name in contractsRepo.contracts) {
    //   this.contracts[name] = this.qtum.contract(name)
    // }
    this.qtum = new Qtum(this.configuration.httpURL)
    this.contracts = new MetronomeContracts(new Web3(), this.configuration.networkAlias, this.configuration.httpURL)
    this.birthblock = MetronomeContracts[this.configuration.networkAlias].METToken.birthblock
  }

  async getBlockNumber () {
    let info = await this.qtum.rawCall('getblockchaininfo')
    return info.blocks
  }

  async getBlockTimeStamp () {
    let info = await this.qtum.rawCall('getblockchaininfo')
    return info.mediantime
  }

  // async call (contract, methodName, params) {
  //   let response = await contract.call(methodName, params)
  //   if (response.outputs && response.outputs.length === 1) {
  //     return response.outputs[0]
  //   } else {
  //     return response.outputs
  //   }
  // }

  // async send (contract, methodName, params, _options = {}) {
  //   var options = { gasLimit: 1000000 }
  //   if (_options.from) {
  //     delete Object.assign(options, _options, { senderAddress: _options['from'] })['from']
  //   }

  //   if (_options.gas) {
  //     delete Object.assign(options, _options, { gasLimit: _options['gas'] })['gas']
  //   }
  //   let tx = await contract.send(methodName, params, options)
  //   await tx.confirm(1)
  //   return tx
  // }

  async call (contract, methodName, params) {
    var network = qwallet.networks[this.configuration.network]
    const wallet = network.fromMnemonic(this.configuration.walletMnemonic)
    var response = await wallet.contractCall(contract.info.address, this.encodeData(contract, methodName, params))
    var methodAbi = contract.methodMap.findMethod(methodName, params)
    response = this.web3.eth.abi.decodeParameters(methodAbi.outputs, response.executionResult.output)
    if (response.__length__ === 0) {
      return null
    } else if (response.__length__ === 1) {
      return response['0']
    }
    return response
  }

  async send (contract, methodName, params, _options = {}) {
    var options = { gasLimit: 1000000 }
    if (_options.gas) {
      delete Object.assign(options, _options, { gasLimit: _options['gas'] })['gas']
    }
    var network = qwallet.networks[this.configuration.network]
    const wallet = network.fromMnemonic(this.configuration.walletMnemonic)
    // var rawtx = await wallet.generateContractSendTx(contract.info.address, this.encodeData(contract, methodName, params), options)
    // console.log('rawtx', rawtx)
    // var tx = await this.qtum.rawCall('sendrawtransaction', [rawtx])
    var tx = await wallet.contractSend(contract.info.address, this.encodeData(contract, methodName, params), options)
    console.log('tx', tx)
    return tx
  }

  encodeData (contract, methodName, params) {
    var methodAbi = contract.methodMap.findMethod(methodName, params)
    var encodedData = this.web3.eth.abi.encodeFunctionCall(methodAbi, params)
    return encodedData.replace('0x', '')
  }

  async getPastImportRequest (filter) {
    var searchBlocks = { fromBlock: 0, toBlock: 'latest' }
    if (filter.fromBlock) {
      searchBlocks.fromBlock = filter.fromBlock
    }
    if (filter.toBlock) {
      searchBlocks.toBlock = filter.toBlock
    }
    var addresses = [this.contracts.TokenPorter.info.address]
    var topic = this.web3.eth.abi.encodeEventSignature('LogImportRequest(bytes8,bytes32,bytes32,address,uint256,uint256,uint256,uint256,bytes)')
    topic = topic.substr(2)
    var topics = [topic]
    var logs = await this.contracts.TokenPorter.waitLogs({ minconf: 0, fromBlock: 0, toBlock: searchBlocks.toBlock, filter: { addresses: addresses, topics: topics } })
    var eventParam = ['originChain', 'currentBurnHash', 'prevHash',
      'destinationRecipientAddr', 'amountToImport', 'fee', 'exportTimeStamp',
      'burnSequence', 'extraData']
    return (logs.entries.map(log => transformQtumEventData(log, eventParam)))
  }

  watchImportEvent (cb) {
    try {
      this.contracts.TokenPorter.logEmitter({ minconf: 1 })
        .on('LogImportRequest', (event) => {
          let eventData = transformQtumEventData(event)
          var hexAtributes = ['originChain', 'prevHash', 'currentBurnHash', 'destinationRecipientAddr']
          eventData.returnValues = append0x(eventData.returnValues, hexAtributes)
          cb(eventData)
        })
    } catch (e) {
      console.log('error in listening', e)
    }
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
    var addresses = [this.contracts.METToken.info.address]
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
    var logs = await this.contracts.TokenPorter.waitLogs({ minconf: 0, fromBlock: searchBlocks.fromBlock, toBlock: searchBlocks.toBlock, filter: { addresses: addresses, topics: topics } })
    var eventParam = ['destinationChain', 'destinationMetronomeAddr', 'prevBurnHash',
      'destinationRecipientAddr', 'currentBurnHash', 'exporter', 'extraData']
    return (logs.entries.map(log => transformQtumEventData(log, eventParam)))
  }
}

function append0x (data, hexAtributes) {
  for (let item of hexAtributes) {
    if ((data[item]).indexOf('0x') !== 0) {
      data[item] = '0x' + data[item]
    }
  }
  return data
}

function transformQtumEventData (eventData, eventParams) {
  for (var name in eventData.event) {
    if (Array.isArray(eventData.event[name])) {
      eventData.event[name] = eventData.event[name].map(data => {
        return data.toString()
      })
    } else {
      eventData.event[name] = eventData.event[name].toString()
    }
  }
  eventData.event = append0x(eventData.event, eventParams)
  eventData.address = eventData.contractAddress
  eventData.returnValues = eventData.event
  eventData.event = eventData.returnValues.type
  return eventData
}

module.exports = QChain
