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
class Listener {
  constructor (queue, destinationChain) {
    this.chainName = destinationChain.name
    this.destinationChain = destinationChain
    this.queue = queue
    this.web3 = destinationChain.web3
    this.config = destinationChain.configuration
    this.valiationQ = destinationChain.configuration.validationQ
    this.blockKey = destinationChain.configuration.blockKey
  }

  async watchImportEvent () {
    logger.info('Started watching import request event on chain %s', this.chainName)
    // Read pending import from chain and then watch for upcoming events
    try {
      this.destinationChain.watchImportEvent((event) => {
        this.processEventData(event)
      })
    } catch (e) {
      console.log('error in watchImportEvent', e)
    }
    return this.subscriber
  }

  async readPendingImports () {
    var block = await this.queue.get(this.blockKey)
    if (block && block > '0') {
      block = block + 1
      let latest = await this.destinationChain.getBlockNumber()
      block = latest < block ? latest : block
      this.destinationChain.getPastImportRequest({ fromBlock: parseInt(block, 10), toBlock: 'latest' })
        .then((events) => {
          for (let eventData of events) {
            logger.info('Validator %s: Found old LogImportRequest event in block number %s', this.config.address, eventData.blockNumber)
            this.processEventData(eventData)
          }
        }).catch(error => {
          logger.error('Validator %s : Error occurred while reading pending import events %s', this.config.address, error)
          process.exit(1)
        })
    }
  }

  async processEventData (response) {
    response.failedAttempts = 0
    logger.info('Validator %s : Pushing import request in redis queue %s', this.config.address, JSON.stringify(response.returnValues))
    this.queue.push(this.valiationQ, response)
    var block = await this.queue.get(this.blockKey)
    logger.info('Validator %s: Redis: Last processed block for chain %s is %s', this.config.address, this.chainName, block)
    logger.info('Validator %s: OnChain: current processing block for chain %s is %s', this.config.address, this.chainName, response.blockNumber)
    if (!block || block < response.blockNumber) {
      await this.queue.pop(this.blockKey)
      this.queue.push(this.blockKey, response.blockNumber)
    }
  }
}

module.exports = Listener
