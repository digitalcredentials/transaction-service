import {
  saveExchange,
  getExchangeData,
  getDIDAuthVPR,
  ExchangeError
} from './transactionManager'
import axios from 'axios'
// @ts-expect-error createPresentation is untyped
import { createPresentation } from '@digitalbazaar/vc'
import crypto from 'crypto'
import { getConfig } from './config'
import { getWorkflow } from './workflows'
import * as Handlebars from 'handlebars'
import * as https from 'https'
import { verifyDIDAuth } from './didAuth'
import { z } from 'zod'
import type { Context } from 'hono'

export const callService = async (
  endpoint: string,
  body: Record<string, unknown>
) => {
  // We're calling VPC-internal services over HTTP only.
  const agent = new https.Agent({
    rejectUnauthorized: false
  })

  const { data } = await axios.post(endpoint, body, { httpsAgent: agent })
  return data
}

const validateWorkflow = (workflowId: string) => {
  const workflow = getWorkflow(workflowId)
  if (!workflow) {
    throw new ExchangeError(404, 'Unknown workflow.')
  }
  return workflow
}

const CredentialDataSchema = z
  .object({
    vc: z
      .union([z.string(), z.object({})])
      .optional()
      .transform((vcData, ctx) => {
        if (typeof vcData !== 'string') {
          // Sets template to be a string
          try {
            return JSON.stringify(vcData)
          } catch (error) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Invalid VC data - must be a string or valid JSON object'
            })
            return z.NEVER
          }
        }
        return vcData
      }),
    subjectData: z.any().optional(),
    retrievalId: z.string({
      message:
        "Incomplete exchange data - every submitted record must have it's own retrievalId."
    }),
    redirectUrl: z.string().optional()
  })
  .refine((data) => [data.vc, data.subjectData].some((d) => d !== undefined), {
    message:
      'Incomplete exchange data - you must provide either a vc or subjectData'
  })

const ExchangeDataSchema = z
  .object({
    exchangeHost: z.string({
      message: 'Incomplete exchange data - you must provide an exchangeHost'
    }),
    tenantName: z.string({
      message: 'Incomplete exchange data - you must provide a tenant name'
    }),
    batchId: z.string().optional(),
    workflowId: z.enum(['didAuth', 'claim']).optional(),
    data: z.array(CredentialDataSchema)
  })
  .refine(
    (d) => d.data.some((dd) => dd.subjectData !== undefined) == !!d.batchId,
    {
      message:
        'Incomplete exchange data - if you provide subjectData, you must also provide a batchId'
    }
  )

/** Allows the creation of one or a batch of exchanges for a particular tenant. */
export const createExchangeBatch = async (c: Context) => {
  const config = getConfig()
  let requestData: App.ExchangeBatch
  try {
    const body = await c.req.json()
    requestData = ExchangeDataSchema.parse(body) as App.ExchangeBatch
  } catch (error) {
    if (error instanceof z.ZodError) {
      const i = error.issues[0]
      throw new ExchangeError(
        400,
        `${i.code} error at ${JSON.stringify(i.path ?? '')}: ${i.message}`
      )
    } else if (error instanceof SyntaxError) {
      throw new ExchangeError(400, 'Invalid JSON')
    }
    throw error
  }

  const exchangeRequests: App.Exchange[] = requestData.data.map((d) => {
    return {
      exchangeId: crypto.randomUUID(),
      challenge: crypto.randomUUID(),
      exchangeHost: requestData.exchangeHost,
      tenantName: requestData.tenantName,
      ttl: config.exchangeTtl,
      batchId: requestData.batchId,
      variables: {
        ...(d.vc && { vc: d.vc }),
        ...(d.redirectUrl && { redirectUrl: d.redirectUrl }),
        ...(d.subjectData && { subjectData: d.subjectData }),
        ...(d.retrievalId && { retrievalId: d.retrievalId }),
        ...(d.metadata && { metadata: d.metadata })
      },
      workflowId: requestData.workflowId ?? 'didAuth'
    }
  })

  for (const ex of exchangeRequests) {
    await saveExchange(ex)
  }
  const walletQueries = exchangeRequests.map((e) => {
    const protocols = getProtocols(e)
    return {
      iu: protocols.iu,
      retrievalId: e.variables.retrievalId,
      directDeepLink: protocols.lcw ?? '',
      vprDeepLink: protocols.lcw ?? '',
      chapiVPR: protocols.verifiablePresentationRequest,
      metadata: e.variables.metadata
    }
  })
  return c.json(walletQueries)
}

