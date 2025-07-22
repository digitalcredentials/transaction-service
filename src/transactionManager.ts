/*!
 * Copyright (c) 2023 Digital Credentials Consortium. All rights reserved.
 */
import { HTTPException } from 'hono/http-exception'
import Keyv from 'keyv'
import KeyvRedis from '@keyv/redis'
import { KeyvFile } from 'keyv-file'
import { getConfig } from './config.js'

// The key value store used for transaction data.
let keyv: Keyv<App.ExchangeDetailBase>

/**
 * Intializes the keyv store either in-memory or in file system, according to env.
 */
export const initializeTransactionManager = () => {
  const config = getConfig()
  if (!keyv) {
    if (config.keyvFilePath) {
      keyv = new Keyv<App.ExchangeDetailBase>({
        store: new KeyvFile({
          filename: config.keyvFilePath,
          expiredCheckDelay: config.keyvExpiredCheckDelayMs, // How often to check for and remove expired records
          writeDelay: config.keyvWriteDelayMs, // ms, batch write to disk in a specific duration, enhance write performance.
          serialize: JSON.stringify, // serialize function
          deserialize: JSON.parse // deserialize function
        })
      })
    } else if (config.redisUri) {
      console.log('Using redis backend for Keyv: ' + config.redisUri)
      const hasPort = config.redisUri.includes('6379')
      keyv = new Keyv<App.ExchangeDetailBase>(
        new KeyvRedis(
          {
            url: hasPort ? config.redisUri : `rediss://${config.redisUri}:6379`,
            socket: { tls: hasPort ? false : true }
          },
          { namespace: 'exchange' }
        )
      )
    } else {
      keyv = new Keyv<App.ExchangeDetailBase>()
    }
  }
}
initializeTransactionManager() // call immediately to ensure keyv is initialized

/**
 * @throws {} Unknown exchangeID
 * @returns returns stored data if exchangeId exists
 */
export const getExchangeData = async (
  exchangeId: string,
  workflowId: string
) => {
  const storedData = await keyv.get(exchangeId)
  if (!storedData || storedData.workflowId !== workflowId) {
    throw new HTTPException(404, { message: 'Unknown exchangeId.' })
  }
  return storedData
}

/**
 * Sets up one exchange and save it to Keyv. The local exchangeId is used as the key for the
 * record. Success/Failure boolean is returned.
 */
export const saveExchange = async (data: App.ExchangeDetailBase) => {
  const ttl = new Date(data.expires).getTime() - Date.now() + 1000
  const success = await keyv.set(data.exchangeId, data, ttl)
  if (!success) {
    throw new HTTPException(500, { message: 'Failed to save exchange.' })
  }
  return success
}

/**
 * This is meant for testing failures. It deletes the keyv store entirely.
 */
export const clearKeyv = () => {
  // @ts-ignore
  keyv = undefined
}
