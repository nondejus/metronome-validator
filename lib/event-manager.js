/*
    The MIT License (MIT)

    Copyright 2017 - 2018, Alchemy Limited, LLC.

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

class EventManager {
  constructor (queue, source, destination) {
    this.queue = queue
    this.source = source
    this.destination = destination
    this.validator = new Validator(source, destination)
    if (this.destination.name === 'ETH') {
      this.validationQ = constant.queueName.eth.validationQ
      this.attestationQ = constant.queueName.eth.attestationQ
    } else if (this.destination.name === 'ETC') {
      this.validationQ = constant.queueName.etc.validationQ
      this.attestationQ = constant.queueName.etc.attestationQ
    }
  }

  setupAndTriggerJob () {
    let validationJob = new CronJob({
      cronTime: constant.cronJobPattern,
      onTick: () => { this.processPendingValidations() },
      start: false,
      timeZone: 'UTC'
    })
    logger.info('Started processing pending validations on source (%s) chain', this.source.name)
    validationJob.start()

    let attestationJob = new CronJob({
      cronTime: constant.cronJobPattern,
      onTick: () => { this.processPendingAttestation() },
      start: false,
      timeZone: 'UTC'
    })
    logger.info('Started processing pending attestation on destination (%s) chain', this.destination.name)
    attestationJob.start()
  }

  async processPendingValidations () {
    // Todo: implement logic to avoid multiple cron triggering this method without earlier execution finish
    var count = await this.queue.length(this.validationQ)

    while (count > 0) {
      count--
      try {
        var value = await this.queue.pop(this.validationQ) // value is transaction receipt of an importRequest

        logger.info('Processing pending validations for value = %s', JSON.stringify(value))
        if (!value) {
          continue
        }
        const destBlockNumber = await this.destination.web3.eth.getBlockNumber()
        var isSafeBlockHeight = destBlockNumber >= value.blockNumber + constant.safeBlockHeight
        if (isSafeBlockHeight) {
          let response = await this.validator.validateHash(value.returnValues.currentBurnHash)
          if (response.hashExist) {
            // Hash found in source chain
            var exportReceiptObj = response.exportReceipt[0]
            const SourceBlockNumber = await this.source.web3.eth.getBlockNumber()
            let isReadyForAttest = SourceBlockNumber >= exportReceiptObj.blockNumber + constant.safeBlockHeight
            if (isReadyForAttest) {
              exportReceiptObj.failedAttempts = 0
              this.queue.push(this.attestationQ, exportReceiptObj)
              continue // Processed successfully, continue to next iteration (hash)
            }
          } else {
            logger.info(
              'Export receipt not found in source chain for burn hash %s',
              value.returnValues.currentBurnHash
            )
            let currentBlockTimestmap = (await this.source.web3.eth.getBlock('latest')).timestamp
            if (currentBlockTimestmap < value.returnValues.exportTimeStamp) {
              logger.info(
                'Source chain is not synced properly. Will wait and try again for burn hash %s',
                value.returnValues.currentBurnHash
              )
            } else {
              await this.validator.refuteHash(value.returnValues.currentBurnHash)
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
        // Todo: shall we check in smart contract whether tokenPorter.merkleRoots() has value for this hash?
        await this.validator.attestHash(this.source.name, value.returnValues)
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
