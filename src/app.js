import express from 'express';
import logger from 'morgan';
import cors from 'cors';
import { initializeTransactionManager, createTransaction, verifyTransaction } from './transactionManager.js';

export async function build(opts = {}) {

    await initializeTransactionManager()
    
    var app = express();

    app.use(logger('dev'));
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    app.use(cors())

    app.get('/', function (req, res, next) {
        res.send({ message: 'transaction-manager-service server status: ok.' })
    });

    app.post("/create", 
        async (req, res) => {
            try {
                const data = req.body;
                const challenge = await createTransaction(data)
                return res.json(challenge)
            } catch (error) {
                console.log(error);
                return res.status(403).json(error);
            }
        })

      app.get("/verify", 
        async (req, res) => {
            try {
                const challenge = req.query.challenge 
                const data = await verifyTransaction(challenge)
                return res.json(data)      
            } catch (error) {
                console.log(error);
                return res.status(500).json(error);
            }
        })
    return app;

}
