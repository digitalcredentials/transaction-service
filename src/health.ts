import { getConfig } from './config.js'
import { getExchangeData, saveExchange } from './transactionManager.js'
import type { Context } from 'hono'

export const healthCheck = async (c: Context) => {
  const config = getConfig()
  try {
    const timestamp = Date.now()
    const success = await saveExchange({
      exchangeId: `healthz-${timestamp}`,
      workflowId: 'healthz',
      tenantName: 'healthz',
      expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
      state: 'pending' as const,
      variables: {
        exchangeHost: '',
        challenge: ''
      }
    })

    if (!success) {
      throw new Error('Failed to save exchange to Keyv')
    }

    // Wait double the write delay to ensure the exchange is persisted
    await new Promise((resolve) =>
      setTimeout(resolve, 4 * config.keyvWriteDelayMs)
    )
    const result = await getExchangeData(`healthz-${timestamp}`, 'healthz')
    if (!result) {
      throw new Error('Failed to retrieve exchange from Keyv')
    }

    // TODO: consider checking dependency services here
    // But mock out in tests
  } catch (e) {
    console.log(`exception in healthz: ${JSON.stringify(e)}`)
    c.status(503)
    return c.json({
      error: `transaction-service healthz check failed with error: ${e}`,
      healthy: false
    })
  }
  return c.json({
    message: 'transaction-service server status: ok.',
    healthy: true
  })
}
