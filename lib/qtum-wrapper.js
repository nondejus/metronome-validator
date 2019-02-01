function transferQtumEventData (eventData) {
  eventData.address = eventData.contractAddress
  eventData.returnValues = eventData.event
  eventData.event = eventData.returnValues.type
  return eventData
}

module.exports = { transferQtumEventData }
