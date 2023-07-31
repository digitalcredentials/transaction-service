/*!
 * Copyright (c) 2023 Digital Credentials Consortium. All rights reserved.
 */
import crypto from 'crypto';
import Keyv from 'keyv';
import { verifyDIDAuth } from './didAuth.js';

let keyv;
const expiresAfter = 1000 * 60 * 10; // keyv entry expires after ten minutes

export const initializeTransactionManager = () => {
  if (!keyv) keyv = new Keyv();
}

/**
 * @param {Object} data Data needed for the exchange
 * @param {Object} [data.vc] optional - an unsigned populated VC
 * @param {Object} [data.subjectData] optional - data to populate a VC
 * @param {string} data.exchangeHost hostname for the exchange endpoints
 * @param {string} [data.tenantName] tenant with which to sign
 * @param {string} [data.batchId] batch to which cred belongs; also determines vc template
 *
 * @returns {Object} deeplink/chapi queries with which to open a wallet for this exchange
 */
export const setupExchange = async (data) => {
  
  // throws an ExchangeError if incomplete
  verifyExchangeData(data)
  
  data.transactionId = crypto.randomUUID()
  data.exchangeId = crypto.randomUUID()

  await keyv.set(data.exchangeId, data, expiresAfter);

  //const vprDeepLink = deeplink that calls /exchanges/${exchangeId} to initiate the exchange
  // and get back a VPR to which to then send the DIDAuth.
  // directDeepLink bypasses the VPR step and assumes the wallet knows to send a DIDAuth.
  const directDeepLink = `https://lcw.app/request.html?issuer=https://testIssuer.edu&challenge=${data.transactionId}&vc_request_url=${data.exchangeHost}/exchange/${data.exchangeId}/${data.transactionId}`
  const vprDeepLink = `https://lcw.app/request.html?vc_request_url=${data.exchangeHost}/exchange/${data.exchangeId}`
  return [
    { type: "directDeepLink", url: directDeepLink },
    { type: "vprDeepLink", url: vprDeepLink }
    // LATER:  {type: "chapi", query: ""}
  ]
}

/**
* @param {string} exchangeId
* @returns returns a verifiable presentation request for DIDAuth
*/
export const getVPR = async (exchangeId) => {
  const exchangeData = await getExchangeData(exchangeId)
  return {
    "verifiablePresentationRequest": {
      "query": [{ "type": "DIDAuthentication" }],
      "challenge": exchangeData.transactionId,
      "domain": exchangeData.exchangeHost,
      "interact": {
        "service": [{
          "type": "UnmediatedPresentationService2021",
          "serviceEndpoint": `${exchangeData.exchangeHost}/exchange/${exchangeData.exchangeId}/${exchangeData.transactionId}`
        }]
      }
    }
  }
}

/**
 * @param {string} exchangeId
 * @param {string} transactionId
 * @param {Object} didAuthVP
 * @throws {ExchangeError} Invalid DIDAuth
 * @returns returns stored data but only if didAuth verifies and transactionId 
 * from request param matches stored transactionId
 */
export const retrieveStoredData = async (exchangeId, transactionId, didAuthVP) => {
  const storedData = await getExchangeData(exchangeId)
  const didAuthVerified = await verifyDIDAuth({presentation: didAuthVP, challenge: storedData.transactionId})
  const transactionIdMatches = transactionId === storedData.transactionId
  if (didAuthVerified && transactionIdMatches) {
    return storedData
  } else {
    throw new ExchangeError("Invalid DIDAuth.", 401)
  }
}

/**
 * @param {string} exchangeId
 * @throws {ExchangeIdError} Unknown exchangeID
 * @returns returns stored data if exchangeId exists
 */
const getExchangeData = async exchangeId => {
  const storedData = await keyv.get(exchangeId)
  if (!storedData) throw new ExchangeError("Unknown exchangeId.", 404)
  return storedData
}

/**
 * @param {Object} data
 * @param {Object} [data.vc] optional - an unsigned populated VC
 * @param {Object} [data.subjectData] optional - data to populate a VC
 * @param {string} data.exchangeHost hostname for the exchange endpoints
 * @param {string} [data.tenantName] tenant with which to sign
 * @param {string} [data.batchId] batch to which cred belongs; also determines vc template
 * @throws {ExchangeIdError} Unknown exchangeID
 */
const verifyExchangeData = data => {
  if (! data.vc || data.subjectData ) {
    throw ExchangeError("Incomplete exchange data - you must provide either a vc or subjectData", 400)
  }
  if (! data.exchangeHost) { 
    throw ExchangeError("Incomplete exchange data - you must provide an exchangeHost", 400)
  }
  if (data.subjectData && !data.batchId) {
    throw ExchangeError("Incomplete exchange data - if you provide subjectData, you must also provide a batchId", 400)
  }
  if (!data.tenantName) {
    throw ExchangeError("Incomplete exchange data - you must provide a tenant name", 400)
  }
}


class ExchangeError extends Error {
  constructor(msg, code) {
    super(msg);
    this.code = code
  }
}