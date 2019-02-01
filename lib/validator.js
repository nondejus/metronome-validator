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
const ethers = require('ethers')
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
    this.web3 = destinationChain.web3
    this.web3h = destinationChain.web3h
    this.chains = chains
    this.validator = destinationChain.contracts.validator
  }

  validateHash (sourceChainName, burnHash) {
    return new Promise(async (resolve, reject) => {
      this.chains[sourceChainName].contracts.tokenPorter.getPastEvents('LogExportReceipt', {
        filter: { currentBurnHash: burnHash },
        fromBlock: 0,
        toBlock: 'latest' })
        .then((event) => {
          if (!event || event.length === 0) {
            logger.info('Burn hash %s is not found in source chain', burnHash)
            let obj = { hashExist: false }
            resolve(obj)
          } else {
            logger.info('Burn hash %s exist in source chain', event[0].returnValues.currentBurnHash)
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
    let merklePath = await this.createMerklePath(sourceChainName, data.burnSequence)
    let importDataObj = this.prepareImportData(data)
    let totalSupplyAtSourceChain = await this.chains[sourceChainName].contracts.metToken.methods.totalSupply().call()
    this.web3.eth.personal.unlockAccount(this.address, this.password)
    await this.validator.methods.attestHash(
      importDataObj.burnHashes[1],
      this.web3.utils.toHex(sourceChainName),
      importDataObj.addresses[1],
      ethers.utils.bigNumberify(importDataObj.importData[1]),
      ethers.utils.bigNumberify(importDataObj.importData[2]),
      merklePath,
      importDataObj.extraData,
      totalSupplyAtSourceChain)
      .send({ from: this.address })
      .on('receipt', (receipt) => {
        logger.info('Attestation was successful for export hash %s, receipt %s',
          data.currentBurnHash, JSON.stringify(receipt))
      })
      .on('error', (error) => {
        logger.error('Attestation failed for export hash %s, error is %s', data.currentBurnHash, error)
      })
  }

  async refuteHash (burnHash, recipientAddr) {
    this.validator.methods.refuteHash(burnHash, recipientAddr)
      .send({ from: this.address })
      .on('receipt', (receipt) => {
        logger.info('Refuted burn hash %s, receipt is %s', burnHash, JSON.stringify(receipt))
      })
  }

  async createMerklePath (sourceChainName, burnSequence) {
    var leaves = []
    var i = 0
    if (burnSequence > 15) {
      i = burnSequence - 15
    }
    var leave
    while (i <= burnSequence) {
      leave = await this.chains[sourceChainName].contracts.tokenPorter.methods.exportedBurns(i).call()
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

module.exports = Validator
