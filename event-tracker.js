
const logger = require('./lib/logger')(__filename)
var config = require('config')
// customized event tracker module. Third party services like sentry, newrelic
// can be integrated here without changing validators code
function recordCustomEvent (name, attributes) {
  try {
    // newrelic insight
    if (config.newrelic.licenseKey) {
      var newrelic = require('newrelic')
      newrelic.recordCustomEvent(name, attributes)
    }
    logger.info('record custom event. Event name %s %s', name, JSON.stringify(attributes))
  } catch (e) {
    logger.error('Error inside recordCustomEvent %s', e)
    // Do nothing
  }
}

module.exports = { recordCustomEvent }
