import CryptoJS from "crypto-js";

import type { SecretEnvelope } from "./types";

function toKey(passphrase: string) {
  return CryptoJS.SHA256(passphrase);
}

export function encryptSecretText(value: string, passphrase: string): SecretEnvelope {
  const iv = CryptoJS.lib.WordArray.random(16);
  const cipher = CryptoJS.AES.encrypt(value, toKey(passphrase), {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  return {
    iv: iv.toString(CryptoJS.enc.Hex),
    cipherText: cipher.ciphertext.toString(CryptoJS.enc.Base64),
  };
}

export function decryptSecretText(envelope: SecretEnvelope, passphrase: string) {
  const decrypted = CryptoJS.AES.decrypt(
    {
      ciphertext: CryptoJS.enc.Base64.parse(envelope.cipherText),
    } as CryptoJS.lib.CipherParams,
    toKey(passphrase),
    {
      iv: CryptoJS.enc.Hex.parse(envelope.iv),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    },
  );

  return decrypted.toString(CryptoJS.enc.Utf8);
}

