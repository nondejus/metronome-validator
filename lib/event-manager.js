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
const Validator = require('./validator')
const constant = require('./const.js')
const logger = require('./logger')(__filename)
var CronJob = require('cron').CronJob
const tracker = require('../event-tracker')
var config = require('config')

class EventManager {
  constructor (queue, chains, listener) {
    this.queue = queue
    this.chains = chains
    this.destination = chains[listener.chainName]
    this.web3 = this.destination.web3
    this.validator = new Validator(chains, this.destination)
    this.listener = listener
    this.listening = false
    this.validationQ = constant[this.destination.name].validationQ
    this.attestationQ = constant[this.destination.name].attestationQ
  }

  setupAndTriggerJob () {
    let validationJob = new CronJob({
      cronTime: constant.cronJobPattern,
      onTick: () => { this.processPendingValidations() },
      start: false,
      timeZone: 'UTC'
    })
    validationJob.start()

    let attestationJob = new CronJob({
      cronTime: constant.cronJobPattern,
      onTick: () => { this.processPendingAttestation() },
      start: false,
      timeZone: 'UTC'
    })
    logger.info('Started processing pending attestation on destination (%s) chain', this.destination.name)
    attestationJob.start()

    new CronJob({
      cronTime: '0 0 */1 * * *',
      onTick: () => { this.checkNodeStatus() },
      start: true,
      timeZone: 'UTC'
    })
  }

  async checkNodeStatus () {
    var currentTime = Math.floor(new Date().getTime() / 1000)
    if ((currentTime - this.destination.getBlockTimeStamp()) > config.synctolerance) {
      tracker.recordCustomEvent('nodenotsynced', { chainName: this.destination.name,
        blockNumber: this.destination.getBlockNumber(),
        address: this.destination.configuration.address })
      logger.error('Node of chain %s lagging more than %s minutes behind. Validator wont work', this.destination.name, (currentTime - this.latestBlockTime) / 60)
    }
  }

  async processPendingValidations () {
    var count = await this.queue.length(this.validationQ)
    this.listener.readPendingImports()
    while (count > 0) {
      count--
      try {
        var value = await this.queue.pop(this.validationQ) // value is transaction receipt of an importRequest
        logger.info('Processing pending validations for value = %s', JSON.stringify(value))
        if (!value) {
          continue
        }
        let params = [value.returnValues.currentBurnHash, this.destination.configuration.address]
        if (await this.destination.isAttestedOrRefuted(params)) {
          logger.info(
            'This was already attested or refuted so skipping it now %s.', JSON.stringify(value)
          )
          continue
        }
        const destBlockNumber = await this.destination.getBlockNumber()
        var isSafeBlockHeight = destBlockNumber >= (value.blockNumber + this.destination.configuration.confirmationCount)
        if (isSafeBlockHeight) {
          let merkleRoot = await this.destination.call(this.destination.contracts.TokenPorter, 'merkleRoots', [value.returnValues.currentBurnHash])
          if (merkleRoot === '0x0000000000000000000000000000000000000000000000000000000000000000') {
            // Skiping if the event was emmitted in minor chain/soft forking scenario
            continue
          }
          let originChain = value.returnValues.originChain
          originChain = this.web3.utils.toUtf8((originChain).indexOf('0x') !== 0 ? '0x' + originChain : originChain)
          let response = await this.validator.validateHash(originChain.toLowerCase(), value.returnValues.currentBurnHash)
          var sourceChain = this.chains[originChain.toLowerCase()]
          if (response.hashExist) {
            // Hash found in source chain
            var exportReceiptObj = response.exportReceipt[0]
            exportReceiptObj.returnValues.originChain = value.returnValues.originChain
            const SourceBlockNumber = await sourceChain.getBlockNumber()
            let isReadyForAttest = SourceBlockNumber >= (exportReceiptObj.blockNumber + sourceChain.configuration.confirmationCount)
            if (isReadyForAttest) {
              // Required confirmation achieved in source chain
              exportReceiptObj.failedAttempts = 0
              this.queue.push(this.attestationQ, exportReceiptObj)
              continue
            }
          } else {
            logger.info(
              'Export receipt not found in source chain for burn hash %s',
              value.returnValues.currentBurnHash
            )
            let currentBlockTimestmap = await sourceChain.getBlockTimeStamp()
            if (currentBlockTimestmap < value.returnValues.exportTimeStamp) {
              logger.info(
                'Source chain is not synced properly. Will wait and try again for burn hash %s',
                value.returnValues.currentBurnHash
              )
            } else {
              let recipientAddr = '0x0000000000000000000000000000000000000000'
              if (value.returnValues.destinationRecipientAddr) {
                recipientAddr = value.returnValues.destinationRecipientAddr
              }
              await this.validator.refuteHash(value.returnValues.currentBurnHash, recipientAddr)
              continue // Processed successfully, continue to next iteration (hash)
            }
          }
        }
      } catch (error) {
        logger.error(
          'Error while processing pending validations %s. value in queue was %s. export receipt was %s',
          error,
          JSON.stringify(value),
          JSON.stringify(exportReceiptObj)
        )

        value.failedAttempt ? value.failedAttempt++ : value.failedAttempt = 1

        if (value.failedAttempt === 10) {
          continue
        }
      }
      // Failed validation (either no safe height or chain is not synced) will be pushed again to retry
      this.queue.push(this.validationQ, value)
    }
  }

  async processPendingAttestation () {
    // Todo: implement logic to avoid multiple cron triggering this method without earlier execution finish

    // Process all pending attestion
    var count = await this.queue.length(this.attestationQ)
    while (count > 0) {
      count--
      try {
        var value = await this.queue.pop(this.attestationQ)
        logger.info(
          'Safe block height reached. attesting hash now %s.', JSON.stringify(value)
        )
        let originChain = value.returnValues.originChain
        originChain = this.web3.utils.toUtf8((originChain).indexOf('0x') !== 0 ? '0x' + originChain : originChain)
        await this.validator.attestHash(originChain, value.returnValues)
      } catch (error) {
        logger.error(
          'Error while processing pending attestation, %s. value in queue was %s',
          error, JSON.stringify(value))
        await this.prepareForRetry(value)
      }
    }
  }

  async prepareForRetry (value) {
    if (value.failedAttempts < constant.retryCount) {
      // Push again at end of queue to try again in future
      logger.error(
        'Adding the value in queue to try again later, %s', JSON.stringify(value))
      value.failedAttempts++
      await this.queue.push(this.attestationQ, value)
    }
  }
}

module.exports = EventManager
