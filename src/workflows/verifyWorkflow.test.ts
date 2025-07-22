import * as config from '../config'
import { expect, test, describe, beforeAll, afterAll, vi } from 'vitest'
import { getWorkflow } from '../workflows'
import { createExchangeVerify, validateExchangeVerify } from './verifyWorkflow'

const testData = {
  workflowId: 'verify',
  variables: {
    tenantName: 'test',
    vprContext: ['https://w3id.org/security/suites/ed25519-2020/v1'],
    vprCredentialType: ['https://w3id.org/security/suites/ed25519-2020/v1'],
    trustedIssuers: [
      'did:key:z6Mko3vgms1K7mccKpUEKQivWdM5BefHfSJEF4XAXofXaGJC'
    ],
    vprClaims: [
      {
        path: ['credentialSubject.achievement.id'],
        values: ['urn:uuid:213e594f-a9f6-4171-b8e6-027b66624fc7']
      }
    ]
  }
}

describe('verifyWorkflowSchema', function () {
  test('can validate verify exchange variables', function () {
    const validated = validateExchangeVerify(testData)
    expect(validated).toBeDefined()
    expect(validated.variables.tenantName).toBe('test')
    expect(validated.variables.vprContext).toBeDefined()
    expect(validated.variables.vprCredentialType).toBeDefined()
    expect(validated.variables.trustedIssuers).toBeDefined()
    expect(validated.variables.vprClaims).toBeDefined()
    expect(validated.variables.vprClaims?.[0]?.path[0]).toEqual(
      'credentialSubject.achievement.id'
    )
    expect(validated.variables.vprClaims?.[0]?.values?.[0]).toEqual(
      'urn:uuid:213e594f-a9f6-4171-b8e6-027b66624fc7'
    )
  })
})

describe('verifyWorkflow', function () {
  test('can create exchange', function () {
    const validated = validateExchangeVerify(testData)
    const exchange = createExchangeVerify({
      workflow: getWorkflow('verify'),
      data: validated,
      config: config.getConfig()
    })
    expect(exchange).toBeDefined()
    expect(exchange.workflowId).toBe('verify')
  })
})
