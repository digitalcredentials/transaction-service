let CONFIG: App.Config

const defaultPort = 4004
const defaultExchangeHost = 'http://localhost:4004'
const defaultStatusService = 'http://localhost:4008'
const defaultSigningService = 'http://localhost:4006'
const defaultWorkflow = 'didAuth'
const defaultTenantName = 'default'
const defaultTenantToken = 'default'
const defaultTtlSeconds = 60 * 10 // exchange expires after ten minutes

const parseTenantsFromEnv = (env: typeof process.env) => {
  const tenants: Record<string, App.Tenant> = {}
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith('TENANT_TOKEN_') && value) {
      const tenantName = key.slice(13).toLowerCase()
      tenants[tenantName] = {
        tenantName,
        tenantToken: value
      }
      if (env[`TENANT_DOMAIN_${tenantName}`]) {
        tenants[tenantName].origin = env[`TENANT_ORIGIN_${tenantName}`]
      }
    }
  }
  return tenants
}

const parseConfig = (): App.Config => {
  const tenants = parseTenantsFromEnv(process.env)

  const config: App.Config = {
    port: parseInt(process.env.PORT ?? '0') || defaultPort,
    defaultExchangeHost: process.env.EXCHANGE_HOST ?? defaultExchangeHost,
    exchangeTtl: parseInt(process.env.EXCHANGE_TTL ?? '0') || defaultTtlSeconds,
    // status service is optional, set STATUS_SERVICE="" (empty string) to disable.
    statusService:
      process.env.STATUS_SERVICE !== undefined
        ? process.env.STATUS_SERVICE
        : defaultStatusService,
    signingService: process.env.SIGNING_SERVICE ?? defaultSigningService,

    defaultWorkflow: process.env.DEFAULT_WORKFLOW ?? defaultWorkflow,
    defaultTenantName: process.env.DEFAULT_TENANT_NAME ?? defaultTenantName,

    tenants,
    tenantAuthenticationEnabled: Object.keys(tenants).length > 0,

    // Keyv backend configuration
    keyvFilePath: process.env.PERSIST_TO_FILE,
    redisUri: process.env.REDIS_URI ?? undefined,
    keyvWriteDelayMs: parseInt(process.env.KEYV_WRITE_DELAY ?? '0') || 100, // 100ms
    keyvExpiredCheckDelayMs:
      parseInt(process.env.KEYV_EXPIRED_CHECK_DELAY ?? '0') || 4 * 3600 * 1000 // 4 hours
  }

  // Only if no tenants are configured, use the default tenant
  if (Object.keys(config.tenants).length === 0) {
    config.tenants[defaultTenantName] = {
      tenantName: defaultTenantName,
      tenantToken: defaultTenantToken
    }
  }

  return Object.freeze(config)
}

export const getConfig = () => {
  if (!CONFIG) {
    CONFIG = parseConfig()
  }
  return CONFIG
}

export const loadSecrets = async () => {}
