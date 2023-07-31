import * as didKey from '@digitalbazaar/did-method-key';
import didContext from 'did-context';
import ed25519 from 'ed25519-signature-2020-context';
import credentialsContext from 'credentials-context';
import { JsonLdDocumentLoader } from 'jsonld-document-loader';
import { Ed25519VerificationKey2020 } from '@digitalbazaar/ed25519-verification-key-2020'
import { CachedResolver } from '@digitalbazaar/did-io';

const didKeyDriver = didKey.driver();
didKeyDriver.use({
  multibaseMultikeyHeader: 'z6Mk',
  fromMultibase: Ed25519VerificationKey2020.from
}); 

const resolver = new CachedResolver();
resolver.use(didKeyDriver);

export function securityLoader() {

  const staticLoader = new JsonLdDocumentLoader();

  staticLoader.addStatic(ed25519.constants.CONTEXT_URL,
    ed25519.contexts.get(ed25519.constants.CONTEXT_URL));

  staticLoader.addStatic(didContext.constants.DID_CONTEXT_URL,
    didContext.contexts.get(didContext.constants.DID_CONTEXT_URL));

  staticLoader.addStatic(credentialsContext.constants.CREDENTIALS_CONTEXT_V1_URL,
    credentialsContext.contexts.get(credentialsContext.constants.CREDENTIALS_CONTEXT_V1_URL));

  staticLoader.setDidResolver(resolver);

  return staticLoader

}
