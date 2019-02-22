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

class EventManager {
  constructor (queue, source, destination, listener) {
    this.queue = queue
    this.source = source
    this.destination = destination
    this.validator = new Validator(source, destination)
    this.listener = listener
    this.listening = false
    this.validationQ = destination.configuration.validationQ
    this.attestationQ = destination.configuration.attestationQ
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
    var count = await this.queue.length(this.validationQ)
    var provider = this.destination.web3._provider
    console.log('provider.connectedd', provider.connected)
    // Safe check- when web3 resubscription does not happen if reconnected
    if (provider.connected) {
      if (!this.listening) {
        if (this.subscriber) {
          this.subscriber.unsubscribe()
        }
        this.listener.watchImportEvent().then((subs) => {
          this.subscriber = subs
          this.listening = true
        })
      }
    } else {
      this.listening = false
    }
    while (count > 0) {
      count--
      try {
        var value = await this.queue.pop(this.validationQ) // value is transaction receipt of an importRequest
        logger.info('Processing pending validations for value = %s', JSON.stringify(value))
        if (!value) {
          continue
        }
        let attested = await this.destination.contracts.Validator.methods.hashAttestations(value.returnValues.currentBurnHash, this.destination.configuration.address).call()
        let refuted = await this.destination.contracts.Validator.methods.hashRefutation(value.returnValues.currentBurnHash, this.destination.configuration.address).call()
        if (attested || refuted) {
          logger.info(
            'This was already attested or refuted so skipping it now %s.', JSON.stringify(value)
          )
          continue
        }
        const destBlockNumber = await this.destination.web3.eth.getBlockNumber()
        var isSafeBlockHeight = destBlockNumber >= (value.blockNumber + this.destination.configuration.confirmationCount)
        if (isSafeBlockHeight) {
          let merkleRoot = await this.destination.contracts.TokenPorter.methods.merkleRoots(value.returnValues.currentBurnHash).call()
          if (merkleRoot === '0x0000000000000000000000000000000000000000000000000000000000000000') {
            // Skiping if the event was emmitted in minor chain/soft forking scenario
            continue
          }
          let response = await this.validator.validateHash(value.returnValues.currentBurnHash)
          if (response.hashExist) {
            // Hash found in source chain
            var exportReceiptObj = response.exportReceipt[0]
            const SourceBlockNumber = await this.source.web3.eth.getBlockNumber()
            let isReadyForAttest = SourceBlockNumber >= (exportReceiptObj.blockNumber + this.source.configuration.confirmationCount)
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
            let currentBlockTimestmap = (await this.source.web3.eth.getBlock('latest')).timestamp
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
