module.exports = Object.freeze({
  eth: {
    validationQ: 'ETHpending-validation',
    attestationQ: 'ETHpending-attestion',
    blockKey: 'eth-block'
  },
  etc: {
    validationQ: 'ETCpending-validation',
    attestationQ: 'ETCpending-attestion',
    blockKey: 'etc-block'
  },
  cronJobPattern: '*/45 * * * * *',
  retryCount: 2
})
