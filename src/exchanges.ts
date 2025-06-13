import {
  saveExchange,
  getExchangeData,
  getDIDAuthVPR
} from './transactionManager'
import axios from 'axios'
import type { Context } from 'hono'
// @ts-expect-error createPresentation is untyped
import { createPresentation } from '@digitalbazaar/vc'
import crypto from 'crypto'
import Handlebars from 'handlebars'
import { HTTPException } from 'hono/http-exception'
import * as https from 'https'
import * as schema from './schema'
import { verifyDIDAuth } from './didAuth'

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

/** Allows the creation of one or a batch of exchanges for a particular tenant. */
export const createExchangeBatch = async ({
  data,
  config,
  workflow
}: {
  data: App.ExchangeBatch
  config: App.Config
  workflow: App.Workflow
}) => {
  const exchangeRequests: App.ExchangeDetail[] = data.data.map((d) => {
    return {
      exchangeId: crypto.randomUUID(),
      tenantName: data.tenantName,
      expires: new Date(Date.now() + config.exchangeTtl * 1000).toISOString(),
      batchId: data.batchId,
      variables: {
        challenge: crypto.randomUUID(),
        exchangeHost: data.exchangeHost,
        ...(d.vc && { vc: d.vc }),
        ...(d.redirectUrl && { redirectUrl: d.redirectUrl }),
        ...(d.subjectData && { subjectData: d.subjectData }),
        ...(d.retrievalId && { retrievalId: d.retrievalId }),
        ...(d.metadata && { metadata: d.metadata })
      },
      workflowId: workflow.id,
      state: 'pending'
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
  return walletQueries
}

export const createExchangeVcapi = async ({
  data,
  config,
  workflow
}: {
  data: App.ExchangeCreateInput
  config: App.Config
  workflow: App.Workflow
}) => {
  const inputData = schema.vcApiExchangeCreateSchema.parse(data)

  const exchange: App.ExchangeDetail = {
    ...inputData,
    workflowId: workflow.id,
    tenantName: data.variables.tenantName,
    exchangeId: crypto.randomUUID(),
    variables: {
      ...inputData.variables,
      challenge: crypto.randomUUID()
    },
    expires:
      inputData.expires ??
      new Date(Date.now() + config.exchangeTtl * 1000).toISOString(),
    state: 'pending'
  }

  await saveExchange(exchange)
  return getProtocols(exchange)
}

export const participateInExchange = async ({
  data,
  config,
  workflow,
  exchange
}: {
  data: any
  config: App.Config
  workflow: App.Workflow
  exchange: App.ExchangeDetail
}) => {
  if (!data || !Object.keys(data).length) {
    // If there is no body, this is the initial step of the exchange.
    // We will reply with a VPR to authenticate the wallet.
    const vpr = await getDIDAuthVPR(exchange)
    return vpr
  } else {
    // This is the second step of the exchange, we will verify the DIDAuth and return the
    // previously stored data for the exchange.
    const didAuthVerified = await verifyDIDAuth({
      presentation: data,
      challenge: exchange.variables.challenge
    })

    if (!didAuthVerified) {
      throw new HTTPException(401, {
        message: 'Invalid DIDAuth.'
      })
    }

    const credentialTemplate = workflow?.credentialTemplates?.[0]
    if (!credentialTemplate || exchange.workflowId == 'didAuth') {
      // TODO: this path won't be hit for now, but we eventually should support redirection to a
      // url set in exchange variables at exchange creation time.
      return {
        redirectUrl: exchange.variables.redirectUrl ?? ''
      }
    }

    // The 'claim' workflow has a template that expects a `vc` variable of the built credential
    // as a string. Future more complex workflows may have more complex templates.
    let credential: App.Credential
    try {
      const builtCredential = await Handlebars.compile(
        credentialTemplate.template
      )(exchange.variables)
      credential = JSON.parse(builtCredential)
      credential.credentialSubject.id = data.holder
    } catch (error) {
      throw new HTTPException(400, {
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
      `${config.signingService}/instance/${exchange.tenantName}/credentials/sign`,
      credential
    )
    // generate VP to return VCs
    const verifiablePresentation = createPresentation()
    verifiablePresentation.verifiableCredential = [signedCredential]

    // VC-API indicates we would wrap this in a presentation, but wallet probably doesn't expect that yet.
    return verifiablePresentation
  }
}

export const getProtocols = (exchange: App.ExchangeDetail) => {
  const verifiablePresentationRequest = getDIDAuthVPR(exchange)
  const serviceEndpoint =
    verifiablePresentationRequest.interact.service[0].serviceEndpoint ?? ''
  const protocols = {
    iu: `${serviceEndpoint}/protocols?iuv=1`,
    vcapi: serviceEndpoint,
    // TODO issuer shouldn't be hardcoded. Where can we get the issuer DID value for the tenant?
    // Wallet doesn't seem to reject this hardcoded issuer.
    lcw: `https://lcw.app/request.html?issuer=issuer.example.com&auth_type=bearer&challenge=${
      exchange.variables.challenge
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
