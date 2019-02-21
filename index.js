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
const constant = require('./lib/const.js')
const launcher = require('./lib/launcher')

function init () {
  program
    .option('-d, --dev', 'Run app in dev environment (without passwords)')
    .command('launch')
    .description('Launch off-chain metronome validator')
    .arguments('[eth-password] [etc-password]')
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
  var config = {}
  config.eth = preareConfig('eth')
  config.etc = preareConfig('etc')
  console.log(config)
  return config
}

function preareConfig (chain) {
  var config = constant[chain]
  config.chainName = chain.toUpperCase()
  config.httpURL = process.env[chain + '_http_url']
  config.wsURL = process.env[chain + '_ws_url']
  config.address = process.env[chain + '_validator_address']
  config.password = process.env[chain + '_validator_password']
  return config
}

init()
