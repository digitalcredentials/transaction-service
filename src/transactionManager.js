/*!
 * Copyright (c) 2023 Digital Credentials Consortium. All rights reserved.
 */
import crypto from 'crypto'
import Keyv from 'keyv'
import { KeyvFile } from 'keyv-file'
import { verifyDIDAuth } from './didAuth.js'

const persistToFile = process.env.PERSIST_TO_FILE
const defaultTimeToLive = (process.env.DEFAULT_TTL = 1000 * 60 * 10) // keyv entry expires after ten minutes

let keyv

/**
 * Intializes the keyv store either in-memory or in file system, according to env.
 */
export const initializeTransactionManager = () => {
  if (!keyv) {
    if (persistToFile) {
      keyv = new Keyv({
        store: new KeyvFile({
          filename: persistToFile, // the file path to store the data
          expiredCheckDelay: 4 * 3600 * 1000, // ms (so every 4 hours) how often to check for and remove expired records
          writeDelay: 100, // ms, batch write to disk in a specific duration, enhance write performance.
          encode: JSON.stringify, // serialize function
          decode: JSON.parse // deserialize function
        })
      })
    } else {
      keyv = new Keyv()
    }
  }
}

/**
 * @param {Array} exchangeData Array of data items, one per credential, with data needed for the exchange
 * @param {Object} [exchangeData.data[].vc] optional - an unsigned populated VC
 * @param {Object} [exchangeData.data[].subjectData] optional - data to populate a VC
 * @param {string} exchangeData.exchangeHost hostname for the exchange endpoints
 * @param {string} exchangeData.tenantName tenant with which to sign
 * @param {string} exchangeData.batchId batch to which cred belongs; also determines vc template
 * @param {string} exchangeData.data[].retrievalId an identier for ech record, e.g., the recipient's email address
 * @param {Object} exchangeData.data[].metadata anything else we want to store in the record for later use
 * @returns {Object} deeplink/chapi queries with which to open a wallet for this exchange, as well as whatever is in metadata
 */
export const setupExchange = async (exchangeData) => {
  verifyExchangeData(exchangeData)
  // sets up an exchange ID in keyv for each record, and returns an array of objects
  // where each object contains a choice of wallet queries for the exchange.
  // A wallet query is either a deeplink, or a VPR for use with CHAPI.
  // Each object also contains whatever 'metadata' had been supplied
  const exchangeHost = exchangeData.exchangeHost
  const tenantName = exchangeData.tenantName
  const processRecord = bindProcessRecordFnToExchangeHostAndTenant(
    exchangeHost,
    tenantName
  )
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
    query: {
      type: 'DIDAuthentication'
    },
    interact: {
      service: [
        {
          type: 'VerifiableCredentialApiExchangeService',
          serviceEndpoint: `${exchangeData.exchangeHost}/exchange/${exchangeData.exchangeId}/${exchangeData.transactionId}`
          //   "serviceEndpoint": "https://playground.chapi.io/exchanges/eyJjcmVkZW50aWFsIjoiaHR0cHM6Ly9wbGF5Z3JvdW5kLmNoYXBpLmlvL2V4YW1wbGVzL2pmZjIvamZmMi5qc29uIiwiaXNzdWVyIjoiZGIvdmMifQ/esOGVHG8d44Q"
        },
        {
          type: 'CredentialHandlerService'
        }
      ]
    },
    challenge: exchangeData.transactionId,
    domain: exchangeData.exchangeHost
  }
}

/**
 *  @param {string} exchangeHost
 *  @param {string} tenantName
 *  @returns a function for processing incoming records, bound to the specific exchangeHost and tenant
 */
