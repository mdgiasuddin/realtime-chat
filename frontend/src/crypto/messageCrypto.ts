// End-to-end message encryption. Every message gets a fresh AES-256-GCM key; that key is wrapped once per
// recipient (the sender included, so they can read their own history) with an AES key derived via ECDH from
// the sender's private key and the recipient's public key. Direct chats are simply a two-recipient case.

import {ECDH, fromB64, toB64} from './encoding';

/** What gets stored as ChatMessage.content (JSON text). The server cannot read any of it. */
export interface Envelope {
    e2ee: 1;
    /** Sender's public key (base64 SPKI) at send time, so history survives the sender rotating later. */
    spk: string;
    /** Base64 IV + ciphertext of the message text. */
    iv: string;
    ct: string;
    /** username -> the message key, wrapped for that recipient. */
    keys: Record<string, { iv: string; wk: string }>;
}

/** Where a message is going, as bound into the ciphertext: "u:<receiver>" or "g:<groupId>". */
export type RecipientTag = `u:${string}` | `g:${number}`;

const enc = new TextEncoder();
const dec = new TextDecoder();

// Associated data binds every ciphertext to its sender and destination, so the server can't relabel a message
// (e.g. present it as coming from someone else, or move it to another chat) without decryption failing.
const contentAad = (sender: string, to: RecipientTag) => enc.encode(`chat-msg:v1:${sender}>${to}`);
const wrapAad = (sender: string, recipient: string) => enc.encode(`chat-wrap:v1:${sender}>${recipient}`);

export function parseEnvelope(content: string): Envelope | null {
    if (!content.startsWith('{')) return null;
    try {
        const parsed = JSON.parse(content) as Partial<Envelope>;
        return parsed.e2ee === 1 && typeof parsed.spk === 'string' && typeof parsed.keys === 'object'
            ? parsed as Envelope
            : null;
    } catch {
        return null;
    }
}

/**
 * Derives (and caches) the pairwise AES key between my private key and a peer's public key. ECDH is
 * symmetric, so the peer derives the same key from their private key and my public key.
 */
export class SharedKeyCache {
    private readonly cache = new Map<string, Promise<CryptoKey>>();
    private readonly privateKey: CryptoKey;

    constructor(privateKey: CryptoKey) {
        this.privateKey = privateKey;
    }

    get(peerPublicKey: string): Promise<CryptoKey> {
        let key = this.cache.get(peerPublicKey);
        if (!key) {
            key = this.derive(peerPublicKey);
            key.catch(() => this.cache.delete(peerPublicKey)); // don't cache a bad key forever
            this.cache.set(peerPublicKey, key);
        }
        return key;
    }

    private async derive(peerPublicKey: string): Promise<CryptoKey> {
        const peer = await crypto.subtle.importKey('spki', fromB64(peerPublicKey), ECDH, false, []);
        return crypto.subtle.deriveKey(
            {name: 'ECDH', public: peer},
            this.privateKey,
            {name: 'AES-GCM', length: 256},
            false,
            ['encrypt', 'decrypt']);
    }
}

/**
 * @param recipients username -> public key (base64 SPKI); must include the sender
 */
export async function encryptMessage(
    text: string,
    sender: string,
    senderPublicKey: string,
    to: RecipientTag,
    recipients: Map<string, string>,
    sharedKeys: SharedKeyCache
): Promise<string> {
    const messageKey = await crypto.subtle.generateKey({name: 'AES-GCM', length: 256}, true, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt(
        {name: 'AES-GCM', iv, additionalData: contentAad(sender, to)}, messageKey, enc.encode(text));
    const rawKey = await crypto.subtle.exportKey('raw', messageKey);

    const keys: Envelope['keys'] = {};
    await Promise.all([...recipients].map(async ([username, publicKey]) => {
        const wrapIv = crypto.getRandomValues(new Uint8Array(12));
        const wrapped = await crypto.subtle.encrypt(
            {name: 'AES-GCM', iv: wrapIv, additionalData: wrapAad(sender, username)},
            await sharedKeys.get(publicKey),
            rawKey);
        keys[username] = {iv: toB64(wrapIv), wk: toB64(wrapped)};
    }));

    const envelope: Envelope = {e2ee: 1, spk: senderPublicKey, iv: toB64(iv), ct: toB64(ct), keys};
    return JSON.stringify(envelope);
}

/** Throws if the message wasn't encrypted for `me`, or if anything fails to authenticate. */
export async function decryptMessage(
    envelope: Envelope,
    me: string,
    sender: string,
    to: RecipientTag,
    sharedKeys: SharedKeyCache
): Promise<string> {
    const mine = envelope.keys[me];
    if (!mine) throw new Error('Not encrypted for this user');

    const rawKey = await crypto.subtle.decrypt(
        {name: 'AES-GCM', iv: fromB64(mine.iv), additionalData: wrapAad(sender, me)},
        await sharedKeys.get(envelope.spk),
        fromB64(mine.wk));
    const messageKey = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt']);
    const plain = await crypto.subtle.decrypt(
        {name: 'AES-GCM', iv: fromB64(envelope.iv), additionalData: contentAad(sender, to)},
        messageKey,
        fromB64(envelope.ct));
    return dec.decode(plain);
}
