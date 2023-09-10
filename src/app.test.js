import { expect } from 'chai'
import request from 'supertest';
import { build } from './app.js';

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


   
    

  
  })

  

})


