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
  if (response.q2 === 'Create new proposal') {
    response = await inquirer.prompt(questions.set2)
    var action
    if (response.q1 === 'Propose to add new validator') {
      action = 'add'
    } else if (response.q1 === 'Propose to remove a validator') {
      action = 'remove'
    }
    await proposals.createProposal(chain.contracts.Proposals, action, response.q2, process.env[chain.name + '_validator_address'])
  } else if (response.q2 === 'Vote for a proposal') {
    var proposalList = await proposals.viewProposals(chain.contracts.Proposals, 4924666)
    console.log('Below is list of proposals open for vote. please select proposal which you want to vote')
    console.log(proposalList)
    response = await inquirer.prompt(prepareQuesitonSet(proposalList))
    console.log('proposal selected', response)
  }
}

async function initContract (chain) {
  var obj = { name: chain }
  var url = process.env[chain + '_http_url']
  config[chain] = { ...config[chain], ...constant[chain] }
  var provider
  if (process.env.walletMnemonic) {
    provider = new HDWalletProvider(process.env.walletMnemonic, url, config[chain].hdwalletaddressindex, 1, true, config[chain].derivepath)
  } else {
    provider = new Web3.providers.HttpProvider(url)
  }
  obj.web3 = new Web3(provider)
  obj.contracts = new MetronomeContracts(obj.web3, config[chain].network)
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
    },
    questions.set4[0]
  ]
  return set3
}

init()
