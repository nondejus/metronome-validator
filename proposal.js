var inquirer = require('inquirer')
const MetronomeContracts = require('metronome-contracts')
var config = require('config')
const Web3 = require('web3')
const HDWalletProvider = require('truffle-hdwallet-provider')
const process = require('process')
const constant = require('./lib/const.js')
const questions = require('./lib/questions.js')
const proposals = require('./lib/proposals.js')

async function init () {
  var response = await inquirer.prompt(questions.set1)
  var chain = await initContract(response.q1)
  var option = {}
  option.from = process.env[chain.name + '_validator_address']
  option.password = process.env[chain.name + '_validator_password']
  option.walletMnemonic = process.env[chain.name + '_walletMnemonic']
  if (response.q2 === 'Create new proposal') {
    response = await inquirer.prompt(questions.set2)

    if (response.q1 === 'Propose to add new validator') {
      option.action = 'add'
    } else if (response.q1 === 'Propose to remove a validator') {
      option.action = 'remove'
    }
    option.address = response.q2
    // await proposals.createProposal(chain.web3, chain.contracts.Proposals, action, response.q2, process.env[chain.name + '_validator_address'], process.env[chain.name + '_validator_password'])
    await proposals.createProposal(chain, option)
  } else if (response.q2 === 'Vote for a proposal') {
    var proposalList = await proposals.viewProposals(chain.contracts.Proposals, chain.birthblock)
    var myVote = await inquirer.prompt(prepareQuesitonSet(proposalList))
    console.log('Please review your vote before submitting')
    console.log(myVote.vote)
    console.log(myVote.prop)
    response = await inquirer.prompt(questions.set5)
    option.proposalId = JSON.parse(myVote.prop).proposalId
    option.support = response.confirm
    console.log('option', option)
    // await proposals.voteForProposal(chain.web3, chain.contracts.Proposals, myVote.proposalId, process.env[chain.name + '_validator_address'], response.confirm, process.env[chain.name + '_validator_password'])
    await proposals.voteForProposal(chain, option)
  }
}

async function initContract (chain) {
  var obj = { name: chain }
  var url = process.env[chain + '_http_url']
  console.log('url', url)
  config[chain] = { ...config[chain], ...constant[chain] }
  var provider
  var mnemonic = process.env[chain + '_walletMnemonic']
  if (mnemonic) {
    provider = new HDWalletProvider(mnemonic, url, config[chain].hdwalletaddressindex, 1, true, config[chain].derivepath)
  } else {
    provider = new Web3.providers.HttpProvider(url)
  }
  obj.web3 = new Web3(provider)
  obj.contracts = new MetronomeContracts(obj.web3, config[chain].network)
  obj.birthblock = MetronomeContracts[config[chain].network].METToken.birthblock
  return obj
}

function prepareQuesitonSet (proposalList) {
  var set3 = [
    {
      type: 'list',
      name: 'prop',
      message: 'Select proposal',
      choices: proposalList.map(item => {
        return JSON.stringify(item)
      })
    }
  ]
  set3 = set3.concat(questions.set4)
  return set3
}

init()
