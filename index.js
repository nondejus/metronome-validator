/*
    The MIT License (MIT)

    Copyright 2018 - 2019, Autonomous Software.

    Permission is hereby granted, free of charge, to any person obtaining
    a copy of this software and associated documentation files (the
    "Software"), to deal in the Software without restriction, including
    without limitation the rights to use, copy, modify, merge, publish,
    distribute, sublicense, and/or sell copies of the Software, and to
    permit persons to whom the Software is furnished to do so, subject to
    the following conditions:

    The above copyright notice and this permission notice shall be included
    in all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
    OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
    MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
    IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
    CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
    TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
    SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

const program = require('commander')
const process = require('process')
var config = require('config')
const constant = require('./lib/const')
const launcher = require('./lib/launcher')

function init () {
  program
    .command('launch')
    .description('Launch off-chain metronome validator')
    .action(launchValidator)

  program.parse(process.argv)

  program.args.length < 1 &&
        program.help()
}

function launchValidator (ethPassword, etcPassword) {
  // if (config.newRelic.licenseKey) {
  //   require('newrelic')
  // }
  var config = createConfigObj()
  launcher.launch(config)
}

function createConfigObj () {
  preareConfig('eth')
  preareConfig('etc')
  preareConfig('qtum')
  return config
}

function preareConfig (chain) {
  config[chain] = { ...config[chain], ...constant[chain] }
  config[chain].chainName = chain
  config[chain].httpURL = process.env[chain + '_http_url']
  config[chain].wsURL = process.env[chain + '_ws_url']
  config[chain].address = process.env[chain + '_validator_address']
  config[chain].password = process.env[chain + '_validator_password']
  config[chain].walletMnemonic = process.env.walletMnemonic
}

init()
