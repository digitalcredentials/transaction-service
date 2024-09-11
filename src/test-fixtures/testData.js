import testVC from './testVC.js';

const getDataForExchangeSetupPost = (tenantName) => {
  const fakeData = {
    tenantName,
    exchangeHost: 'http://localhost:4005',
    data: [
      { vc: testVC, retrievalId: 'someId',  },
      { vc: testVC, retrievalId: 'blah' }
    ]
  }
  return fakeData
}

export { getDataForExchangeSetupPost, testVC }
