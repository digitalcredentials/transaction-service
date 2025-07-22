const didAuthWorkflow: App.Workflow = {
  id: 'didAuth',
  steps: {
    didAuth: {
      createChallenge: true,
      verifiablePresentationRequest: {
        query: [{ type: 'DIDAuthentication' }]
      }
    }
  },
  initialStep: 'didAuth'
}

// A workflow that enables the claim of a VC whose template is defined at the exchange
// creation time. DID Auth is required, and status is used if the service is globally enabled.
const claimWorkflow: App.Workflow = {
  id: 'claim',
  steps: {
    claim: {
      createChallenge: true,
      verifiablePresentationRequest: {
        query: [{ type: 'DIDAuthentication' }]
      }
    }
  },
  credentialTemplates: [
    {
      id: 'generic',
      type: 'handlebars',
      // For this workflow, the VC is provide in the exchange creation variables as "vc".
      template: '{{{vc}}}' // triple-stache to avoid html escaping quotation marks
    }
  ],
  initialStep: 'claim'
}

const verifyCredentialWorkflow: App.Workflow = {
  id: 'verify',
  steps: {
    verify: {
      createChallenge: true,
      verifiablePresentationRequest: { query: [] }
    }
  },
  initialStep: 'verify'
}

const workflows: Record<string, App.Workflow> = {
  didAuth: didAuthWorkflow,
  claim: claimWorkflow,
  verify: verifyCredentialWorkflow
}

/**
 * Gets a supported workflow by ID.
 */
export const getWorkflow = (
  workflowId: keyof typeof workflows
): App.Workflow => {
  return workflows[workflowId]
}