const bindProcessRecordFnToExchangeHostAndTenant = (
  exchangeHost,
  tenantName
) => {
  return async (record) => {
    record.tenantName = tenantName
    record.exchangeHost = exchangeHost
    record.transactionId = crypto.randomUUID()
    record.exchangeId = crypto.randomUUID()

    const timeToLive = record.timeToLive || defaultTimeToLive
    await keyv.set(record.exchangeId, record, timeToLive)

    // directDeepLink bypasses the VPR step and assumes the wallet knows to send a DIDAuth.
    const directDeepLink = `https://lcw.app/request.html?issuer=issuer.example.com&auth_type=bearer&challenge=${record.transactionId}&vc_request_url=${exchangeHost}/exchange/${record.exchangeId}/${record.transactionId}`

    //vprDeepLink = deeplink that calls /exchanges/${exchangeId} to initiate the exchange
    // and get back a VPR to which to then send the DIDAuth.
    const vprDeepLink = `https://lcw.app/request.html?issuer=issuer.example.com&auth_type=bearer&vc_request_url=${exchangeHost}/exchange/${record.exchangeId}`
    //
    const chapiVPR = await getDIDAuthVPR(record.exchangeId)
    const retrievalId = record.retrievalId
    const metadata = record.metadata

    return { retrievalId, directDeepLink, vprDeepLink, chapiVPR, metadata }
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
    verifiablePresentationRequest: {
      query: [{ type: 'DIDAuthentication' }],
      challenge: exchangeData.transactionId,
      domain: exchangeData.exchangeHost,
      interact: {
        service: [
          {
            type: 'UnmediatedPresentationService2021',
            serviceEndpoint: `${exchangeData.exchangeHost}/exchange/${exchangeData.exchangeId}/${exchangeData.transactionId}`
          }
        ]
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
export const retrieveStoredData = async (
  exchangeId,
  transactionId,
  didAuthVP
) => {
  const storedData = await getExchangeData(exchangeId)
  const didAuthVerified = await verifyDIDAuth({
    presentation: didAuthVP,
    challenge: storedData.transactionId
  })
  const transactionIdMatches = transactionId === storedData.transactionId
  if (didAuthVerified && transactionIdMatches) {
    return storedData
  } else {
    throw new ExchangeError('Invalid DIDAuth.', 401)
  }
}

/**
 * @param {string} exchangeId
 * @throws {ExchangeError} Unknown exchangeID
 * @returns returns stored data if exchangeId exists
 */
const getExchangeData = async (exchangeId) => {
  const storedData = await keyv.get(exchangeId)
  if (!storedData) throw new ExchangeError('Unknown exchangeId.', 404)
  return storedData
}

/**
 * This is meant for testing failures. It deletes the keyv store entirely.
 * @throws {ExchangeError} Unknown error
 */
export const clearKeyv = () => {
  try {
    keyv = null
  } catch (e) {
    console.log(e)
    throw new ExchangeError('Clear failed')
  }
}

/**
 * @param {Array} exchangeData Array of data items, one per credential, with data needed for the exchange
 * @param {Object} [exchangeData.data[].vc] optional - an unsigned populated VC
 * @param {Object} [exchangeData.data[].subjectData] optional - data to populate a VC
 * @param {string} exchangeData.exchangeHost hostname for the exchange endpoints
 * @param {string} exchangeData.tenantName tenant with which to sign
 * @param {string} exchangeData.batchId batch to which cred belongs; also determines vc template
 * @param {string} exchangeData.data[].retrievalId an identifer for ech record, e.g., the recipient's email address
 * @param {Object} exchangeData.data[].metadata anything else we want to store in the record for later use
 * @throws {ExchangError} Unknown exchangeID
 */
const verifyExchangeData = (exchangeData) => {
  const batchId = exchangeData.batchId
  if (!exchangeData.exchangeHost) {
    throw new ExchangeError(
      'Incomplete exchange data - you must provide an exchangeHost',
      400
    )
  }
  if (!exchangeData.tenantName) {
    throw new ExchangeError(
      'Incomplete exchange data - you must provide a tenant name',
      400
    )
  }
  exchangeData.data.forEach((credData) => {
    if (!credData.vc || credData.subjectData) {
      throw new ExchangeError(
        'Incomplete exchange data - you must provide either a vc or subjectData',
        400
      )
    }
    if (credData.subjectData && !batchId) {
      throw new ExchangeError(
        'Incomplete exchange data - if you provide subjectData, you must also provide a batchId',
        400
      )
    }
    if (!credData.retrievalId) {
      throw new ExchangeError(
        "Incomplete exchange data - every submitted record must have it's own retrievalId.",
        400
      )
    }
  })
}

class ExchangeError extends Error {
  constructor(msg, code) {
    super(msg)
    this.code = code
  }
}
