/**
 * This returns the authentication vpr as described in
 * https://w3c-ccg.github.io/vp-request-spec/#did-authentication
 */
export const getDIDAuthVPR = (exchange: App.ExchangeDetailBase) => {
  const serviceEndpoint = `${exchange.variables.exchangeHost}/workflows/${exchange.workflowId}/exchanges/${exchange.exchangeId}`

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
    challenge: exchange.variables.challenge,
    domain: exchange.variables.exchangeHost
  }
}

export const getCredentialVPR = (exchange: App.ExchangeDetailVerify) => {
  const serviceEndpoint = `${exchange.variables.exchangeHost}/workflows/${exchange.workflowId}/exchanges/${exchange.exchangeId}`
  const { vprContext, vprCredentialType, vprClaims } = exchange.variables
  return {
    query: {
      type: 'QueryByExample',
      queryByExample: {
        '@context': vprContext,
        type: vprCredentialType
      }
    },
    interact: {
      service: [
        { type: 'VerifiableCredentialApiExchangeService', serviceEndpoint }
      ]
    }
  }
}
