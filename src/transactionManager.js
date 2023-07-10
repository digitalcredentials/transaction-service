/*!
 * Copyright (c) 2023 Digital Credentials Consortium. All rights reserved.
 */
import crypto from 'crypto';
import Keyv from 'keyv';

let keyv;
const expiresAfter = 1000 * 60 * 10; // store data expires after ten minutes

export const initializeTransactionManager = () => {
  if (!keyv) keyv = new Keyv();
}

/**
 * @param data - Anything that the caller wants to store for later
 *  recovery, like say the data with which to construct a given credential,
 * for example, studentName, degreeType, etc. OR a populated VC
 * @returns {string} The challenge, i.e, a UUID
 */
export const createTransaction = async (data) => {
    const challenge = crypto.randomUUID()
    await keyv.set(challenge, data, expiresAfter);
    return {challenge}
  }

/**
 * @param challenge 
 * @returns whatever was stored when the challenge was created
 */
export const verifyTransaction = async (challenge) => {
    return await keyv.get(challenge)
  }




