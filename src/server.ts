import { app } from './hono.js'
import { getConfig } from './config.js'
import { serve } from '@hono/node-server'
import { initializeTransactionManager } from './transactionManager.js'

const run = async () => {
  const config = getConfig()
  const port = config.port
  await initializeTransactionManager()

  console.log(`Server running on port ${port}`)
  serve({
    fetch: app.fetch,
    port
  })
}

run()
