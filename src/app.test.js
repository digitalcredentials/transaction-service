import { expect } from 'chai'
import request from 'supertest'
import { build } from './app.js'
import { getDataForExchangeSetupPost } from './test-fixtures/testData.js'
import {
  clearKeyv,
  initializeTransactionManager
} from './transactionManager.js'

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

    it('returns 503 if not healthy', async function () {
      // we delete the keyv store to force an error
      clearKeyv()
      const response = await request(app).get('/healthz')

      expect(response.header['content-type']).to.have.string('json')
      expect(response.status).to.eql(503)
      expect(response.body).to.have.property('healthy', false)
      initializeTransactionManager()
    })
  })
})
