import type {ChatApi} from '../api/endpoints';
import {loadKeyPair, saveKeyPair} from './keyStore';
import {
    type BackupBlob,
    decryptBackup,
    encryptBackup,
    exportPublicKey,
    generateIdentity,
    importIdentity
} from './keyBackup';

type KeyApi = Pick<ChatApi, 'getMyKeys' | 'putMyKeys'>;

export type KeyStatus =
    | 'ready'            // local key exists and matches the server
    | 'needs-setup'      // no key anywhere: create one + backup
    | 'needs-restore'    // backup on server, nothing on this device
    | 'mismatch';        // local key differs from the server's public key

export async function checkKeyStatus(username: string, api: KeyApi): Promise<KeyStatus> {
    const [local, remote] = await Promise.all([loadKeyPair(username), api.getMyKeys()]);

    if (local) {
        if (!remote.publicKey) return 'needs-setup'; // e.g. DB reset: the server has nothing
        return remote.publicKey === await exportPublicKey(local.publicKey) ? 'ready' : 'mismatch';
    }
    return remote.encryptedPrivateKey ? 'needs-restore' : 'needs-setup';
}

/** First-time setup (or deliberate rotation): new key pair, encrypted backup uploaded, key stored locally. */
export async function setupKeys(username: string, passphrase: string, api: KeyApi, rotate = false): Promise<void> {
    const {pair, jwk} = await generateIdentity();
    const blob = await encryptBackup(jwk, passphrase, username);

    // Upload first: if this fails nothing is stored locally and the user can simply retry.
    await api.putMyKeys({
        publicKey: await exportPublicKey(pair.publicKey),
        encryptedPrivateKey: JSON.stringify(blob),
        rotate
    });
    await saveKeyPair(username, pair);
}

async function fetchBackup(api: KeyApi): Promise<{ publicKey: string; blob: BackupBlob }> {
    const remote = await api.getMyKeys();
    if (!remote.encryptedPrivateKey || !remote.publicKey) throw new Error('No backup found for this account');
    return {publicKey: remote.publicKey, blob: JSON.parse(remote.encryptedPrivateKey) as BackupBlob};
}

/** New device / cleared browser: download the blob, decrypt with the passphrase, store locally. */
export async function restoreKeys(username: string, passphrase: string, api: KeyApi): Promise<void> {
    const {publicKey, blob} = await fetchBackup(api);
    const pair = await importIdentity(await decryptBackup(blob, passphrase, username));

    if (await exportPublicKey(pair.publicKey) !== publicKey) {
        throw new Error('The backup does not match the public key registered for this account');
    }
    await saveKeyPair(username, pair);
}

/**
 * Change the recovery passphrase. The local key is non-extractable, so we re-wrap the *backup*:
 * decrypt it with the old passphrase, encrypt it with the new one, upload (same public key, no rotation).
 */
export async function changePassphrase(
    username: string, oldPassphrase: string, newPassphrase: string, api: KeyApi
): Promise<void> {
    const {publicKey, blob} = await fetchBackup(api);
    const jwk = await decryptBackup(blob, oldPassphrase, username);
    await api.putMyKeys({
        publicKey,
        encryptedPrivateKey: JSON.stringify(await encryptBackup(jwk, newPassphrase, username)),
        rotate: false
    });
}
