import testVC from './testVC.js'

const getDataForExchangeSetupPost = (
  tenantName: string,
  exchangeHost = 'http://localhost:4005',
  workflowId = 'didAuth'
) => {
  const fakeData: App.ExchangeBatch = {
    tenantName,
    workflowId,
    exchangeHost,
    data: [
      { vc: JSON.stringify(testVC), retrievalId: 'someId' },
      { vc: JSON.stringify(testVC), retrievalId: 'blah' }
    ]
  }
  return fakeData
}

export { getDataForExchangeSetupPost, testVC }
