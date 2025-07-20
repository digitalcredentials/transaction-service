import * as config from './config.js'
import * as transactionManager from './transactionManager.js'
import { expect, test, describe, beforeAll, afterAll, vi } from 'vitest'
import { app, type AppType } from './hono.js'
import { authenticateTenant } from './auth.js'
import { testClient } from 'hono/testing'
import { getDataForExchangeSetupPost } from './test-fixtures/testData.js'

describe('tenant authentication', function () {
  describe('tenantAuth disabled, no tenants configured', function () {
    beforeAll(() => {
      const currentConfig = config.getConfig()
      vi.spyOn(config, 'getConfig').mockImplementation(() => {
        return {
          ...currentConfig,
          statusService: '',
          tenantAuthenticationEnabled: false,
          tenants: {}
        }
      })
    })

    afterAll(() => {
      vi.restoreAllMocks()
    })

    test('returns undefined if no auth header is set', async function () {
      const tenant = await authenticateTenant('')
      expect(tenant).toBeUndefined()
    })
    test('returns undefined if auth header is set but no tenant is configured', async function () {
      const tenant = await authenticateTenant('default')
      expect(tenant).toBeUndefined()
    })
  })

  describe('tenantAuth disabled, tenants configured', function () {
    beforeAll(() => {
      const currentConfig = config.getConfig()
      vi.spyOn(config, 'getConfig').mockImplementation(() => {
        return {
          ...currentConfig,
          statusService: '',
          tenantAuthenticationEnabled: false,
          tenants: {
            test1: {
              tenantName: 'test1',
              tenantToken: 'test1token'
            },
            test2: {
              tenantName: 'test2',
              tenantToken: 'test2token'
            }
          }
        }
      })
    })

    afterAll(() => {
      vi.restoreAllMocks()
    })

    test('returns undefined if no auth header is set', async function () {
      const tenant = await authenticateTenant('')
      expect(tenant).toBeUndefined()
    })

    test('returns undefined if auth header is set but auth is disabled', async function () {
      const tenant = await authenticateTenant('test1token')
      expect(tenant).toBeUndefined()
    })

    test('returns undefined for invalid tenant token', async function () {
      const tenant = await authenticateTenant('invalid')
      expect(tenant).toBeUndefined()
    })
  })

  describe('tenantAuthEnabled, no tenants configured', function () {
    beforeAll(() => {
      const currentConfig = config.getConfig()
      vi.spyOn(config, 'getConfig').mockImplementation(() => {
        return {
          ...currentConfig,
          statusService: '',
          tenantAuthenticationEnabled: true,
          tenants: {
            default: {
              tenantName: 'default',
              tenantToken: 'default'
            }
          }
        }
      })
    })

    afterAll(() => {
      vi.restoreAllMocks()
    })

    test('returns undefined if no auth header is set', async function () {
      const tenant = await authenticateTenant('')
      expect(tenant).toBeUndefined()
    })
  })

  describe('tenantAuthEnabled, tenants configured', function () {
    beforeAll(() => {
      const currentConfig = config.getConfig()
      vi.spyOn(config, 'getConfig').mockImplementation(() => {
        return {
          ...currentConfig,
          statusService: '',
          tenantAuthenticationEnabled: true,
          tenants: {
            test1: {
              tenantName: 'test1',
              tenantToken: 'test1token'
            },
            test2: {
              tenantName: 'test2',
              tenantToken: 'test2token'
            }
          }
        }
      })
    })

    afterAll(() => {
      vi.restoreAllMocks()
    })

    test('returns undefined if no auth header is set', async function () {
      const tenant = await authenticateTenant('')
      expect(tenant).toBeUndefined()
    })

    test('returns tenant based on token', async function () {
      const tenant = await authenticateTenant('test1token')
      expect(tenant).toEqual({
        tenantName: 'test1',
        tenantToken: 'test1token'
      })
    })
  })
})

