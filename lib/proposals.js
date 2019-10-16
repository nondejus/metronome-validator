
const Web3 = require('web3')
var config = require('config')
const process = require('process')

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

async function createProposal (chain, option) {
  console.log('Creating proposal. Waiting for tx confirmation')
  var tx
  console.log('config', config)
  try {
    if (!option.walletMnemonic) {
      var unlocked = await chain.web3.eth.personal.unlockAccount(option.from, option.password)
      console.log('unlocked', unlocked)
    }
    if (option.action === 'add') {
      tx = await chain.contracts.Proposals.methods.proposeNewValidator(option.address, 0).send({ from: option.from, gasPrice: config.gasPrice })
    } else if (option.action === 'remove') {
      tx = await chain.contracts.Proposals.methods.proposeRemoveValidator(option.address, 0).send({ from: option.from, gasPrice: config.gasPrice })
    }
    // await voteForProposal(web3, proposalContract, tx.events.LogProposalCreated.returnValues.proposalId, from, true, password)
    option.proposalId = tx.events.LogProposalCreated.returnValues.proposalId
    option.support = true
    await voteForProposal(chain, option)
    console.log('Proposal created. Tx dtails', tx.events.LogProposalCreated.returnValues)
  } catch (e) {
    console.log(e)
  }
}

async function voteForProposal (chain, option) {
  // web3, proposalContract, proposalId, from, support, password, chain
  console.log('option', option)
  try {
    console.log('Voting for proposal. Waiting for tx confirmation')
    if (!option.walletMnemonic) {
      var unlocked = await chain.web3.eth.personal.unlockAccount(option.from, option.password)
      console.log('unlocked', unlocked)
    }
    var tx = await chain.contracts.Proposals.methods.voteForProposal(option.proposalId, option.support).send({ from: option.from, gasPrice: config.gasPrice })
    console.log('Proposal created. Tx dtails', tx)
  } catch (e) {
    console.log(e)
  }
}

module.exports = { viewProposals, createProposal, voteForProposal }
