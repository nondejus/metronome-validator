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

const logger = require('./logger')(__filename)
var config = require('config')

class Listener {
  constructor (queue, destinationChain) {
    this.chainName = destinationChain.name
    this.tokenPorter = destinationChain.contracts.TokenPorter
    this.contracts = destinationChain.contracts
    this.queue = queue
    this.web3 = destinationChain.web3
    this.config = destinationChain.configuration
    this.valiationQ = destinationChain.configuration.validationQ
    this.blockKey = destinationChain.configuration.blockKey
  }

  async watchImportEvent () {
    logger.info('Started watching import request event on chain %s', this.chainName)
    // Read pending import from chain and then watch for upcoming events
    this.readPendingImports()

    this.tokenPorter.events.LogImportRequest()
      .on('data', (event) => {
        this.processEventData(event)
      }).on('error', (error) => {
        logger.error('Error occurred while watching for import request %s' + this.chainName, error)
      })
    return this.subscriber
  }

  async watchNewProposalEvent () {
    logger.info('Started watching LogProposalCreated event on chain %s', this.chainName)
    this.contracts.Proposals.events.LogProposalCreated()
      .on('data', async (event) => {
        // I object proposal to remove me.
        if (event.returnValues.newValidator === this.config.address) {
          var proposalId = event.returnValues.proposalId
          if (!this.config.walletMnemonic) {
            this.web3.eth.personal.unlockAccount(this.config.address, this.config.password)
          }
          let nonce = await this.web3.eth.getTransactionCount(this.config.address, 'pending')
          console.log('this.config.address', this.config.address)
          await this.contracts.hProposals.methods.voteForProposal(proposalId, false).send({ from: this.config.address, gasPrice: config.gasPrice, nonce })
            .on('transactionHash', txHash => {
              logger.info('Vote for proposal id %s sent, tx hash %s', proposalId, txHash)
            })
            .on('receipt', (receipt) => {
              logger.info('Vote for proposal id %s, receipt %s',
                proposalId, JSON.stringify(receipt))
            })
            .on('error', (error) => {
              logger.error('Vote for proposal id %s failed, error is %s', proposalId, error)
            })
        }
      }).on('error', (error) => {
        logger.error('Error occurred while watching LogProposalCreated %s' + this.chainName, error)
      })
  }

  async readPendingImports () {
    var block = await this.queue.get(this.blockKey)
    if (block && block > '0') {
      let latest = await this.web3.eth.getBlockNumber()
      block = latest < block ? latest : block
      this.tokenPorter.getPastEvents('LogImportRequest', { fromBlock: parseInt(block, 10), toBlock: 'latest' })
        .then((event) => {
          for (let eventData of event) {
            logger.debug('Found old LogImportRequest event in block number %s', eventData.blockNumber)
            this.processEventData(eventData)
          }
        }).catch(error => {
          logger.error('Error occurred while reading pending import events %s', error)
          process.exit(1)
        })
    }
  }

  async processEventData (response) {
    response.failedAttempts = 0
    logger.debug('Pushing import request in redis queue %s', JSON.stringify(response))
    this.queue.push(this.valiationQ, response)
    var block = await this.queue.get(this.blockKey)
    logger.debug('Redis: Last processed block for chain %s is %s', this.chainName, block)
    logger.debug('OnChain: current processing block for chain %s is %s', this.chainName, response.blockNumber)
    if (!block || block < response.blockNumber) {
      await this.queue.pop(this.blockKey)
      this.queue.push(this.blockKey, response.blockNumber)
    }
  }
}

module.exports = Listener
