import CryptoJS from 'crypto-js';
import { ObsCryptoConfig } from './obsCrypto';

export interface AppRuntimeConfig {
  version: number;
  updatedAt?: string;
  obs: {
    baseUrl: string;
    aesKey: string;
    uniCode: string;
    secret: string;
    uniToken: string;
  };
  lms: {
    tokenUrl: string;
    serviceUrl: string;
  };
}

export interface EncryptedPayload {
  version: number;
  cipher: string;
}

/**
 * Encrypts app runtime config using the project's secret master key.
 */
export function encryptAppConfig(
  config: AppRuntimeConfig,
  masterKey: string
): EncryptedPayload {
  const jsonString = JSON.stringify(config);
  const encrypted = CryptoJS.AES.encrypt(jsonString, masterKey).toString();
  return {
    version: config.version,
    cipher: encrypted,
  };
}

/**
 * Decrypts the encrypted config payload using the project's secret master key.
 */
export function decryptAppConfig(
  payload: EncryptedPayload,
  masterKey: string
): AppRuntimeConfig {
  const bytes = CryptoJS.AES.decrypt(payload.cipher, masterKey);
  const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
  if (!decryptedText) {
    throw new Error('Failed to decrypt config payload: invalid master key or corrupted ciphertext.');
  }
  return JSON.parse(decryptedText) as AppRuntimeConfig;
}
