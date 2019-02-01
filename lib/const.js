module.exports = Object.freeze({
  queueName: {
    ETH: {
      validationQ: 'ETHpending-validation',
      attestationQ: 'ETHpending-attestion',
      block: 'eth-block'
    },
    ETC: {
      validationQ: 'ETCpending-validation',
      attestationQ: 'ETCpending-attestion',
      block: 'etc-block'
    },
    QTUM: {
      validationQ: 'QTUMpending-validation',
      attestationQ: 'QTUMpending-attestion',
      block: 'qtum-block'
    }
  },
  confirmationCount: {
    ETH: 5,
    ETC: 10,
    QTUM: 1
  },
  cronJobPattern: '*/5 * * * * *',
  retryCount: 10
})
