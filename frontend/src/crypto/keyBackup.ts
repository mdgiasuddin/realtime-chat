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

/**
 * Web Crypto (crypto.subtle) only exists in a secure context: HTTPS or http://localhost.
 * Fail early with a clear message instead of a confusing TypeError deep inside a crypto call.
 */
export function requireSecureCrypto(): void {
    if (!globalThis.isSecureContext || !globalThis.crypto?.subtle) {
        throw new Error(
            'Encryption requires a secure connection. Open the app over HTTPS (or http://localhost).');
    }
}

/** Binds the ciphertext to this account and format: a blob moved to another user fails to decrypt. */
const aad = (username: string) => enc.encode(`chat-key-backup:v1:${username}`);

async function deriveWrapKey(passphrase: string, salt: BufferSource, iterations: number): Promise<CryptoKey> {
    requireSecureCrypto();
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
    requireSecureCrypto();
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
    requireSecureCrypto();
    const temp = await crypto.subtle.generateKey(ECDH, true, ['deriveKey']);
    const jwk = await crypto.subtle.exportKey('jwk', temp.privateKey);
    return {pair: await importIdentity(jwk), jwk};
}

export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
    requireSecureCrypto();
    return toB64(await crypto.subtle.exportKey('spki', publicKey));
}

export async function encryptBackup(jwk: JsonWebKey, passphrase: string, username: string): Promise<BackupBlob> {
    requireSecureCrypto();
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

/** Base64-decode a blob field, reporting malformed input as a corrupted backup. */
function decodeField(value: string) {
    try {
        return fromB64(value);
    } catch {
        throw new Error('The backup is corrupted');
    }
}

export async function decryptBackup(blob: BackupBlob, passphrase: string, username: string): Promise<JsonWebKey> {
    requireSecureCrypto();
    if (blob.v !== 1 || blob.kdf !== 'PBKDF2-SHA256') throw new Error('Unsupported backup format');
    if (!(blob.iter >= MIN_ITER && blob.iter <= MAX_ITER)) throw new Error('Backup has invalid parameters');

    const salt = decodeField(blob.salt);
    const iv = decodeField(blob.iv);
    const ct = decodeField(blob.ct);

    // Not inside a try/catch on purpose: real failures here (e.g. no crypto support) must surface as-is.
    const wrapKey = await deriveWrapKey(passphrase, salt, blob.iter);

    let plain: ArrayBuffer;
    try {
        plain = await crypto.subtle.decrypt(
            {name: 'AES-GCM', iv, additionalData: aad(username)},
            wrapKey,
            ct);
    } catch {
        // Only an AES-GCM authentication failure lands here: wrong passphrase OR tampered/corrupted blob.
        throw new Error('Wrong passphrase, or the backup is corrupted');
    }

    try {
        return JSON.parse(dec.decode(plain)) as JsonWebKey;
    } catch {
        throw new Error('The backup is corrupted');
    }
}