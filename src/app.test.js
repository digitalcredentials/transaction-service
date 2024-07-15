import { expect } from 'chai'
import request from 'supertest'
import crypto from 'crypto'
import { build } from './app.js'
import { getDataForExchangeSetupPost } from './test-fixtures/testData.js'
import { getSignedDIDAuth } from './didAuth.js'
import {
  clearKeyv,
  initializeTransactionManager
} from './transactionManager.js'
import TransactionException from './TransactionException.js'
const tempKeyvFile = process.env.PERSIST_TO_FILE
let app

describe('api', function () {
  beforeEach(async function () {
    app = await build()
  })

  describe('GET /', function () {
    it('GET / => hello', function (done) {
      request(app)
        .get('/')
        .expect(200)
        .expect('Content-Type', /json/)
        .expect(/{"message":"transaction-service server status: ok."}/, done)
    })
  })

  describe('GET /unknown', function () {
    it('unknown endpoint returns 404', function (done) {
      request(app).get('/unknown').expect(404, done)
    }, 10000)
  })

  describe('POST /exchange', function () {
    it('returns 400 if no body', function (done) {
      request(app)
        .post('/exchange')
        .expect('Content-Type', /json/)
        .expect(400, done)
    })

    it('returns array of wallet queries', async function () {
      const testData = getDataForExchangeSetupPost('test')
      const response = await request(app).post('/exchange').send(testData)

      expect(response.header['content-type']).to.have.string('json')
      expect(response.status).to.eql(200)
      expect(response.body)
      expect(response.body.length).to.eql(testData.data.length)
    })

    it('returns error if missing exchangeHost', async function () {
      const testData = getDataForExchangeSetupPost('test')
      delete testData.exchangeHost
      const response = await request(app).post('/exchange').send(testData)
      const body = response.body
      expect(response.header['content-type']).to.have.string('json')
      expect(response.status).to.eql(400)
      expect(body.code).to.eql(400)
      expect(body.message).to.eql(
        'Incomplete exchange data - you must provide an exchangeHost'
      )
    })

    it('returns error if missing tenantName', async function () {
      const testData = getDataForExchangeSetupPost('test')
      delete testData.tenantName
      const response = await request(app).post('/exchange').send(testData)
      const body = response.body
      expect(response.header['content-type']).to.have.string('json')
      expect(response.status).to.eql(400)
      expect(body.code).to.eql(400)
      expect(body.message).to.eql(
        'Incomplete exchange data - you must provide a tenant name'
      )
    })

    it('returns error if missing vc or subjectData', async function () {
      const testData = getDataForExchangeSetupPost('test')
      delete testData.data[0].vc
      const response = await request(app).post('/exchange').send(testData)
      const body = response.body
      expect(response.header['content-type']).to.have.string('json')
      expect(response.status).to.eql(400)
      expect(body.code).to.eql(400)
      expect(body.message).to.eql(
        'Incomplete exchange data - you must provide either a vc or subjectData'
      )
    })

    it('returns error if missing batchId with subjectData', async function () {
      const testData = getDataForExchangeSetupPost('test')
      delete testData.data[0].vc
      testData.data[0].subjectData = { hello: 'trouble' }
      const response = await request(app).post('/exchange').send(testData)
      const body = response.body
      expect(response.header['content-type']).to.have.string('json')
      expect(response.status).to.eql(400)
      expect(body.code).to.eql(400)
      expect(body.message).to.eql(
        'Incomplete exchange data - if you provide subjectData, you must also provide a batchId'
      )
    })

    it('returns error if missing retrievalId', async function () {
      const testData = getDataForExchangeSetupPost('test')
      delete testData.data[0].retrievalId
      const response = await request(app).post('/exchange').send(testData)
      const body = response.body
      expect(response.header['content-type']).to.have.string('json')
      expect(response.status).to.eql(400)
      expect(body.code).to.eql(400)
      expect(body.message).to.eql(
        "Incomplete exchange data - every submitted record must have it's own retrievalId."
      )
    })
  })

  describe('keyv', function () {
    before(async function () {
      clearKeyv()
      delete process.env.PERSIST_TO_FILE
      app = await build()
    })

    after(async function () {
      process.env.PERSIST_TO_FILE = tempKeyvFile
    })

    it('uses in-memory keyv', function (done) {
      request(app)
        .post('/exchange')
        .expect('Content-Type', /json/)
        .expect(400, done)
    })
  })

  describe('POST /exchange/exchangeId/transactionId', function () {
    it('returns 404 if invalid', function (done) {
      request(app)
        .post('/exchange/234/123')
        .expect('Content-Type', /json/)
        .expect(404, done)
    })
  })

  describe('POST /exchange/exchangeId', function () {
    it('returns 404 if invalid', function (done) {
      request(app)
        .post('/exchange/234')
        .expect('Content-Type', /json/)
        .expect(404, done)
    })
  })

  describe('GET /healthz', function () {
    it('returns 200 if healthy', async function () {
      const response = await request(app).get('/healthz')

      expect(response.header['content-type']).to.have.string('json')
      expect(response.status).to.eql(200)
      expect(response.body).to.eql({
        message: 'transaction-service server status: ok.',
        healthy: true
      })
    })

    it('returns 503 if internal error', async function () {
      // we delete the keyv store to force an error
      clearKeyv()
      const response = await request(app).get('/healthz')

      expect(response.header['content-type']).to.have.string('json')
      expect(response.status).to.eql(503)
      expect(response.body).to.have.property('healthy', false)
      initializeTransactionManager()
    })
  })

  describe('TransactionException', function () {
    it('sets props on Exception', function () {
      const code = 404
      const message = 'a test message'
      const stack = { test: 'test' }
      const obj = new TransactionException(code, message, stack)
      expect(obj.code).to.eql(code)
      expect(obj.message).to.eql(message)
      expect(obj.stack).to.eql(stack)
    })
  })

  describe('POST /exchange - direct', function () {
    it('does the direct exchange', async function () {
      const { path, challenge } = await doSetupWithDirectDeepLink(app)
      const didAuth = await getSignedDIDAuth('did:ex:223234', challenge)
      const exchangeResponse = await request(app).post(path).send(didAuth)
      verifyReturnedData(exchangeResponse)
    })

    it('returns error for bad didAuth', async function () {
      const { path } = await doSetupWithDirectDeepLink(app)
      // use a different challenge than was issued
      const didAuth = await getSignedDIDAuth('did:ex:223234', 'badChallenge')
      const exchangeResponse = await request(app).post(path).send(didAuth)
      expect(exchangeResponse.header['content-type']).to.have.string('json')
      expect(exchangeResponse.status).to.eql(401)
      expect(exchangeResponse.body)

      const responseErrorObject = exchangeResponse.body
      expect(responseErrorObject.code).to.eql(401)
      expect(responseErrorObject.message).to.eql('Invalid DIDAuth.')
    })

    it('does the vpr exchange', async function () {
      const walletQuery = await doSetup(app)
      const url = walletQuery.vprDeepLink

      // Step 2. mimics what the wallet would do when opened by deeplink
      // which is to parse the deeplink and call the exchange initiation endpoint
      const parsedDeepLink = new URL(url)
      const inititationURI = parsedDeepLink.searchParams.get('vc_request_url')

      // strip out the host because we are using supertest
      const initiationURIPath = new URL(inititationURI).pathname

      const initiationResponse = await request(app).post(initiationURIPath)
      expect(initiationResponse.header['content-type']).to.have.string('json')
      expect(initiationResponse.status).to.eql(200)
      expect(initiationResponse.body)

      const vpr = initiationResponse.body

      // Step 3. mimics what the wallet does once it's got the VPR
      const challenge = vpr.verifiablePresentationRequest.challenge // the challenge that the exchange service generated
      const continuationURI =
        vpr.verifiablePresentationRequest.interact.service.find(
          (service) => service.type === 'UnmediatedPresentationService2021'
        ).serviceEndpoint
      // strip out the host because we are using supertest
      const continuationURIPath = new URL(continuationURI).pathname
      const randomId = `did:ex:${crypto.randomUUID()}`
      const didAuth = await getSignedDIDAuth(randomId, challenge)

      const continuationResponse = await request(app)
        .post(continuationURIPath)
        .send(didAuth)

      verifyReturnedData(continuationResponse)
    })
  })
})

