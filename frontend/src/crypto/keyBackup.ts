// Private-key backup: PBKDF2-SHA256 derives an AES-256-GCM key from the recovery passphrase,
// which encrypts the private key's JWK. Only the resulting blob ever leaves the browser.

import {ECDH, fromB64, toB64} from './encoding';

const PBKDF2_ITERATIONS = 600_000; // OWASP guidance for PBKDF2-HMAC-SHA256
const MIN_ITER = 100_000;
const MAX_ITER = 5_000_000; // refuse absurd server-supplied values

const enc = new TextEncoder();
const dec = new TextDecoder();

/** What gets uploaded (as JSON text). Versioned so the KDF can be upgraded later (e.g. Argon2id). */
export interface BackupBlob {
    v: 1;
    kdf: 'PBKDF2-SHA256';
    iter: number;
    /** Base64. */
    salt: string;
    /** Base64. */
    iv: string;
    /** Base64 AES-GCM ciphertext of the private-key JWK. */
    ct: string;
}

/** Binds the ciphertext to this account and format: a blob moved to another user fails to decrypt. */
const aad = (username: string) => enc.encode(`chat-key-backup:v1:${username}`);

async function deriveWrapKey(passphrase: string, salt: BufferSource, iterations: number): Promise<CryptoKey> {
    const material = await crypto.subtle.importKey(
        'raw', enc.encode(passphrase.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
        {name: 'PBKDF2', hash: 'SHA-256', salt, iterations},
        material,
        {name: 'AES-GCM', length: 256},
        false,
        ['encrypt', 'decrypt']);
}

/** Import a JWK as a usable pair: private key NON-extractable, public key extractable. */
export async function importIdentity(jwk: JsonWebKey): Promise<CryptoKeyPair> {
    const privateKey = await crypto.subtle.importKey('jwk', jwk, ECDH, false, ['deriveKey']);
    const publicKey = await crypto.subtle.importKey(
        'jwk', {kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y}, ECDH, true, []);
    return {privateKey, publicKey};
}

/**
 * Generate a fresh identity. The private key is extractable only inside this function, so we can
 * export the JWK for the backup; the pair we return (and later store) is non-extractable.
 */
export async function generateIdentity(): Promise<{ pair: CryptoKeyPair; jwk: JsonWebKey }> {
    const temp = await crypto.subtle.generateKey(ECDH, true, ['deriveKey']);
    const jwk = await crypto.subtle.exportKey('jwk', temp.privateKey);
    return {pair: await importIdentity(jwk), jwk};
}

export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
    return toB64(await crypto.subtle.exportKey('spki', publicKey));
}

export async function encryptBackup(jwk: JsonWebKey, passphrase: string, username: string): Promise<BackupBlob> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const wrapKey = await deriveWrapKey(passphrase, salt, PBKDF2_ITERATIONS);
    const ct = await crypto.subtle.encrypt(
        {name: 'AES-GCM', iv, additionalData: aad(username)},
        wrapKey,
        enc.encode(JSON.stringify(jwk)));
    return {
        v: 1, kdf: 'PBKDF2-SHA256', iter: PBKDF2_ITERATIONS,
        salt: toB64(salt), iv: toB64(iv), ct: toB64(ct)
    };
}

export async function decryptBackup(blob: BackupBlob, passphrase: string, username: string): Promise<JsonWebKey> {
    if (blob.v !== 1 || blob.kdf !== 'PBKDF2-SHA256') throw new Error('Unsupported backup format');
    if (!(blob.iter >= MIN_ITER && blob.iter <= MAX_ITER)) throw new Error('Backup has invalid parameters');

    try {
        const wrapKey = await deriveWrapKey(passphrase, fromB64(blob.salt), blob.iter);
        const plain = await crypto.subtle.decrypt(
            {name: 'AES-GCM', iv: fromB64(blob.iv), additionalData: aad(username)},
            wrapKey,
            fromB64(blob.ct));
        return JSON.parse(dec.decode(plain)) as JsonWebKey;
    } catch {
        // AES-GCM authentication failure: wrong passphrase OR tampered/corrupted blob
        throw new Error('Wrong passphrase, or the backup is corrupted');
    }
}
