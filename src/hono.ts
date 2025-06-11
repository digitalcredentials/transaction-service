import { Hono, type Context } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'

import { ExchangeError } from './transactionManager'
import {
  createExchangeBatch,
  createExchangeVcapi,
  getInteractionsForExchange,
  participateInExchange
} from './exchanges'
import { healthCheck } from './health'

/**
 * Wraps a Hono handler with error handling
 * @param {Function} viewHandler - The Hono handler to wrap
 * @returns {Function} Hono middleware function
 */
const handleErrors = (viewHandler: (c: Context) => Promise<Response>) => {
  return async (c: Context) => {
    try {
      return await viewHandler(c)
    } catch (error) {
      if (error instanceof ExchangeError) {
        c.status(error.code)
        return c.json({
          code: error.code,
          message: error.message
        })
      } else {
        console.error('Unexpected error:', error)
        c.status(500)
        return c.json({
          error: 'An unexpected error occurred'
        })
      }
    }
  }
}

export const app = new Hono()

  .notFound((c) => {
    return c.json({ code: 404, message: 'Not found' }, 404)
  })

  .use(logger())
  .use(cors())

  // Basic health check
  .get(
    '/',
    handleErrors(async (c) => {
      return c.json({ message: 'transaction-service server status: ok.' })
    })
  )

  // Extended health check
  .get(
    '/healthz',
    handleErrors(async (c) => {
      return await healthCheck(c)
    })
  )

  /*
  This is step 1 in an exchange. Creates a new exchange and stores the provided data for later use
  in the exchange, in particular the subject data with which to later construct the VC. Returns a
  walletQuery object with both deeplinks with which to trigger wallet selection that in turn will
  trigger the exchange when the wallet opens.
  */

  // DCC draft protocol for a batch of exchanges that returns wallet queries
  .post(
    '/exchange',
    handleErrors(async (c) => {
      return await createExchangeBatch(c)
    })
  )

  // VC-API 0.7 as of 2025-06-08 for a single exchange.
  .post(
    '/workflows/:workflowId/exchanges',
    handleErrors(async (c) => {
      return await createExchangeVcapi(c)
    })
  )

  /*
  This is step 2 in an exchange, where the wallet has asked to initiate the exchange, and we
  reply here with a Verifiable Presentation Request, asking for a DIDAuth. Note that in some
  scenarios the wallet may skip this step and directly present the DIDAuth.

  This also handles step 3 in the exchange, where the user presents their DIDAuth and receives
  the result.
  */
  // DCC draft protocol
  .post(
    '/exchange/:exchangeId',
    handleErrors(async (c) => {
      return await participateInExchange(c)
    })
  )

  // VC-API 0.7 as of 2025-06-08
  .post(
    '/workflows/:workflowId/exchanges/:exchangeId',
    handleErrors(async (c) => {
      return await participateInExchange(c)
    })
  )

  /* Cross-protocol interactions object. The URL for (the exchangeHost proxy for) this endpoint is
  used in QR codes and deep links. It supplies information about the protocols that may be used to
  interact with this exchange. Eventually we'll use this URL as QR code contents for wallet to scan.
  VC-API 0.7 as of 2025-06-08: https://w3c-ccg.github.io/vc-api/#interaction-url-format
  */
  .get(
    '/workflows/:workflowId/exchanges/:exchangeId/protocols',
    handleErrors(async (c) => {
      return await getInteractionsForExchange(c)
    })
  )

export type AppType = typeof app
