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
 * @param {Array} data Array of data items, one per credential, with data needed for the exchange
 * @param {Object} [item.vc] optional - an unsigned populated VC
 * @param {Object} [item.subjectData] optional - data to populate a VC
 * @param {string} item.exchangeHost hostname for the exchange endpoints
 * @param {string} [item.tenantName] tenant with which to sign
 * @param {string} [item.batchId] batch to which cred belongs; also determines vc template
 * @param {string} item.retrievalId an identier for ech record, e.g., the recipient's email address
 *
 * @returns {Object} deeplink/chapi queries with which to open a wallet for this exchange
 */
export const setupExchange = async (exchangeData) => {
  verifyExchangeData(exchangeData)
  // sets up an exchange ID in keyv for each record, and returns an array of objects
  // where each object contains a choice of wallet queries for the exchange.
  // A wallet query is either a deeplink, or a VPR for use with CHAPI.
  const exchangeHost = exchangeData.exchangeHost;
  const tenantName = exchangeData.tenantName;
  const processRecord = getProcessRecordFnForExchangeHostAndTenant(exchangeHost, tenantName)
  return await Promise.all(exchangeData.data.map(processRecord))
}


/**
 * This returns the vpr as described in the
 *  "Integrating with the VC-API Exchanges workflow" section of:
 * https://chapi.io/developers/playgroundfaq/
 */
export const getDIDAuthVPR = async (exchangeId) => {
  const exchangeData = await getExchangeData(exchangeId)
  return {
    "query": {
      "type": "DIDAuthentication"
    },
    "interact": {
      "service": [
        {
          "type": "VerifiableCredentialApiExchangeService",
          "serviceEndpoint": `${exchangeData.exchangeHost}/exchange/${exchangeData.exchangeId}/${exchangeData.transactionId}`
          //   "serviceEndpoint": "https://playground.chapi.io/exchanges/eyJjcmVkZW50aWFsIjoiaHR0cHM6Ly9wbGF5Z3JvdW5kLmNoYXBpLmlvL2V4YW1wbGVzL2pmZjIvamZmMi5qc29uIiwiaXNzdWVyIjoiZGIvdmMifQ/esOGVHG8d44Q"
        },
        {
          "type": "CredentialHandlerService"
        }
      ]
    },
    "challenge": exchangeData.transactionId,
    "domain": exchangeData.exchangeHost,
  }
}

const getProcessRecordFnForExchangeHostAndTenant = (exchangeHost, tenantName) => {
  // returns a function for processing incoming records, bound to the specific exchangeHost and tenant
  return async (record) => {
    record.tenantName = tenantName
    record.exchangeHost = exchangeHost
    record.transactionId = crypto.randomUUID()
    record.exchangeId = crypto.randomUUID()

    await keyv.set(record.exchangeId, record, expiresAfter);

    // directDeepLink bypasses the VPR step and assumes the wallet knows to send a DIDAuth.
    const directDeepLink = `https://lcw.app/request.html?issuer=issuer.example.com&auth_type=bearer&challenge=${record.transactionId}&vc_request_url=${exchangeHost}/exchange/${record.exchangeId}/${record.transactionId}`

    //vprDeepLink = deeplink that calls /exchanges/${exchangeId} to initiate the exchange
    // and get back a VPR to which to then send the DIDAuth.
    const vprDeepLink = `https://lcw.app/request.html?issuer=issuer.example.com&auth_type=bearer&vc_request_url=${exchangeHost}/exchange/${record.exchangeId}`
    // 
    const chapiVPR = await getDIDAuthVPR(record.exchangeId)
    const retrievalId = record.retrievalId;

    return { retrievalId, directDeepLink, vprDeepLink, chapiVPR }
  }
}
/**
 * 
 * This is the "old" version of the vpr, which might have been superseded by the above vpr,
 * at least as described in the "Integrating with the VC-API Exchanges workflow" section of:
 * https://chapi.io/developers/playgroundfaq/
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
  const didAuthVerified = await verifyDIDAuth({ presentation: didAuthVP, challenge: storedData.transactionId })
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
 * @param {string} item.retrievalId an identier for each record, e.g., the recipient's email address
 * @throws {ExchangeIdError} Unknown exchangeID
 */
const verifyExchangeData = exchangeData => {
  const batchId = exchangeData.batchId
  if (!exchangeData.exchangeHost) {
    throw new ExchangeError("Incomplete exchange data - you must provide an exchangeHost", 400)
  }
  if (!exchangeData.tenantName) {
    throw new ExchangeError("Incomplete exchange data - you must provide a tenant name", 400)
  }
  exchangeData.data.forEach(credData => {
    if (!credData.vc || credData.subjectData) {
      throw new ExchangeError("Incomplete exchange data - you must provide either a vc or subjectData", 400)
    }
    if (credData.subjectData && !batchId) {
      throw new ExchangeError("Incomplete exchange data - if you provide subjectData, you must also provide a batchId", 400)
    }
    if (!credData.retrievalId) {
      throw new ExchangeError("Incomplete exchange data - every submitted record must have it's own retrievalId.", 400)
    }
  })
}


class ExchangeError extends Error {
  constructor(msg, code) {
    super(msg);
    this.code = code
  }
}