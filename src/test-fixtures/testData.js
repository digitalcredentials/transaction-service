import testVC from './testVC.js'

const getDataForExchangeSetupPost = (
  tenantName,
  exchangeHost = 'http://localhost:4005'
) => {
  const fakeData = {
    tenantName,
    exchangeHost,
    data: [
      { vc: testVC, retrievalId: 'someId' },
      { vc: testVC, retrievalId: 'blah' }
    ]
  }
  return fakeData
}

export { getDataForExchangeSetupPost, testVC }
