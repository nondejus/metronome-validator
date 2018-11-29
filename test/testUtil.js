const ethers = require('ethers')
const MerkleTreeJs = require('merkletreejs')
const crypto = require('crypto')
const reader = require('../lib/file-reader')
const parser = require('../lib/parser')
const Chain = require('../lib/chain')
const config = require('config')

// create contract object from abi
function initContracts () {
  return new Promise(async (resolve, reject) => {
    let ethChain, etcChain, ethBuyer, etcBuyer

    config.eth.password = ''
    config.etc.password = ''

    let metronome = reader.readMetronome()
    let metronomeContracts = parser.parseMetronome(metronome)
    // create chain object to get contracts
    ethChain = new Chain(config.eth, metronomeContracts.eth)
    etcChain = new Chain(config.etc, metronomeContracts.etc)
    // ETH setup and init
    ethBuyer = await setupAccount(ethChain.web3)
    await configureChain(ethChain, etcChain)
    // ETC setup and init
    etcBuyer = await setupAccount(etcChain.web3)
    await configureChain(etcChain, ethChain)

    resolve({
      ethChain: ethChain,
      ethBuyer: ethBuyer,
      etcChain: etcChain,
      etcBuyer: etcBuyer
    })
  })
}

// Create account and send some ether in it
async function setupAccount (web3) {
  let accounts = await web3.eth.getAccounts()
  let user = await web3.eth.personal.newAccount('password')
  await web3.eth.personal.unlockAccount(accounts[0], '')
  await web3.eth.sendTransaction({
    to: user,
    from: accounts[0],
    value: 2e20
  })
  return user
}

// Configure chain: Add destination chain and add validators
async function configureChain (chain, destChain) {
  let destChainName = chain.web3.utils.toHex(destChain.name)
  let destinationChain = await chain.contracts.tokenPorter.methods
    .destinationChains(destChainName)
    .call()
    .catch(error => {
      console.log(error)
    })
  let owner = await chain.contracts.tokenPorter.methods.owner().call()
  await chain.web3.eth.personal.unlockAccount(owner, '')
  if (destinationChain === '0x0000000000000000000000000000000000000000') {
    var destTokanAddress = destChain.contracts.metToken.options.address
    await chain.contracts.tokenPorter.methods
      .addDestinationChain(destChainName, destTokanAddress)
      .send({ from: owner })
  }
  await chain.contracts.validator.methods
    .updateThreshold(1)
    .send({ from: owner })
}

// Prepare import data using export receipt
async function prepareImportData (chain, receipt) {
  let burnHashes = []
  let i = 0
  var filter = { transactionHash: receipt.transactionHash }
  var logExportReceipt = await chain.contracts.tokenPorter.getPastEvents(
    'ExportReceiptLog',
    { filter, fromBlock: receipt.blockNumber, toBlock: receipt.blockNumber }
  )
  const returnValues = logExportReceipt[0].returnValues

  if (returnValues.burnSequence > 15) {
    i = returnValues.burnSequence - 15
  }
  while (i <= returnValues.burnSequence) {
    burnHashes.push(
      await chain.contracts.tokenPorter.methods.exportedBurns(i).call()
    )
    i++
  }
  return {
    addresses: [
      returnValues.destinationMetronomeAddr,
      returnValues.destinationRecipientAddr
    ],
    burnHashes: [returnValues.prevBurnHash, returnValues.currentBurnHash],
    importData: [
      ethers.utils.bigNumberify(returnValues.blockTimestamp),
      ethers.utils.bigNumberify(returnValues.amountToBurn),
      ethers.utils.bigNumberify(returnValues.fee),
      ethers.utils.bigNumberify(returnValues.currentTick),
      ethers.utils.bigNumberify(returnValues.genesisTime),
      ethers.utils.bigNumberify(returnValues.dailyMintable),
      ethers.utils.bigNumberify(returnValues.burnSequence),
      ethers.utils.bigNumberify(returnValues.dailyAuctionStartTime)
    ],
    root: getMerkleRoot(burnHashes),
    extraData: returnValues.extraData,
    supplyOnAllChains: returnValues.supplyOnAllChains,
    destinationChain: returnValues.destinationChain
  }
}

async function getMET (chain, recepient) {
  var web3 = chain.web3
  let currentAuction = await chain.contracts.auctions.methods
    .currentAuction()
    .call()
  if (currentAuction === '0') {
    await web3.eth.sendTransaction({
      to: chain.contracts.auctions.options.address,
      from: recepient,
      value: 2e16
    })
    return
  }

  // This is for testnet-devnet .
  // If its old contracts and initial auction closed on testnet-devnet and mintable may be 0. try to get met by alternate sources i.e AC, transfer
  let accounts = await web3.eth.getAccounts()
  let metBalance = await chain.contracts.metToken.methods
    .balanceOf(accounts[0])
    .call()
  metBalance = ethers.utils.bigNumberify(metBalance)
  if (metBalance.lt(ethers.utils.bigNumberify('10000000000000000'))) {
    // buy some met transfer to new user
    await web3.eth.sendTransaction({
      to: chain.contracts.auctions.options.address,
      from: accounts[0],
      value: 2e18
    })
    metBalance = await chain.contracts.metToken.methods.balanceOf(accounts[0]).call()
    metBalance = ethers.utils.bigNumberify(metBalance)
    if (metBalance.lt(ethers.utils.bigNumberify('10000000000000000'))) {
      // Buy more met from AC
      await chain.contracts.autonomousConverter.methods
        .convertEthToMet(1)
        .send({ from: accounts[0], value: 1e18 })
    }
  }
  await chain.contracts.metToken.methods
    .enableMETTransfers()
    .send({ from: accounts[0] })
    .catch(error => {
      // Do nothing
    })
  await chain.contracts.metToken.methods
    .transfer(recepient, web3.utils.toHex(1e16))
    .send({ from: accounts[0] })
  metBalance = await chain.contracts.metToken.methods
    .balanceOf(recepient)
    .call()
}

// Calculate merkle root for given hashes
function getMerkleRoot (hashes) {
  const leaves = hashes.map(x => Buffer.from(x.slice(2), 'hex'))
  const tree = new MerkleTreeJs(leaves, data => {
    return crypto
      .createHash('sha256')
      .update(data)
      .digest()
  })
  return '0x' + tree.getRoot().toString('hex')
}

module.exports = { initContracts, prepareImportData, getMET }