const vcApiExchangeDataSchema = z.object({
  variables: z.object({
    exchangeHost: z
      .string()
      .optional()
      .default(process.env.DEFAULT_EXCHANGE_HOST ?? 'http://localhost:4004'),
    tenantName: z.string(),
    batchId: z.string().optional(),
    vc: z.any()
  })
})

export const createExchangeVcapi = async (c: Context) => {
  // There is a legacy URL path that doesn't include the workflowId.
  const workflowId = c.req.param('workflowId') ?? 'claim'
  const workflow = validateWorkflow(workflowId)

  const data = await c.req.json()
  if (!data || !Object.keys(data).length) {
    c.status(400)
    return c.json({ code: 400, message: 'No exchange creation data provided.' })
  }
  await saveExchange(data)
  const protocols = getProtocols(data)
  return c.json(protocols)
}

export const participateInExchange = async (c: Context) => {
  const workflow = validateWorkflow(c.req.param('workflowId') ?? 'claim')
  const exchange = await getExchangeData(c.req.param('exchangeId'), workflow.id)

  const config = getConfig()
  let requestBody
  try {
    requestBody = await c.req.json()
  } catch {
    requestBody = null
  }

  if (!requestBody || !Object.keys(requestBody).length) {
    // If there is no body, this is the initial step of the exchange.
    // We will reply with a VPR to authenticate the wallet.
    const vpr = await getDIDAuthVPR(exchange)
    return c.json(vpr)
  } else {
    // This is the second step of the exchange, we will verify the DIDAuth and return the
    // previously stored data for the exchange.
    const didAuth = requestBody
    const didAuthVerified = await verifyDIDAuth({
      presentation: didAuth,
      challenge: exchange.challenge
    })

    if (!didAuthVerified) {
      c.status(401)
      return c.json({
        code: 401,
        message: 'Invalid DIDAuth.'
      })
    }

    const credentialTemplate = workflow.credentialTemplates?.[0]
    if (!credentialTemplate || exchange.workflowId == 'didAuth') {
      // TODO: this path won't be hit for now, but we eventually should support redirection to a
      // url set in exchange variables at exchange creation time.
      return c.json({
        redirectUrl: exchange.variables.redirectUrl ?? ''
      })
    }

    // The 'claim' workflow has a template that expects a `vc` variable of the built credential
    // as a string. Future more complex workflows may have more complex templates.
    let credential: App.Credential
    try {
      const builtCredential = await Handlebars.compile(
        credentialTemplate.template
      )(exchange.variables)
      credential = JSON.parse(builtCredential)
      credential.credentialSubject.id = didAuth.holder
    } catch (error) {
      c.status(400)
      return c.json({
        code: 400,
        message: 'Failed to build credential from template'
      })
    }

    // add credential status if enabled
    if (config.statusService) {
      credential = await callService(
        `${config.statusService}/credentials/status/allocate`,
        credential
      )
    }
    const signedCredential = await callService(
      `http://${config.signingService}/instance/${exchange.tenantName}/credentials/sign`,
      credential
    )
    // generate VP to return VCs
    const verifiablePresentation = createPresentation()
    verifiablePresentation.verifiableCredential = [signedCredential]

    // VC-API indicates we would wrap this in a presentation, but wallet probably doesn't expect that yet.
    return c.json({
      response: { verifiablePresentation },
      format: 'application/vc'
    })
  }
}

export const getProtocols = (exchange: App.Exchange) => {
  const verifiablePresentationRequest = getDIDAuthVPR(exchange)
  const serviceEndpoint =
    verifiablePresentationRequest.interact.service[0].serviceEndpoint ?? ''
  const protocols = {
    iu: `${serviceEndpoint}/protocols?iuv=1`,
    vcapi: serviceEndpoint,
    lcw: `https://lcw.app/request.html?issuer=issuer.example.com&auth_type=bearer&challenge=${
      exchange.challenge
    }&vc_request_url=${encodeURIComponent(serviceEndpoint)}`,
    verifiablePresentationRequest
    // TODO: add "oid4vci" support (claim workflow)
    // TODO: add "oid4vp" support for forthcoming verification workflows
  }
  return protocols
}

export const getInteractionsForExchange = async (c: Context) => {
  const exchangeData = await getExchangeData(
    c.req.param('exchangeId'),
    c.req.param('workflowId')
  )
  if (!exchangeData) {
    c.status(404)
    return c.json({
      code: 404,
      message: 'Exchange not found'
    })
  }
  const protocols = getProtocols(exchangeData)
  return c.json({ protocols })
}
