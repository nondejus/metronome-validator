module.exports = Object.freeze({
  queueName: {
    eth: {
      validationQ: 'ETHpending-validation',
      attestationQ: 'ETHpending-attestion',
      block: 'eth-block'
    },
    etc: {
      validationQ: 'ETCpending-validation',
      attestationQ: 'ETCpending-attestion',
      block: 'etc-block'
    }
  },
  confirmationCount: {
    eth: 5,
    etc: 10
  },
  cronJobPattern: '*/5 * * * * *',
  retryCount: 10
})
