import { arrayOf } from '../utils.js'
import { z } from 'zod'
import { vcApiExchangeCreateSchema, baseVariablesSchema } from '../schema.js'

export const exchangeCreateSchemaClaim = vcApiExchangeCreateSchema.extend({
  variables: baseVariablesSchema.extend({
    subjectData: z.record(z.string(), z.any()).optional(),
    vc: z
      .string({
        message:
          'Incomplete exchange variables. Include a VC template as a string'
      })
      .refine(
        (vc) => {
          try {
            const data = JSON.parse(vc)

            // Rudimentary check to ensure VC template is valid
            const docType = arrayOf(data.type) as string[]
            return docType.includes('VerifiableCredential')
          } catch (error) {
            return false
          }
        },
        { message: 'Invalid VC template. Must be a valid JSON string' }
      )
  })
})

export const validateExchangeClaim = (data: any) => {
  return exchangeCreateSchemaClaim.parse(data)
}

export const createExchangeClaim = ({
  data,
  config
}: {
  data: z.infer<typeof exchangeCreateSchemaClaim>
  config: App.Config
}) => {
  const exchange: App.ExchangeDetailClaim = {
    ...data,
    workflowId: 'claim',
    exchangeId: crypto.randomUUID(),
    tenantName: data.variables.tenantName,
    variables: {
      ...data.variables,
      challenge: crypto.randomUUID()
    },
    expires:
      data.expires ??
      new Date(Date.now() + config.exchangeTtl * 1000).toISOString(),
    state: 'pending'
  }
  return exchange
}
