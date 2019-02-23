module.exports = Object.freeze({
  ETH: {
    alias: 'ETH',
    validationQ: 'ETHpending-validation',
    attestationQ: 'ETHpending-attestion',
    block: 'eth-block',
    confirmationCount: 5
  },
  ETC: {
    alias: 'ETC',
    validationQ: 'ETCpending-validation',
    attestationQ: 'ETCpending-attestion',
    block: 'etc-block',
    confirmationCount: 5
  },
  qtum: {
    alias: 'qtum',
    validationQ: 'QTUMpending-validation',
    attestationQ: 'QTUMpending-attestion',
    block: 'qtum-block',
    confirmationCount: 0
  },
  cronJobPattern: '*/5 * * * * *',
  retryCount: 10
})
