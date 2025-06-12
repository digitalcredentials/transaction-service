/*!
 * Copyright (c) 2023 Digital Credentials Consortium. All rights reserved.
 */
import Keyv from 'keyv'
import KeyvRedis from '@keyv/redis'
import { KeyvFile } from 'keyv-file'
import { getConfig } from './config'
import { StatusCode } from 'hono/utils/http-status'

// The key value store used for transaction data.
let keyv: Keyv<App.Exchange>

/**
 * Intializes the keyv store either in-memory or in file system, according to env.
 */
export const initializeTransactionManager = () => {
  const config = getConfig()
  if (!keyv) {
    if (config.keyvFilePath) {
      keyv = new Keyv<App.Exchange>({
        store: new KeyvFile({
          filename: config.keyvFilePath,
          expiredCheckDelay: config.keyvExpiredCheckDelayMs, // How often to check for and remove expired records
          writeDelay: config.keyvWriteDelayMs, // ms, batch write to disk in a specific duration, enhance write performance.
          serialize: JSON.stringify, // serialize function
          deserialize: JSON.parse // deserialize function
        })
      })
    } else if (config.redisUri) {
      keyv = new Keyv<App.Exchange>(
        new KeyvRedis(config.redisUri, { namespace: 'exchange' })
      )
    } else {
      keyv = new Keyv<App.Exchange>()
    }
  }
}
initializeTransactionManager() // call immediately to ensure keyv is initialized

/**
 * @throws {App.ExchangeError} Unknown exchangeID
 * @returns returns stored data if exchangeId exists
 */
export const getExchangeData = async (
  exchangeId: string,
  workflowId: string
) => {
  const storedData = await keyv.get(exchangeId)
  if (!storedData || storedData.workflowId !== workflowId) {
    throw new ExchangeError(404, 'Unknown exchangeId.')
  }
  return storedData
}

/**
 * Sets up one exchange and save it to Keyv. The local exchangeId is used as the key for the
 * record. Success/Failure boolean is returned.
 */
export const saveExchange = async (data: App.Exchange) => {
  const success = await keyv.set(data.exchangeId, data, data.ttl * 1000)
  if (!success) {
    throw new ExchangeError(500, 'Failed to save exchange.')
  }
  return success
}

/**
 * This returns the authentication vpr as described in
 * https://w3c-ccg.github.io/vp-request-spec/#did-authentication
 */
export const getDIDAuthVPR = (exchange: App.Exchange) => {
  const serviceEndpoint = `${exchange.exchangeHost}/workflows/${exchange.workflowId}/exchanges/${exchange.exchangeId}`

  return {
    query: {
      type: 'DIDAuthentication'
    },
    interact: {
      service: [
        {
          type: 'VerifiableCredentialApiExchangeService',
          serviceEndpoint
        },
        {
          type: 'UnmediatedPresentationService2021',
          serviceEndpoint
        },
        {
          type: 'CredentialHandlerService'
        }
      ]
    },
    challenge: exchange.challenge,
    domain: exchange.exchangeHost
  }
}

/**
 * This is meant for testing failures. It deletes the keyv store entirely.
 */
export const clearKeyv = () => {
  // @ts-ignore
  keyv = undefined
}

export class ExchangeError extends Error {
  code: StatusCode
  constructor(code: StatusCode, message: string) {
    super(message)
    this.code = code
    this.name = 'ExchangeError'
  }
}
