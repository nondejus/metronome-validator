module.exports = Object.freeze({
  eth: {
    alias: 'eth',
    validationQ: 'ETHpending-validation',
    attestationQ: 'ETHpending-attestion',
    blockKey: 'eth-block'
  },
  etc: {
    alias: 'etc',
    validationQ: 'ETCpending-validation',
    attestationQ: 'ETCpending-attestion',
    blockKey: 'etc-block'
  },
  qtum: {
    alias: 'qtum',
    validationQ: 'QTUMpending-validation',
    attestationQ: 'QTUMpending-attestion',
    block: 'qtum-block'
  },
  cronJobPattern: '*/5 * * * * *',
  retryCount: 2
})
