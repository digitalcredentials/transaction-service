import { expect, test, describe, beforeAll, afterAll, vi } from 'vitest'
import { testClient } from 'hono/testing'
import axios from 'axios'
import crypto from 'crypto'
import { app, type AppType } from './hono.js'
import { getDataForExchangeSetupPost } from './test-fixtures/testData.js'
import { getSignedDIDAuth } from './didAuth.js'
import {
  saveExchange,
  initializeTransactionManager
} from './transactionManager.js'
import * as transactionManager from './transactionManager.js'
import * as config from './config.js'

import { HTTPException } from 'hono/http-exception'

describe('api', function () {
  const client = testClient<AppType>(app)

  describe('GET /', function () {
    test('GET / => hello', async function () {
      const response = await client.index.$get()
      expect(response.status).toBe(200)
      expect(await response.text()).toContain(
        '{"message":"transaction-service server status: ok."}'
      )
    })
  })

  describe('GET /unknown', function () {
    test('unknown endpoint returns 404', async function () {
      const response = await app.request('/unknown')
      expect(response.status).toBe(404)
    })
  })

  describe('POST /exchange', function () {
    test('returns 400 if no body', async function () {
      const response = await await app.request('/exchange', {
        method: 'POST'
      })
      expect(response.status).toBe(400)
      expect(response.headers.get('content-type')).toContain('json')
    })

    test('returns 400 if invalid JSON', async function () {
      const response = await await app.request('/exchange', {
        method: 'POST',
        body: '{"invalid/json$',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(response.status).toBe(400)
      const body = (await response.json()) as unknown as App.ErrorResponseBody
      expect(response.headers.get('content-type')).toContain('json')
      expect(body.code).toBe(400)
      expect(body.message).toContain('Malformed JSON')
    })

    test('returns array of wallet queries', async function () {
      const testData = getDataForExchangeSetupPost('default')
      const response = await client.exchange.$post({
        json: testData
      })
      const body = (await response.json()) as any
      expect(response.headers.get('content-type')).toContain('json')
      expect(response.status).toBe(200)

      expect(body).toBeDefined()
      expect(body.length).toBe(testData.data.length)
    })

    test('successful DID auth exchange from batch creation', async function () {
      const testData = getDataForExchangeSetupPost('default')
      const response = await client.exchange.$post({ json: testData })
      expect(response.headers.get('content-type')).toContain('json')
      const body = (await response.json()) as any
      expect(response.status).toBe(200)

      expect(body).toBeDefined()
      expect(body.length).toBe(testData.data.length)

      const walletQuerys = body as App.DCCWalletQuery[]
      const walletQuery = walletQuerys.find((q) => q.retrievalId === 'someId')
      expect(walletQuery).toBeDefined()
      const url = walletQuery?.vprDeepLink ?? ''

      const parsedDeepLink = new URL(url)
      //should be http://localhost:4004/exchange?challenge=VOclS8ZiMs&auth_type=bearer
      const requestURI = parsedDeepLink.searchParams.get('vc_request_url') ?? ''
      // here we need to pull out just the path
      // since we are calling the endpoint via
      // supertest
      const path = new URL(requestURI).pathname
      // the challenge that the exchange service generated
      const challenge = parsedDeepLink.searchParams.get('challenge') ?? ''
      const didAuth = await getSignedDIDAuth(challenge)

      const exchangeResponse = await app.request(path, {
        method: 'POST',
        body: JSON.stringify(didAuth),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      expect(exchangeResponse.headers.get('content-type')).toContain('json')
      const exchangeBody = await exchangeResponse.json()
      expect(exchangeResponse.status).toBe(200)
      expect(exchangeBody).toBeDefined()
      // the didAuth exchange should not return a VC (and really this endpoint should return a VP, not a VC eh?)
      expect(exchangeBody.vc).toEqual(undefined)
    })

    test('returns error if missing exchangeHost', async function () {
      const { exchangeHost, ...testData } = getDataForExchangeSetupPost('test')
      const response = await app.request('/exchange', {
        method: 'POST',
        body: JSON.stringify(testData),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const body = await response.json()
      expect(response.headers.get('content-type')).toContain('json')
      expect(response.status).toBe(400)
      expect(body.code).toBe(400)
      expect(body.message).toContain(
        'Incomplete exchange data - you must provide an exchangeHost'
      )
    })

    test('returns error if missing tenantName', async function () {
      const { tenantName, ...testData } = getDataForExchangeSetupPost('test')
      const response = await app.request('/exchange', {
        method: 'POST',
        body: JSON.stringify(testData),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const body = await response.json()
      expect(response.headers.get('content-type')).toContain('json')
      expect(response.status).toBe(400)
      expect(body.code).toBe(400)
      expect(body.message).toContain(
        'Incomplete exchange data - you must provide a tenant name'
      )
    })

    test('returns error if missing vc or subjectData', async function () {
      const testData = getDataForExchangeSetupPost('test')
      // @ts-ignore
      delete testData.data[0].vc
      const response = await app.request('/exchange', {
        method: 'POST',
        body: JSON.stringify(testData),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const body = await response.json()
      expect(response.headers.get('content-type')).toContain('json')
      expect(response.status).toBe(400)
      expect(body.code).toBe(400)
      expect(body.message).toContain(
        'Incomplete exchange data - you must provide either a vc or subjectData'
      )
    })

    test('returns error if missing batchId with subjectData', async function () {
      const testData = getDataForExchangeSetupPost('test') as App.ExchangeBatch
      // @ts-ignore
      delete testData.data[0].vc
      testData.data[0].subjectData = { hello: 'trouble' }
      const response = await app.request('/exchange', {
        method: 'POST',
        body: JSON.stringify(testData),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const body = await response.json()
      expect(response.headers.get('content-type')).toContain('json')
      expect(response.status).toBe(400)
      expect(body.code).toBe(400)
      expect(body.message).toContain(
        'Incomplete exchange data - if you provide subjectData, you must also provide a batchId'
      )
    })

    test('returns error if missing retrievalId', async function () {
      const testData = getDataForExchangeSetupPost('test')
      // @ts-ignore
      delete testData.data[0].retrievalId
      const response = await app.request('/exchange', {
        method: 'POST',
        body: JSON.stringify(testData),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const body = await response.json()
      expect(response.headers.get('content-type')).toContain('json')
      expect(response.status).toBe(400)
      expect(body.code).toBe(400)
      expect(body.message).toContain(
        "Incomplete exchange data - every submitted record must have it's own retrievalId."
      )
    })
  })

  describe('keyv', function () {
    beforeAll(async function () {
      // Mock saveExchange to throw an error
      vi.spyOn({ saveExchange }, 'saveExchange').mockImplementation(
        async () => {
          throw new HTTPException(500, { message: 'Failed to save exchange.' })
        }
      )
    })

    afterAll(async function () {
      vi.restoreAllMocks()
      await initializeTransactionManager()
    })

    test('uses in-memory keyv', async function () {
      const response = await app.request('/exchange', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(response.headers.get('Content-Type')).toContain('json')
      expect(response.status).toBe(400)
    })
  })

  describe('participateInExchange: POST /workflows/:workflowId/exchanges/:exchangeId', function () {
    test('returns 404 if invalid workflowId', async function () {
      const response = await app.request(
        '/workflows/NO-SUCH-WORKFLOW/exchanges/123',
        {
          method: 'POST'
        }
      )
      expect(response.headers.get('Content-Type')).toContain('json')
      const body = await response.json()
      expect(response.status).toBe(404)
      expect(body.code).toBe(404)
    })
  })

  describe('POST /exchange/exchangeId', function () {
    test('returns 404 if invalid exchangeId', async function () {
      const response = await app.request(
        '/workflows/didAuth/exchanges/NO-SUCH-EXCHANGE',
        {
          method: 'POST'
        }
      )
      expect(response.headers.get('Content-Type')).toContain('json')
      const body = await response.json()
      expect(response.status).toBe(404)
      expect(body.code).toBe(404)
      expect(body.message).toBe('Unknown exchangeId.')
    })
  })

  describe('GET /healthz', function () {
    test('returns 200 if healthy', async function () {
      const response = await client.healthz.$get()

      expect(response.headers.get('content-type')).toContain('json')
      const body = await response.json()
      expect(response.status).toBe(200)

      expect(body).toEqual({
        message: 'transaction-service server status: ok.',
        healthy: true
      })
    })

    test('returns 503 if internal error', async function () {
      // we delete the keyv store to force an error
      const spy = vi
        .spyOn(transactionManager, 'saveExchange')
        .mockImplementation(async () => {
          throw new HTTPException(500, { message: 'Failed to save exchange.' })
        })
      const response = await client.healthz.$get()

      expect(response.headers.get('content-type')).toContain('json')
      expect(response.status).toBe(503)
      const body = await response.json()
      expect(body).toHaveProperty('healthy', false)
      vi.restoreAllMocks()
      initializeTransactionManager()
    })
  })

  describe('POST /exchange - direct', function () {
    beforeAll(() => {
      // mock the signing service api call to return not much.
      vi.spyOn(axios, 'post').mockImplementation(() =>
        Promise.resolve({ data: {} })
      ) // signing

      const currentConfig = config.getConfig()
      vi.spyOn(config, 'getConfig').mockImplementation(() => {
        return {
          ...currentConfig,
          statusService: '',
          tenantAuthenticationEnabled: false
        }
      })
    })

    afterAll(() => {
      vi.restoreAllMocks()
    })

    test('does the direct exchange', async function () {
      const { path, challenge } = await doSetupWithDirectDeepLink(app)
      const didAuth = await getSignedDIDAuth(challenge)
      const exchangeResponse = await app.request(path, {
        method: 'POST',
        body: JSON.stringify(didAuth),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const body = await exchangeResponse.json()
      expect(body).toBeDefined()
      expect(body.redirectUrl).toBe('')
    })

    test('returns error for bad didAuth', async function () {
      const { path } = await doSetupWithDirectDeepLink(app)
      // use a different challenge than was issued
      const didAuth = await getSignedDIDAuth('badChallenge')
      const exchangeResponse = await app.request(path, {
        method: 'POST',
        body: JSON.stringify(didAuth),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(exchangeResponse.headers.get('content-type')).toContain('json')
      const body = await exchangeResponse.json()
      expect(exchangeResponse.status).toBe(401)
      expect(body).toBeDefined()
      expect(body.code).toBe(401)
      expect(body.message).toBe('Invalid DIDAuth or unsupported options.')
    })

    test('does the VPR exchange for DID Auth', async function () {
      const walletQuery = await doSetup(app)
      const url = walletQuery?.vprDeepLink ?? ''

      // Step 2. mimics what the wallet would do when opened by deeplink
      // which is to parse the deeplink and call the exchange initiation endpoint
      const parsedDeepLink = new URL(url)
      const inititationURI =
        parsedDeepLink.searchParams.get('vc_request_url') ?? ''

      // strip out the host because we are using supertest
      const initiationURIPath = new URL(inititationURI).pathname

      const initiationResponse = await app.request(initiationURIPath, {
        method: 'POST' // empty body to initiate a VC-API exchange
      })
      expect(initiationResponse.headers.get('content-type')).toContain('json')
      const vpr = (await initiationResponse.json())
        ?.verifiablePresentationRequest as App.VPR
      expect(initiationResponse.status).toBe(200)

      expect(vpr).toBeDefined()

      // Step 3. mimics what the wallet does once it's got the VPR
      const challenge = vpr.challenge // the challenge that the exchange service generated
      const continuationURI =
        vpr.interact.service.find(
          (service) => service.type === 'UnmediatedPresentationService2021'
        )?.serviceEndpoint ?? ''
      // strip out the host because we are using supertest
      const continuationURIPath = new URL(continuationURI).pathname
      const randomId = `did:ex:${crypto.randomUUID()}`
      const didAuth = await getSignedDIDAuth(challenge, randomId)

      const continuationResponse = await app.request(continuationURIPath, {
        method: 'POST',
        body: JSON.stringify(didAuth),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      // Verify the response structure
      expect(continuationResponse.headers.get('Content-Type')).toContain('json')
      expect(continuationResponse.status).toBe(200)
      const body = await continuationResponse.json()
      expect(body).toBeDefined()

      // First verify the basic structure
      expect(body.redirectUrl).toBe('')
    })

    test('does the VPR exchange for credential issuance', async function () {
      const walletQuery = await doSetup(app, 'claim')
      const url = walletQuery?.vprDeepLink ?? ''

      // Step 2. mimics what the wallet would do when opened by deeplink
      // which is to parse the deeplink and call the exchange initiation endpoint
      const parsedDeepLink = new URL(url)
      const inititationURI =
        parsedDeepLink.searchParams.get('vc_request_url') ?? ''

      // strip out the host because we are using supertest
      const initiationURIPath = new URL(inititationURI).pathname

      const initiationResponse = await app.request(initiationURIPath, {
        method: 'POST'
      })
      expect(initiationResponse.headers.get('content-type')).toContain('json')
      const vpr = (await initiationResponse.json())
        ?.verifiablePresentationRequest as App.VPR
      expect(initiationResponse.status).toBe(200)
      expect(vpr).toBeDefined()

      // Step 3. mimics what the wallet does once it's got the VPR
      const challenge = vpr.challenge // the challenge that the exchange service generated
      const continuationURI =
        vpr.interact.service.find(
          (service) => service.type === 'UnmediatedPresentationService2021'
        )?.serviceEndpoint ?? ''
      // strip out the host because we are using supertest
      const continuationURIPath = new URL(continuationURI).pathname
      const randomId = `did:ex:${crypto.randomUUID()}`
      const didAuth = await getSignedDIDAuth(challenge, randomId)

      const continuationResponse = await app.request(continuationURIPath, {
        method: 'POST',
        body: JSON.stringify(didAuth),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      // Verify the response structure
      expect(continuationResponse.headers.get('Content-Type')).toContain('json')
      const body = await continuationResponse.json()
      expect(continuationResponse.status).toBe(200)
      expect(body).toBeDefined()

      // First verify the basic structure
      expect(body.redirectUrl).toBeUndefined()
      expect(body.type).toBeDefined() // ["VerifiablePresentation"]
      expect(body.verifiableCredential).toBeDefined()
      expect(body.verifiableCredential.length).toBe(1) // It will just be the mocked {}
    })
  })
})

const doSetup = async (app: AppType, workflowId = 'didAuth') => {
  const testData = getDataForExchangeSetupPost(
    'default',
    'http://localhost:4005',
    workflowId
  )
  const response = await app.request('/exchange', {
    method: 'POST',
    body: JSON.stringify(testData),
    headers: {
      'Content-Type': 'application/json'
    }
  })

  expect(response.headers.get('content-type')).toContain('json')
  const body = await response.json()
  expect(response.status).toBe(200)
  expect(body).toBeDefined()
  expect(body.length).toBe(testData.data.length)

  const walletQuerys = body as App.DCCWalletQuery[]
  const walletQuery = walletQuerys.find((q) => q.retrievalId === 'someId')
  return walletQuery
}

const doSetupWithDirectDeepLink = async (app: AppType) => {
  const walletQuery = await doSetup(app)
  const url = walletQuery?.directDeepLink ?? ''

  const parsedDeepLink = new URL(url)
  const requestURI = parsedDeepLink.searchParams.get('vc_request_url') ?? '' //should be http://localhost:4004/exchange?challenge=VOclS8ZiMs&auth_type=bearer
  // here we need to pull out just the path
  // since we are calling the endpoint via
  // supertest
  const path = new URL(requestURI).pathname
  const challenge = parsedDeepLink.searchParams.get('challenge') ?? '' // the challenge that the exchange service generated
  return { path, challenge }
}
