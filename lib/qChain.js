
const { Qtum } = require('qtumjs')
var chain = require('./chain.js')
const qwallet = require('qtumjs-wallet')
const MetronomeContracts = require('metronome-contracts')
const Web3 = require('web3')
const logger = require('./logger')(__filename)

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
    this.contracts = {}
    this.qtum = new Qtum(this.configuration.httpURL)
    console.log('this.configuration.network', this.configuration.network)
    let network = qwallet.networks[this.configuration.network]
    console.log('network', network)
    this.wallet = network.fromMnemonic(this.configuration.walletMnemonic)
    this.configuration.address = this.wallet.address
    this.provider = new qwallet.WalletRPCProvider(this.wallet)
    this.contracts = new MetronomeContracts(new Web3(), this.configuration.networkAlias, this.configuration.httpURL)
    this.birthblock = MetronomeContracts[this.configuration.networkAlias].METToken.birthblock
  }

  async getBlockNumber () {
    let network = qwallet.networks[this.configuration.network]
    var insight = network.insight()
    let recentBlock = await insight.getRecentBlocks(1)
    return recentBlock[0].height
  }

  async getBlockTimeStamp () {
    let network = qwallet.networks[this.configuration.network]
    var insight = network.insight()
    let recentBlock = await insight.getRecentBlocks(1)
    return recentBlock[0].timestamp
  }

  async call (contract, methodName, params = []) {
    var response = await this.wallet.contractCall(contract.info.address, this.encodeData(contract, methodName, params))
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
    var tx = await this.wallet.contractSend(contract.info.address, this.encodeData(contract, methodName, params), options)
    return tx
  }

  async sendToContract (address, encodedData, _options = {}) {
    var options = { gasLimit: 1000000 }
    if (_options.gas) {
      delete Object.assign(options, _options, { gasLimit: _options['gas'] })['gas']
    }
    var tx = await this.wallet.contractSend(address, encodedData, options)
    return tx
  }

  encodeData (contract, methodName, params) {
    var methodAbi = contract.methodMap.findMethod(methodName, params)
    var encodedData = this.web3.eth.abi.encodeFunctionCall(methodAbi, params)
    return encodedData.replace('0x', '')
  }

  async getPastImportRequest (filter) {
    var fromBlock = this.birthblock
    var toBlock = 'latest'
    if (filter.fromBlock) {
      fromBlock = filter.fromBlock
    }
    if (filter.toBlock) {
      toBlock = filter.toBlock
    }
    var addresses = [this.contracts.TokenPorter.info.address]
    var topic = this.web3.eth.abi.encodeEventSignature('LogImportRequest(bytes8,bytes32,bytes32,address,uint256,uint256,uint256,uint256,bytes)')
    var topics = [topic.substr(2)]
    var logs = await this.contracts.TokenPorter.waitLogs({ minconf: 0, fromBlock, toBlock, filter: { addresses, topics } })
    var eventParam = ['originChain', 'currentBurnHash', 'prevHash',
      'destinationRecipientAddr', 'amountToImport', 'fee', 'exportTimeStamp',
      'burnSequence', 'extraData']
    return (logs.entries.map(log => transformQtumEventData(log, eventParam)))
  }

  watchImportEvent (cb) {
    try {
      this.contracts.TokenPorter.logEmitter({ minconf: 1 })
        .on('LogImportRequest', (event) => {
          var eventParam = ['originChain', 'prevHash', 'currentBurnHash', 'destinationRecipientAddr']
          let eventData = transformQtumEventData(event, eventParam)
          logger.info('A new import request received %s', eventData)
          cb(eventData)
        })
    } catch (e) {
      console.log('error in listening', e)
    }
  }

  watchNewProposalEvent (cb) {
    try {
      this.contracts.Proposals.logEmitter({ minconf: 1 })
        .on('LogProposalCreated', async (event) => {
          var eventParam = ['proposalId', 'newValidator', 'newThreshold', 'creator', 'expiry', 'action']
          let eventData = transformQtumEventData(event, eventParam)
          eventData.returnValues.newValidator = await this.qtum.rawCall('fromhexaddress', [eventData.returnValues.newValidator.replace('0x', '')])
          logger.info('A new proposal created. Data %s', eventData)
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
    var fromBlock = this.birthblock
    var toBlock = 'latest'
    if (args.fromBlock) {
      fromBlock = args.fromBlock
    }
    if (args.toBlock) {
      toBlock = args.toBlock
    }
    var addresses = [this.contracts.METToken.info.address]
    var topic = this.web3.eth.abi.encodeEventSignature('LogExportReceipt(bytes8,address,address,uint256,uint256,bytes,uint256,uint256,bytes32,bytes32,uint256,uint256[],uint256,address)')
    var topics = [topic.substr(2)]
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
    var logs = await this.contracts.TokenPorter.waitLogs({ minconf: 0, fromBlock, toBlock, filter: { addresses, topics } })
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
