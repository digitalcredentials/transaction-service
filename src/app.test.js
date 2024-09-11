import { expect } from 'chai'
import request from 'supertest';
import { build } from './app.js';
import { getDataForExchangeSetupPost, testVC } from './test-fixtures/testData.js';
import { getSignedDIDAuth } from './didAuth.js';

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
   

    it('returns array of wallet queries', async () => {
      const testData = getDataForExchangeSetupPost('test')
      const response = await request(app)
        .post("/exchange")
        .send(testData)
      expect(response.header["content-type"]).to.have.string("json");
      expect(response.status).to.eql(200);
      expect(response.body)
      expect(response.body.length).to.eql(testData.data.length)

      const walletQuerys = response.body
      const walletQuery = walletQuerys.find(q => q.retrievalId === 'someId')
      const url = walletQuery.directDeepLink

      const parsedDeepLink = new URL(url)
      const requestURI = parsedDeepLink.searchParams.get('vc_request_url'); //should be http://localhost:4004/exchange?challenge=VOclS8ZiMs&auth_type=bearer
      // here we need to pull out just the path
      // since we are calling the endpoint via
      // supertest
      const path = (new URL(requestURI)).pathname
      const challenge = parsedDeepLink.searchParams.get('challenge'); // the challenge that the exchange service generated 
      const didAuth = await getSignedDIDAuth('did:ex:223234', challenge)

      const exchangeResponse = await request(app)
        .post(path)
        .send(didAuth)

      expect(exchangeResponse.header["content-type"]).to.have.string("json");
      expect(exchangeResponse.status).to.eql(200);
      expect(exchangeResponse.body)

      const signedVC = exchangeResponse.body.vc
      expect(signedVC).to.eql(testVC)

    })

    

  
  })

  

})


