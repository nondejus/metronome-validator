const ethjsABI = require('ethjs-abi')
const MerkleTreeJs = require('merkletreejs')
const crypto = require('crypto')
const reader = require('../lib/file-reader')
const parser = require('../lib/parser')
const Chain = require('../lib/chain')
const config = require('config')
const ethers = require('ethers')

function waitForTx (hash, eth) {
  var receipt = eth.getTransactionReceipt(hash)
  while (receipt === null) {
    receipt = eth.getTransactionReceipt(hash)
  }
  return receipt
}

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
    configureChain(ethChain, etcChain)

    // ETC setup and init
    etcBuyer = await setupAccount(etcChain.web3)
    configureChain(etcChain, ethChain)

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
  let user = await web3.personal.newAccount('password')
  let tx = await web3.personal.unlockAccount(web3.eth.accounts[0], '')
  tx = await web3.eth.sendTransaction({ to: user, from: web3.eth.accounts[0], value: 2e17 })
  waitForTx(tx, web3.eth)
  return user
}

async function getMET (chain, recepient) {
  var web3 = chain.web3
  let currentAuction = await chain.contracts.auctions.currentAuction()
  if (currentAuction.valueOf() === '0') {
    let tx = await web3.eth.sendTransaction({
      to: chain.contracts.auctions.address,
      from: recepient,
      value: 2e16
    })
    waitForTx(tx, web3.eth)
    return
  }

  // This is for testnet-devnet .
  // If its old contracts and initial auction closed on testnet-devnet and mintable may be 0. try to get met by alternate sources i.e AC, transfer
  let metBalance = await chain.contracts.metToken.balanceOf(web3.eth.accounts[0])
  metBalance = ethers.utils.bigNumberify(web3.toHex(metBalance))
  var tx
  if (metBalance.lt(ethers.utils.bigNumberify('10000000000000000'))) {
    // buy some met transfer to new user
    tx = await web3.eth.sendTransaction({
      to: chain.contracts.auctions.address,
      from: web3.eth.accounts[0],
      value: 2e18
    })
    waitForTx(tx, web3.eth)
    metBalance = chain.contracts.metToken.balanceOf(web3.eth.accounts[0])
    metBalance = ethers.utils.bigNumberify(web3.toHex(metBalance))
    if (metBalance.lt(ethers.utils.bigNumberify('10000000000000000'))) {
      // Buy more met from AC
      tx = await chain.contracts.autonomousConverter.convertEthToMet(1, { from: web3.eth.accounts[0], value: 1e18 })
      waitForTx(tx, web3.eth)
    }
  }
  tx = await chain.contracts.metToken.enableMETTransfers({ from: web3.eth.accounts[0] })
  waitForTx(tx, web3.eth)
  tx = await chain.contracts.metToken.transfer(recepient, 1e16, { from: web3.eth.accounts[0] })
  waitForTx(tx, web3.eth)
  metBalance = await chain.contracts.metToken.balanceOf(recepient)
}
// Configure chain: Add destination chain and add validators
function configureChain (chain, destChain) {
  let destinationChain = chain.contracts.tokenPorter.destinationChains(destChain.name)
  let owner = chain.contracts.tokenPorter.owner()
  chain.web3.personal.unlockAccount(owner, 'newOwner')
  if (destinationChain === '0x0000000000000000000000000000000000000000') {
    var destTokanAddress = destChain.contracts.metToken.address
    var tx = chain.contracts.tokenPorter.addDestinationChain(destChain.name, destTokanAddress, { from: owner })
    waitForTx(tx, chain.web3.eth)
  }
  tx = chain.contracts.validator.updateThreshold(1, { from: owner })
  waitForTx(tx, chain.web3.eth)
}

// Prepare import data using export receipt
async function prepareImportData (chain, receipt) {
  let burnHashes = []
  let i = 0
  let decoder = ethjsABI.logDecoder(chain.contracts.tokenPorter.abi)
  let logExportReceipt = decoder(receipt.logs)[0]

  if (logExportReceipt.burnSequence > 15) {
    i = logExportReceipt.burnSequence - 15
  }

  while (i <= logExportReceipt.burnSequence) {
    burnHashes.push(await chain.contracts.tokenPorter.exportedBurns(i))
    i++
  }

  return {
    addresses: [
      logExportReceipt.destinationMetronomeAddr,
      logExportReceipt.destinationRecipientAddr
    ],
    burnHashes: [
      logExportReceipt.prevBurnHash,
      logExportReceipt.currentBurnHash
    ],
    importData: [
      logExportReceipt.blockTimestamp,
      logExportReceipt.amountToBurn,
      logExportReceipt.fee,
      logExportReceipt.currentTick,
      logExportReceipt.genesisTime,
      logExportReceipt.dailyMintable,
      logExportReceipt.burnSequence,
      logExportReceipt.dailyAuctionStartTime
    ],
    root: getMerkleRoot(burnHashes),
    extraData: logExportReceipt.extraData,
    supplyOnAllChains: logExportReceipt.supplyOnAllChains,
    destinationChain: logExportReceipt.destinationChain
  }
}

// Calculate merkle root for given hashes
function getMerkleRoot (hashes) {
  const leaves = hashes.map(x => Buffer.from(x.slice(2), 'hex'))
  const tree = new MerkleTreeJs(leaves, (data) => {
    return crypto
      .createHash('sha256')
      .update(data)
      .digest()
  })
  return '0x' + tree.getRoot().toString('hex')
}

module.exports = { initContracts, prepareImportData, waitForTx, getMET }
