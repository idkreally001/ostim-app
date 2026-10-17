import CryptoJS from 'crypto-js';

export interface ObsCryptoConfig {
  aesKey: string;
  aesIv?: string;
  uniCode: string;
  secret: string;
  uniToken: string;
}

/**
 * Format a Date object to Proliz standard formats:
 * Time: HH:mm:ss
 * Date: DD.MM.YYYY
 */
export function getProlizTimestamps(date: Date = new Date()): { timeStr: string; dateStr: string } {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const timeStr = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  const dateStr = `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
  return { timeStr, dateStr };
}

/**
 * Encrypts a value using Proliz's double-Base64 AES-128-CBC PKCS7 scheme.
 *
 * Framing: {time}|{uniCode}|{secret}|{value}|{date}
 * Ciphertext: base64(base64(aes_cbc_pkcs7(plain)))
 */
export function encryptObsField(
  value: string,
  timeStr: string,
  dateStr: string,
  config: ObsCryptoConfig
): string {
  const key = CryptoJS.enc.Utf8.parse(config.aesKey);
  const iv = CryptoJS.enc.Utf8.parse(config.aesIv || config.aesKey);

  const plainText = `${timeStr}|${config.uniCode}|${config.secret}|${value}|${dateStr}`;
  const plainUtf8 = CryptoJS.enc.Utf8.parse(plainText);

  const encrypted = CryptoJS.AES.encrypt(plainUtf8, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  // CryptoJS.AES.encrypt produces Base64 ciphertext as encrypted.toString()
  const b64_1 = encrypted.toString();
  // Second Base64 encoding pass
  const b64_2 = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(b64_1));

  return b64_2;
}

/**
 * Decrypts a Proliz double-Base64 AES-128-CBC PKCS7 ciphertext.
 */
export function decryptObsField(
  cipherDoubleB64: string,
  config: ObsCryptoConfig
): string {
  const key = CryptoJS.enc.Utf8.parse(config.aesKey);
  const iv = CryptoJS.enc.Utf8.parse(config.aesIv || config.aesKey);

  // Undo second base64
  const b64_1 = CryptoJS.enc.Utf8.stringify(CryptoJS.enc.Base64.parse(cipherDoubleB64));

  // Decrypt first base64 AES
  const decrypted = CryptoJS.AES.decrypt(b64_1, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  const fullFramed = CryptoJS.enc.Utf8.stringify(decrypted);
  // Full framed format: time|uniCode|secret|value|date
  const parts = fullFramed.split('|');
  if (parts.length >= 5) {
    // Value is between secret and date
    return parts.slice(3, -1).join('|');
  }
  return fullFramed;
}

/**
 * Computes MD5 hash of string in UPPERCASE.
 */
export function md5Upper(input: string): string {
  return CryptoJS.MD5(input).toString().toUpperCase();
}
