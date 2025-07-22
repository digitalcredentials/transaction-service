import { arrayOf } from './utils'

/**
 * Do some pre-processing of presentations before submitting them for verification.
 * @param presentation
 * @returns
 */
export const preparePresentation = (presentation: Record<string, unknown>) => {
  const _presentation = { ...presentation }
  const proof = presentation?.proof as {
    type: string | string[]
    '@context': string | string[] | undefined
  }
  const proofType = arrayOf(proof?.type)

  const context = arrayOf(presentation?.['@context'] as string[])

  // Compatibility hack: LearnCard via SpruceKit generates a presentation without this signature
  // context at the top level, which violates a particular assumption of the Digital Bazaar
  // library for this signature suite.
  if (
    proofType.includes('Ed25519Signature2020') &&
    proof['@context']?.includes(
      'https://w3id.org/security/suites/ed25519-2020/v1'
    ) &&
    !context?.includes('https://w3id.org/security/suites/ed25519-2020/v1')
  ) {
    // Also add the context to the top level of the presentation, which will not affect the
    // canonized nquads unless something else is wonky.
    _presentation['@context'] = [
      ...context,
      'https://w3id.org/security/suites/ed25519-2020/v1'
    ]
  }

  return _presentation
}
