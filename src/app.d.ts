declare global {
  namespace App {
    interface Config {
      port: number
      exchangeHost: string
      exchangeTtl: number
      statusService: string
      signingService: string
      defaultWorkflow: string
      defaultTenantName: string
      keyvFilePath?: string
      redisUri?: string
      keyvWriteDelayMs: number
      keyvExpiredCheckDelayMs: number
    }

    interface ErrorResponseBody {
      code: number
      message: string
      details?: Array<{
        code: string
        message: string
        path: Array<string>
      }>
    }

    interface Credential extends Record<string, unknown> {
      credentialSubject: Record<string, unknown> & {
        id: string
      }
    }

    interface ExchangeBatch {
      data: Array<{
        vc: string // JSON template string
        subjectData?: Record<string, unknown>
        retrievalId?: string // Optional for later retrieval/correlation of this record
        metadata?: Record<string, unknown> // Additional data to store related to the exchange
        redirectUrl?: string
      }>
      batchId?: string
      exchangeHost: string
      tenantName: string
      workflowId?: string
    }

    interface ExchangeCreateInput {
      expires?: string
      variables: Record<string, unknown> & {
        vc?: string
        redirectUrl?: string
        exchangeHost: string
        tenantName: string
        challenge?: string
      }
    }

    interface ExchangeDetail {
      // Local metadata
      tenantName: string
      workflowId: string

      // VC-API metadata
      exchangeId: string
      expires: string
      state: 'pending' | 'active' | 'completed' | 'invalid'
      variables: {
        vc?: string
        redirectUrl?: string
        retrievalId?: string
        exchangeHost: string
        metadata?: Record<string, unknown>
        challenge: string // Used to authenticate presentations
      }
    }

    interface WorkflowStep {
      createChallenge: boolean
      verifiablePresentationRequest: {
        query: Array<{ type: string } & Record<string, any>> // Simplistic for now
      }
    }

    interface Workflow {
      id: string
      steps: Record<string, WorkflowStep>
      initialStep: string
      credentialTemplates?: Array<{
        id: string
        type: 'handlebars' // TODO: add 'jsonata'
        template: string
      }>
    }

    interface VPR {
      query: {
        type: 'DIDAuthentication' | 'QueryByExample'
      } & Record<string, unknown>
      interact: {
        service: Array<{
          type:
            | 'VerifiableCredentialApiExchangeService'
            | 'UnmediatedPresentationService2021'
            | 'CredentialHandlerService'
          serviceEndpoint?: string
        }>
      }
      challenge: string
      domain: string
    }

    interface Protocols {
      vcapi?: string
      verifiablePresentationRequest: VPR
      lcw?: string
    }

    interface DCCWalletQuery {
      retrievalId: string
      directDeepLink: string
      vprDeepLink: string
      chapiVPR?: VPR
      metadata?: Record<string, unknown>
    }
  }
}

export {}