describe('tenant authentication in http', function () {
  const client = testClient<AppType>(app)
  describe('tenantAuthDisabled', function () {
    beforeAll(() => {
      const currentConfig = config.getConfig()
      vi.spyOn(config, 'getConfig').mockImplementation(() => {
        return {
          ...currentConfig,
          statusService: '',
          tenantAuthenticationEnabled: false,
          tenants: {}
        }
      })
    })

    afterAll(() => {
      vi.restoreAllMocks()
    })

    test('errant auth header is ignored', async function () {
      const response = await client.exchange.$post(
        {
          json: getDataForExchangeSetupPost('default')
        },
        { headers: { Authorization: 'Bearer invalid' } }
      )
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.length).toEqual(2)
    })

    test('works with no auth header', async function () {
      const response = await client.exchange.$post({
        json: getDataForExchangeSetupPost('default')
      })
      expect(response.status).toBe(200)
    })
  })

  describe('tenantAuthEnabled', function () {
    beforeAll(() => {
      const currentConfig = config.getConfig()
      vi.spyOn(config, 'getConfig').mockImplementation(() => {
        return {
          ...currentConfig,
          statusService: '',
          tenantAuthenticationEnabled: true,
          tenants: {
            tenant1: {
              tenantName: 'tenant1',
              tenantToken: 'tenant1token'
            },
            tenant2: {
              tenantName: 'tenant2',
              tenantToken: 'tenant2token'
            }
          }
        }
      })
    })

    afterAll(() => {
      vi.restoreAllMocks()
    })

    test('returns 401 if auth header is set but no matching tenant', async function () {
      const response = await client.exchange.$post(
        { json: getDataForExchangeSetupPost('default') },
        { headers: { Authorization: 'Bearer invalid' } }
      )
      expect(response.status).toBe(401)
    })

    test('works with correct auth header', async function () {
      const response = await client.exchange.$post(
        { json: getDataForExchangeSetupPost('tenant1') },
        { headers: { Authorization: 'Bearer tenant1token' } }
      )
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.length).toEqual(2)
    })

    test('fails with body/header tenant mismatch', async function () {
      const response = await client.exchange.$post(
        { json: getDataForExchangeSetupPost('tenant2') },
        { headers: { Authorization: 'Bearer tenant1token' } }
      )
      expect(response.status).toBe(401)
    })
  })

  describe('get exchange state endpoint', function () {
    beforeAll(() => {
      const currentConfig = config.getConfig()
      vi.spyOn(config, 'getConfig').mockImplementation(() => {
        return {
          ...currentConfig,
          statusService: '',
          tenantAuthenticationEnabled: true,
          tenants: {
            tenant1: {
              tenantName: 'tenant1',
              tenantToken: 'tenant1token'
            }
          }
        }
      })
      vi.spyOn(transactionManager, 'getExchangeData').mockImplementation(
        async () => {
          return {
            tenantName: 'tenant1',
            exchangeId: '123',
            workflowId: 'didAuth',
            expires: new Date(Date.now() + 1000).toISOString(),
            state: 'active',
            variables: {
              tenantName: 'tenant1',
              exchangeHost: 'http://localhost:4005',
              challenge: 'challenge'
            }
          }
        }
      )
    })

    afterAll(() => {
      vi.restoreAllMocks()
    })

    test('returns 401 if auth header is set but no matching tenant', async function () {
      const response = await app.request('/workflows/didAuth/exchanges/123', {
        method: 'GET',
        headers: { Authorization: 'Bearer invalid' }
      })
      const body = await response.json()
      expect(response.status).toBe(401)
      expect(body.exchangeId).toBeUndefined()
    })

    test('works with correct auth header', async function () {
      const response = await app.request('/workflows/didAuth/exchanges/123', {
        method: 'GET',
        headers: { Authorization: 'Bearer tenant1token' }
      })
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.exchangeId).toBe('123')
    })
  })
})