const doSetup = async (app) => {
  const testData = getDataForExchangeSetupPost('test')
  const response = await request(app).post('/exchange').send(testData)

  expect(response.header['content-type']).to.have.string('json')
  expect(response.status).to.eql(200)
  expect(response.body)
  expect(response.body.length).to.eql(testData.data.length)

  const walletQuerys = response.body
  const walletQuery = walletQuerys.find((q) => q.retrievalId === 'someId')
  return walletQuery
}

const doSetupWithDirectDeepLink = async (app) => {
  const walletQuery = await doSetup(app)
  const url = walletQuery.directDeepLink

  const parsedDeepLink = new URL(url)
  const requestURI = parsedDeepLink.searchParams.get('vc_request_url') //should be http://localhost:4004/exchange?challenge=VOclS8ZiMs&auth_type=bearer
  // here we need to pull out just the path
  // since we are calling the endpoint via
  // supertest
  const path = new URL(requestURI).pathname
  const challenge = parsedDeepLink.searchParams.get('challenge') // the challenge that the exchange service generated
  return { path, challenge }
}

const verifyReturnedData = (exchangeResponse) => {
  expect(exchangeResponse.header['content-type']).to.have.string('json')
  expect(exchangeResponse.status).to.eql(200)
  expect(exchangeResponse.body)

  const storedData = exchangeResponse.body
  expect(storedData.vc.issuer.id).to.exist
  expect(storedData.tenantName).to.eql('test')
  expect(storedData.retrievalId).to.eql('someId')
}
