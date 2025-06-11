let CONFIG: App.Config

const defaultPort = 4004
const defaultExchangeHost = 'http://localhost:4004'
const defaultStatusService = 'http://localhost:4008'
const defaultSigningService = 'http://localhost:4006'
const defaultWorkflow = 'didAuth'
const defaultTenantName = 'test'
const defaultTtlSeconds = 60 * 10 // exchange expires after ten minutes

const parseConfig = (): App.Config => {
  return {
    port: parseInt(process.env.PORT ?? '0') || defaultPort,
    exchangeHost: process.env.EXCHANGE_HOST ?? defaultExchangeHost,
    exchangeTtl: parseInt(process.env.EXCHANGE_TTL ?? '0') || defaultTtlSeconds,
    statusService: process.env.STATUS_SERVICE ?? defaultStatusService,
    signingService: process.env.SIGNING_SERVICE ?? defaultSigningService,
    defaultWorkflow: process.env.DEFAULT_WORKFLOW ?? defaultWorkflow,
    defaultTenantName: process.env.DEFAULT_TENANT_NAME ?? defaultTenantName,

    // Keyv backend configuration
    keyvFilePath: process.env.PERSIST_TO_FILE,
    redisUri: process.env.REDIS_URI ?? undefined,
    keyvWriteDelayMs: parseInt(process.env.KEYV_WRITE_DELAY ?? '0') || 100, // 100ms
    keyvExpiredCheckDelayMs:
      parseInt(process.env.KEYV_EXPIRED_CHECK_DELAY ?? '0') || 4 * 3600 * 1000 // 4 hours
  }
}

export const getConfig = () => {
  if (!CONFIG) {
    CONFIG = parseConfig()
  }
  return CONFIG
}

export const loadSecrets = async () => {}
