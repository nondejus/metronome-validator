module.exports = Object.freeze({
  set1: [
    {
      type: 'list',
      name: 'q1',
      message: 'Select chain',
      choices: [ {
        key: '1',
        value: 'eth'
      },
      {
        key: '2',
        value: 'etc'
      }]
    },
    {
      type: 'list',
      name: 'q2',
      message: 'What do you want do',
      choices: [{
        key: '1',
        value: 'Vote for a proposal'
      },
      {
        key: '2',
        value: 'Create new proposal'
      }]
    }
  ],
  set2: [
    {
      type: 'list',
      name: 'q1',
      message: 'Select',
      choices: [ {
        key: 'a',
        value: 'Propose to add new validator'
      },
      {
        key: 'b',
        value: 'Propose to remove a validator'
      }]
    },
    {
      type: 'input',
      name: 'q2',
      message: 'Enter validator address'
    }
  ],
  set4: [
    {
      type: 'list',
      name: 'vote',
      message: 'Vote for selected proposal',
      choices: ['I support this proposal', 'I oppose this proposal']
    }
  ],
  set5: [
    {
      type: 'confirm',
      name: 'confirm',
      message: 'You have voted for above proposal. Please review it once. Okay to proceed now?'
    }]
}
)
