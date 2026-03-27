import CryptoJS from "crypto-js";
function toKey(passphrase) {
    return CryptoJS.SHA256(passphrase);
}
export function encryptSecretText(value, passphrase) {
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
export function decryptSecretText(envelope, passphrase) {
    const decrypted = CryptoJS.AES.decrypt({
        ciphertext: CryptoJS.enc.Base64.parse(envelope.cipherText),
    }, toKey(passphrase), {
        iv: CryptoJS.enc.Hex.parse(envelope.iv),
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
    });
    return decrypted.toString(CryptoJS.enc.Utf8);
}
