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

const Chain = require('./chain.js')
const QChain = require('./qChain.js')
const constant = require('./const.js')
const Queue = require('./queue')
const EventManager = require('./event-manager')
const logger = require('./logger')(__filename)
const Listener = require('./listener')

async function launch (configuration) {
  let ethChain = new Chain(configuration.eth)
  let etcChain = new Chain(configuration.etc)
  let qChain = new QChain(configuration.qtum)
  let chains = {}
  chains[constant.qtum.alias] = qChain
  chains[constant.eth.alias] = etcChain
  chains[constant.etc.alias] = ethChain
  let eventQueue = new Queue()

  let ethListener = new Listener(eventQueue, ethChain)
  let etcListener = new Listener(eventQueue, etcChain)
  let qtumListner = new Listener(eventQueue, qChain)

  let ethEventManager = new EventManager(eventQueue, chains, ethListener)
  let etcEventManager = new EventManager(eventQueue, chains, etcListener)
  let qtumEventManager = new EventManager(eventQueue, chains, qtumListner)

  ethEventManager.setupAndTriggerJob(ethListener)
  etcEventManager.setupAndTriggerJob(etcListener)
  qtumEventManager.setupAndTriggerJob(qtumListner)

  try {
    ethListener.watchImportEvent()
    etcListener.watchImportEvent()
    qtumListner.watchImportEvent()
  } catch (e) {
    logger.error('Error occurred while listening events %s', e)
  }
}

module.exports = { launch }
