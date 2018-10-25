const _ = require('lodash')
const fs = require('fs')
const path = require('path')

const readFileAsString = _.memoize(function (filepath) {
  return fs.readFileSync(filepath).toString()
})

const readMetronome = _.memoize(function (filepath) {
  let chainPath = path.join(__dirname, '../abi/')

  if (filepath) {
    chainPath = filepath
  }

  let fileName = '/metronome.js'
  let chains = fs.readdirSync(chainPath)
  let metronome = {}

  chains.forEach(function (chain) {
    metronome[chain] = readFileAsString(chainPath + chain + fileName)
  })

  return metronome
})

module.exports = { readFileAsString, readMetronome }
