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

const winston = require('winston')
var config = require('config')
var version = require('../package.json').version
require('winston-papertrail').Papertrail
const { combine, splat, timestamp, printf } = winston.format
const fs = require('fs')

const logDir = 'logs'

// Create the logs directory if it does not exist
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir)
}

// define the custom settings for each transport (file, console)
const options = {
  infoFile: {
    level: 'info',
    filename: 'app.log',
    dirname: logDir,
    maxsize: 10000000, // 10MB
    maxFiles: 20,
    handleExceptions: true
  },
  errorFile: {
    level: 'error',
    filename: 'error.log',
    dirname: logDir,
    maxsize: 10000000, // 10MB
    maxFiles: 20,
    handleExceptions: true
  },
  console: {
    level: 'debug',
    handleExceptions: true,
    colorize: true
  }
}

const logger = winston.createLogger({
  format: combine(
    splat(),
    timestamp(),
    printf(info => {
      return `${info.timestamp} [${info.level}] ${info.message}`
    })
  ),
  transports: [
    new winston.transports.File(options.infoFile),
    new winston.transports.File(options.errorFile),
    new winston.transports.Console(options.console),
    new winston.transports.Papertrail({
      host: config.parpertrail.host,
      port: config.parpertrail.port
    })
  ],
  exitOnError: false // do not exit on handled exceptions
})

function getModuleName (fileName) {
  let start = fileName.lastIndexOf('\\')
  const unixStart = fileName.lastIndexOf('/')
  const end = fileName.indexOf('.js')

  if (start === -1) {
    start = unixStart
  }
  return fileName.slice(start + 1, end)
}

module.exports = function (fileName) {
  var moduleName = getModuleName(fileName)
  moduleName = 'Version: ' + version + ' [' + moduleName + ']: '

  var myLogger = {
    log: function (level, msg, ...vars) {
      if (level === 'error') {
        this.error(msg, ...vars)
      } else if (level === 'warn') {
        this.warn(msg, ...vars)
      } else if (level === 'info') {
        this.info(msg, ...vars)
      } else {
        this.debug(msg, ...vars)
      }
    },
    error: function (msg, ...vars) {
      logger.error(moduleName + msg, ...vars)
    },
    warn: function (msg, ...vars) {
      logger.warn(moduleName + msg, ...vars)
    },
    info: function (msg, ...vars) {
      logger.info(moduleName + msg, ...vars)
    },
    debug: function (msg, ...vars) {
      logger.debug(moduleName + msg, ...vars)
    }
  }

  return myLogger
}
