import { expect } from 'chai'
import request from 'supertest';
import { build } from './app.js';
import { getDataForExchangeSetupPost } from './test-fixtures/testData.js';

let app

describe('api', () => {

  beforeEach(async () => {
    app = await build();
  });

  describe('GET /', () => {
    it('GET / => hello', done => {
      request(app)
        .get("/")
        .expect(200)
        .expect('Content-Type', /json/)
        .expect(/{"message":"transaction-service server status: ok."}/, done);
    });
  })

  describe('GET /unknown', () => {
    it('unknown endpoint returns 404', done => {
      request(app)
        .get("/unknown")
        .expect(404, done)
    }, 10000);
  })

  describe('POST /exchange', () => {

    it('returns 400 if no body', done => {
      request(app)
        .post("/exchange")
        .expect('Content-Type', /json/)
        .expect(400, done)
    })

    it('returns array of wallet queries', async () => {
      const testData = getDataForExchangeSetupPost('test')
      const response = await request(app)
        .post("/exchange")
        .send(testData)

      expect(response.header["content-type"]).to.have.string("json");
      expect(response.status).to.eql(200);
      expect(response.body)
      expect(response.body.length).to.eql(testData.data.length)
    })
   
  })

  describe('GET /healthz', () => {

    it.only('returns 200 if running', async () => {
     
      const response = await request(app)
        .get("/healthz")

      expect(response.header["content-type"]).to.have.string("json");
      expect(response.status).to.eql(200);
      expect(response.body).to.eql({ message: 'transaction-service server status: ok.', healthy: true })
     
    })
  
  })

})


