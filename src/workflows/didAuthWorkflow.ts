import { z } from 'zod'
import { vcApiExchangeCreateSchema, baseVariablesSchema } from '../schema.js'

export const exchangeCreateSchemaDidAuth = vcApiExchangeCreateSchema.extend({})

export const validateExchangeDidAuth = (data: any) => {
  return exchangeCreateSchemaDidAuth.parse(data)
}

export const createExchangeDidAuth = ({
  data,
  config,
  workflow
}: {
  data: z.infer<typeof exchangeCreateSchemaDidAuth>
  config: App.Config
  workflow: App.Workflow
}) => {
  const exchange: App.ExchangeDetailBase = {
    ...data,
    workflowId: workflow.id,
    tenantName: data.variables.tenantName,
    exchangeId: crypto.randomUUID(),
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
