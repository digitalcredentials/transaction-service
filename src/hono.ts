import { Hono, type Context } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import { createMiddleware } from 'hono/factory'
import {
  createExchangeBatch,
  createExchangeVcapi,
  getInteractionsForExchange,
  participateInExchange
} from './exchanges.js'
import { authenticateTenantMiddleware } from './auth.js'
import { healthCheck } from './health.js'
import { HTTPException } from 'hono/http-exception'
import * as schema from './schema.js'
import { validator } from 'hono/validator'
import z from 'zod'
import { JSONObject } from 'hono/utils/types'
import { getWorkflow } from './workflows.js'
import { getConfig } from './config.js'
import { getExchangeData } from './transactionManager.js'

/**
 * Wraps a Hono handler with error handling
 * @param {Function} viewHandler - The Hono handler to wrap
 * @returns {Function} Hono middleware function
 */
const handleErrors = (err: unknown, c: Context) => {
  if (err instanceof HTTPException) {
    c.status(err.status)
    return c.json({
      code: err.status,
      message: err.message
    })
  } else if (err instanceof z.ZodError) {
    c.status(400)
    return c.json({
      code: 400,
      message: err.errors.map((e) => e.message).join(', '),
      details: err.errors
    })
  } else {
    console.error('Unexpected error:', err)
    c.status(500)
    return c.json({
      code: 500,
      message: 'An unexpected error occurred'
    })
  }
}

// Validation

const validateJson = (value: JSONObject, c: Context) => {
  // pass-through validator, will get failures if the JSON is invalid
  return value
}

const addWorkflowByParam = createMiddleware<{
  Variables: {
    workflow: App.Workflow
  }
}>(async (c, next) => {
  const param = c.req.param('workflowId')
  if (param) {
    const workflow = getWorkflow(param)
    if (!workflow) {
      throw new HTTPException(404, { message: 'Workflow not found' })
    }
    c.set('workflow', workflow)
  }
  await next()
})

// Middleware
const setConfigContext = createMiddleware<{
  Variables: {
    config: App.Config
    workflow?: App.Workflow
  }
}>(async (c, next) => {
  c.set('config', getConfig())
  await next()
})

/** A listing of all application routes */
const routes = {
  index: '/',
  healthz: '/healthz',
  exchangeBatchCreate: '/exchange',
  legacyExchangeDetail: '/exchange/:exchangeId', // This might not be used anymore if it is not referenced by the exchange creation
  exchangeCreate: '/workflows/:workflowId/exchanges',
  exchangeDetail: '/workflows/:workflowId/exchanges/:exchangeId',
  protocols: '/workflows/:workflowId/exchanges/:exchangeId/protocols'
}

export const app = new Hono()

  .notFound((c) => {
    return c.json({ code: 404, message: 'Not found' }, 404)
  })
  .onError(handleErrors)

  .use(logger())
  .use(cors())
  .use(setConfigContext)

  // Config Handler adds config to the context
  .use(async (c, next) => {
    await next()
  })

  // Basic health check
  .get(routes.index, async (c) => {
    return c.json({ message: 'transaction-service server status: ok.' })
  })

  // Extended health check
  .get(routes.healthz, healthCheck)

  /*
  This is step 1 in an exchange. Creates a new exchange and stores the provided data for later use
  in the exchange, in particular the subject data with which to later construct the VC. Returns a
  walletQuery object with both deeplinks with which to trigger wallet selection that in turn will
  trigger the exchange when the wallet opens.
  */

  // DCC draft protocol for a batch of exchanges that returns wallet queries
  .post(
    routes.exchangeBatchCreate,
    authenticateTenantMiddleware,
    validator('json', validateJson),
    async (c) => {
      const body = c.req.valid('json')
      const data = schema.exchangeBatchSchema.parse(body)
      const authEnabled = c.var.config.tenantAuthenticationEnabled
      if (
        authEnabled &&
        c.var.authTenant &&
        c.var.authTenant.tenantName !== data.tenantName
      ) {
        throw new HTTPException(401, { message: 'Unauthorized' })
      }
      c.set('workflow', getWorkflow(data.workflowId ?? 'didAuth'))
      return c.json(
        await createExchangeBatch({
          data,
          config: c.var.config,
          workflow: c.var.workflow!
        })
      )
    }
  )

  // VC-API 0.7 as of 2025-06-08 for a single exchange.
  .post(
    routes.exchangeCreate,
    authenticateTenantMiddleware,
    validator('json', validateJson),
    addWorkflowByParam,
    async (c) => {
      const inputData = c.req.valid('json')

      // Initial basic structure validation
      const data = schema.vcApiExchangeCreateSchema.parse(inputData)

      const authEnabled = c.var.config.tenantAuthenticationEnabled
      if (
        authEnabled &&
        c.var.authTenant &&
        c.var.authTenant.tenantName !== data.variables.tenantName
      ) {
        throw new HTTPException(401, { message: 'Unauthorized' })
      }

      return c.json(
        await createExchangeVcapi({
          data,
          config: c.var.config,
          workflow: c.var.workflow
        })
      )
    }
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
    routes.legacyExchangeDetail,
    validator('json', validateJson),
    async (c) => {
      c.set('workflow', getWorkflow('didAuth'))
      const exchange = await getExchangeData(
        c.req.param('exchangeId')!,
        c.var.workflow!.id
      )
      return c.json(
        await participateInExchange({
          data: null,
          config: c.var.config,
          workflow: c.var.workflow!,
          exchange
        })
      )
    }
  )

  // VC-API 0.7 as of 2025-06-08
  .post(
    routes.exchangeDetail,
    validator('json', validateJson),
    addWorkflowByParam,
    async (c) => {
      const exchange = await getExchangeData(
        c.req.param('exchangeId')!,
        c.var.workflow.id
      )
      return c.json(
        await participateInExchange({
          data: c.req.valid('json'),
          config: c.var.config,
          workflow: c.var.workflow,
          exchange
        })
      )
    }
  )

  // Get Exchange State
  .get(
    routes.exchangeDetail,
    authenticateTenantMiddleware,
    addWorkflowByParam,
    async (c) => {
      const exchange = await getExchangeData(
        c.req.param('exchangeId')!,
        c.var.workflow.id
      )
      const authEnabled = c.var.config.tenantAuthenticationEnabled
      if (
        authEnabled &&
        c.var.authTenant &&
        c.var.authTenant.tenantName !== exchange?.tenantName
      ) {
        throw new HTTPException(401, { message: 'Unauthorized' })
      }

      return c.json(exchange)
    }
  )

  /* Cross-protocol interactions object. The URL for (the exchangeHost proxy for) this endpoint is
  used in QR codes and deep links. It supplies information about the protocols that may be used to
  interact with this exchange. Eventually we'll use this URL as QR code contents for wallet to scan.
  VC-API 0.7 as of 2025-06-08: https://w3c-ccg.github.io/vc-api/#interaction-url-format
  */
  .get(routes.protocols, getInteractionsForExchange)

export type AppType = typeof app
