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

const MerkleTreeJs = require('merkletreejs')
const crypto = require('crypto')
const logger = require('./logger')(__filename)
const Web3 = require('web3')
/**
 * Class reprensenting a Metronome Validator for off chain validations
 * @namespace MetronomeValidator
 */
class Validator {
  /**
   * @desc Metronome off chain validator.
   */

  constructor (chains, destinationChain) {
    this.address = destinationChain.configuration.address
    this.password = destinationChain.configuration.password
    this.walletMnemonic = destinationChain.configuration.walletMnemonic
    this.web3 = destinationChain.web3
    this.web3h = destinationChain.web3h
    this.chains = chains
    this.destinationChain = destinationChain
  }

  validateHash (sourceChainName, burnHash) {
    return new Promise(async (resolve, reject) => {
      this.chains[sourceChainName].getPastExportReceipts({
        filter: { currentBurnHash: burnHash },
        fromBlock: this.chains[sourceChainName].birthblock,
        toBlock: 'latest' })
        .then((event) => {
          if (!event || event.length === 0) {
            logger.info('Validator %s: Burn hash %s is not found in source chain', this.address, burnHash)
            let obj = { hashExist: false }
            resolve(obj)
          } else {
            logger.info('Validator %s: Burn hash %s exist in source chain', this.address, event[0].returnValues.currentBurnHash)
            let obj = { hashExist: true }
            obj.exportReceipt = event
            resolve(obj)
          }
        })
        .catch((error) => {
          logger.error('Error occurred while reading export receipt on source chain, %s ', error)
          reject(new Error('Error occurred while reading export receipt on source chain')
          )
        })
    })
  }

  async attestHash (sourceChainName, data) {
    let merklePath = await this.createMerklePath(sourceChainName.toLowerCase(), data.burnSequence)
    let importDataObj = this.prepareImportData(data)
    let supplyInOtherChains = await this.totalSupplyInOtherChains()
    try {
      let tx = await this.destinationChain.send(this.destinationChain.contracts.Validator, 'attestHash', [importDataObj.burnHashes[1],
        toHex(sourceChainName),
        importDataObj.addresses[1],
        toHex(importDataObj.importData[1]),
        toHex(importDataObj.importData[2]),
        merklePath,
        importDataObj.extraData,
        toHex(supplyInOtherChains)], { from: this.address, gas: 500000 })
      logger.info('Submitted transaction for attestation. tx %s', JSON.stringify(tx))
    } catch (error) {
      logger.error('Attestation failed for export hash %s, error is %s', data.currentBurnHash, error)
    }
  }

  async totalSupplyInOtherChains () {
    var totalSupply = 0
    for (let chainName in this.chains) {
      var chain = this.chains[chainName]
      if (chainName !== this.destinationChain.chainName) {
        let supply = await chain.call(chain.contracts.METToken, 'totalSupply', [])
        totalSupply = totalSupply + +supply
      }
    }
    return totalSupply
  }

  async refuteHash (burnHash, recipientAddr) {
    try {
      // TODO: unlock account
      // let nonce = await this.web3.eth.getTransactionCount(this.address, 'pending')
      var tx = this.destinationChain.send(this.destinationChain.contracts.Validator, 'refuteHash', [burnHash, recipientAddr], { from: this.address })
      logger.info('Submitted transaction for refutation. tx %s', tx)
    } catch (error) {
      logger.error('Refutation failed for export hash %s, error is %s', burnHash, error)
    }
  }

  async createMerklePath (sourceChainName, burnSequence) {
    var leaves = []
    var i = 0
    if (burnSequence > 15) {
      i = burnSequence - 15
    }
    var leave
    while (i <= burnSequence) {
      leave = await this.chains[sourceChainName].call(this.chains[sourceChainName].contracts.TokenPorter, 'exportedBurns', [i])
      if (leave.indexOf('0x') !== 0) {
        leave = '0x' + leave
      }
      leave = Buffer.from(leave.slice(2), 'hex')
      leaves.push(leave)
      i++
    }
    const tree = new MerkleTreeJs(leaves, this.sha256)
    var merkleProof = []
    var buffer = tree.getProof(leaves[leaves.length - 1])
    for (let j = 0; j < buffer.length; j++) {
      merkleProof.push('0x' + buffer[j].data.toString('hex'))
    }

    return merkleProof
  }

  sha256 (data) {
    // returns Buffer
    return crypto
      .createHash('sha256')
      .update(data)
      .digest()
  }

  prepareImportData (data) {
    return {
      addresses: [data.destinationMetronomeAddr, data.destinationRecipientAddr],
      burnHashes: [data.prevBurnHash, data.currentBurnHash],
      importData: [
        data.blockTimestamp,
        data.amountToBurn,
        data.fee,
        data.currentTick,
        data.genesisTime,
        data.dailyMintable,
        data.burnSequence,
        data.dailyAuctionStartTime
      ],
      extraData: data.extraData
    }
  }
}

function toHex (data) {
  var web3 = new Web3()
  if (typeof data === 'number') {
    return '0x' + data.toString(16)
  }
  return web3.utils.toHex(data.toString())
}

module.exports = Validator
