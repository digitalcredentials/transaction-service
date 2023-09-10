import express from 'express';
import logger from 'morgan';
import cors from 'cors';
import { initializeTransactionManager, setupExchange, retrieveStoredData, getVPR } from './transactionManager.js';

export async function build(opts = {}) {

    await initializeTransactionManager()

    var app = express();

    app.use(logger('dev'));
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    app.use(cors())

    app.get('/', function (req, res, next) {
        res.send({ message: 'transaction-service server status: ok.' })
    });

    /*
    This is step 1 in an exchange.
    Creates a new exchange and stores the provided data
    for later use in the exchange, in particular the subject data
    with which to later construct the VC.
    Returns a walletQuery object with both deeplinks
    with which to trigger wallet selection that in turn
    will trigger the exchange when the wallet opens.
    */
    app.post("/exchange",
        async (req, res) => {
            try {
                const data = req.body;
                if (!data || !Object.keys(data).length) return res.status(400).send({code: 400, message: 'No data was provided in the body.'})
                const walletQuery = await setupExchange(data)
                return res.json(walletQuery)
            } catch (error) {
                console.log(error);
                return res.status(error.code || 500).json(error);
            }
        })

   /*
    This is step 2 in an exchange, where the wallet
    has asked to initiate the exchange, and we reply
    here with a Verifiable Presentation Request, asking
    for a DIDAuth. Note that in some scenarios the wallet
    may skip this step and directly present the DIDAuth.
   */
    app.post("/exchange/:exchangeId",
        async (req, res) => {
            try {
                const vpr = await getVPR(req.params.exchangeId)
                return res.json(vpr)
            } catch (error) {
                console.log(error);
                return res.status(error.code || 500).json(error);
            }
        })

     /*
    This is step 3 in an exchange, where we verify the
    supplied DIDAuth, and if verified we return the previously 
    stored data for the exchange.
    */
    app.post("/exchange/:exchangeId/:transactionId", 
        async (req, res) => {
            try {
                const didAuth = req.body
                const data = await retrieveStoredData(req.params.exchangeId, req.params.transactionId, didAuth)
                return res.json(data)
            } catch (error) {
                console.log(error);
                return res.status(error.code || 500).json(error);
            }
        })


    return app;

}
