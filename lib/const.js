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
    eth: 5,
    etc: 10,
    qtum: 1
  },
  cronJobPattern: '*/5 * * * * *',
  retryCount: 10
})
