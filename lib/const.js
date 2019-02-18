module.exports = Object.freeze({
  eth: {
    validationQ: 'ETHpending-validation',
    attestationQ: 'ETHpending-attestion',
    blockKey: 'eth-block',
    confirmationCount: 0,
    network: 'ropsten'
  },
  etc: {
    validationQ: 'ETCpending-validation',
    attestationQ: 'ETCpending-attestion',
    blockKey: 'etc-block',
    confirmationCount: 0,
    network: 'morden'
  },
  cronJobPattern: '*/5 * * * * *',
  retryCount: 10
})
