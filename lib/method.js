async function call (chainName, contract, methodName, params) {
  if (chainName === 'ETH' || chainName === 'ETC' || chainName === 'eth' || chainName === 'etc') {
    let output = await contract.methods[methodName](...params).call()
    return output
  } else if (chainName === 'qtum' || chainName === 'QTUM') {
    let response = await contract.call(methodName, params)
    if (response.outputs && response.outputs.length === 1) {
      return response.outputs[0]
    } else {
      return response.outputs
    }
  }
}

module.exports = { call }
