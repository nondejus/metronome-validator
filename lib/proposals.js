
const Web3 = require('web3')

async function viewProposals (proposalContract, fromBlock) {
  var events = await proposalContract.getPastEvents('LogProposalCreated', { fromBlock, toBlock: 'latest' })
  var web3 = new Web3()
  var proposals = []
  for (let prop of events) {
    var action = prop.returnValues.action
    var newThreshold
    if (action === web3.utils.padRight(web3.utils.fromAscii('addval'), 64)) {
      prop.returnValues.action = 'Add new validator'
    } else if (action === web3.utils.padRight(web3.utils.fromAscii('removeval'), 64)) {
      prop.returnValues.action = 'Remove a validator'
    } else if (action === web3.utils.padRight(web3.utils.fromAscii('updatethreshold'), 64)) {
      prop.returnValues.action = 'Update threshold'
      newThreshold = prop.returnValues.newThreshold
    }
    proposals.push({ proposalId: prop.returnValues.proposalId,
      validatorAddress: prop.returnValues.newValidator,
      submittedBy: prop.returnValues.creator,
      // expiryDate: new Date(prop.returnValues.expiry * 1000),
      action: prop.returnValues.action,
      newThreshold
    })
  }
  return proposals
}

async function createProposal (proposalContract, action, address, from) {
  console.log('from', from)
  if (action === 'add') {
    try {
      var tx = await proposalContract.methods.proposeNewValidator(address, 0).send({ from, gasPrice: 30000000000 })
      var proposalId = tx.events.LogProposalCreated.returnValues.proposalId
      console.log('proposalId', proposalId)
      tx = await proposalContract.methods.voteForProposal(proposalId, true).send({ from, gasPrice: 30000000000 })
    } catch (e) {
      console.log(e)
    }
  } else {

  }
}

module.exports = { viewProposals, createProposal }
