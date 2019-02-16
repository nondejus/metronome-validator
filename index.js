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
  var config = { eth: {}, etc: {} }
  config.eth.chainName = 'ETH'
  config.eth.httpURL = process.env.eth_http_url
  config.eth.wsURL = process.env.eth_ws_url
  config.eth.address = process.env.eth_validator_address
  config.eth.password = process.env.eth_validator_password

  config.etc.chainName = 'ETC'
  config.etc.httpURL = process.env.etc_http_url
  config.etc.wsURL = process.env.etc_ws_url
  config.etc.address = process.env.etc_validator_address
  config.etc.password = process.env.etc_validator_password
  return config
}

init()
