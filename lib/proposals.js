
const Web3 = require('web3')
var config = require('config')

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
      action: prop.returnValues.action,
      validatorAddress: prop.returnValues.newValidator,
      submittedBy: prop.returnValues.creator,
      newThreshold
    })
  }
  return proposals
}

async function createProposal (proposalContract, action, address, from) {
  console.log('Creating proposal. Waiting for tx confirmation')
  var tx
  try {
    if (action === 'add') {
      tx = await proposalContract.methods.proposeNewValidator(address, 0).send({ from, gasPrice: config.gasPrice })
    } else if (action === 'remove') {
      tx = await proposalContract.methods.proposeRemoveValidator(address, 0).send({ from, gasPrice: config.gasPrice })
    }
    await voteForProposal(proposalContract, tx.events.LogProposalCreated.returnValues.proposalId, from, true)
    console.log('Proposal created. Tx dtails', tx.events.LogProposalCreated.returnValues)
  } catch (e) {
    console.log(e)
  }
}

async function voteForProposal (proposalContract, proposalId, from, support) {
  try {
    console.log('Voting for proposal. Waiting for tx confirmation')
    var tx = await proposalContract.methods.voteForProposal(proposalId, support).send({ from, gasPrice: config.gasPrice })
    console.log('Proposal created. Tx dtails', tx)
  } catch (e) {
    console.log(e)
  }
}

module.exports = { viewProposals, createProposal, voteForProposal }
