import {verify} from '@digitalbazaar/vc';
import {Ed25519Signature2020} from '@digitalbazaar/ed25519-signature-2020';
import { securityLoader } from './securityLoader.js';

const documentLoader = securityLoader().build()
const suite = new Ed25519Signature2020();
 
export const verifyDIDAuth = async ({presentation, challenge}) => {
    const result = await verify({presentation, challenge, suite, documentLoader});
    return result.verified
}

