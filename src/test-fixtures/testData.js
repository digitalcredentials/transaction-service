import testVC from './testVC.js'

const getDataForExchangeSetupPost = (
  tenantName,
  exchangeHost = 'http://localhost:4005',
  deleteWhenCollected
) => {
  const fakeData = {
    tenantName,
    exchangeHost,
    data: [
      {
        vc: testVC,
        retrievalId: 'someId',
        ...(deleteWhenCollected && { deleteWhenCollected })
      },
      {
        vc: testVC,
        retrievalId: 'blah',
        ...(deleteWhenCollected && { deleteWhenCollected })
      }
    ]
  }
  return fakeData
}

export { getDataForExchangeSetupPost, testVC }
