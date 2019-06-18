module.exports = Object.freeze({
  eth: {
    validationQ: 'ETHpending-validation',
    attestationQ: 'ETHpending-attestion',
    blockKey: 'eth-block',
    derivepath: "m/44'/60'/0'/0/",
    hdwalletaddressindex: 0
  },
  etc: {
    validationQ: 'ETCpending-validation',
    attestationQ: 'ETCpending-attestion',
    blockKey: 'etc-block',
    derivepath: "m/44'/60'/0'/0/",
    hdwalletaddressindex: 0
  },
  cronJobPattern: '0 */10 * * * *',
  retryCount: 2
})
