module.exports = Object.freeze({
  eth: {
    alias: 'eth',
    validationQ: 'ETHpending-validation',
    attestationQ: 'ETHpending-attestion',
    blockKey: 'eth-block',
    derivepath: "m/44'/60'/0'/0/",
    hdwalletaddressindex: 0
  },
  etc: {
    alias: 'etc',
    validationQ: 'ETCpending-validation',
    attestationQ: 'ETCpending-attestion',
    blockKey: 'etc-block',
    derivepath: "m/44'/60'/0'/0/",
    hdwalletaddressindex: 0
  },
  qtum: {
    alias: 'qtum',
    validationQ: 'QTUMpending-validation',
    attestationQ: 'QTUMpending-attestion',
    block: 'qtum-block',
    derivepath: "m/44'/60'/0'/0/",
    hdwalletaddressindex: 0
  },
  cronJobPattern: '0 */2 * * * *',
  retryCount: 2
})
