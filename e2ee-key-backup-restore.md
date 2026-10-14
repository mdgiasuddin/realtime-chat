# E2EE private-key backup & restore (PBKDF2 + AES-GCM)

> Status: written for your existing TypeScript frontend and Spring Boot backend. **Not compiled or run**, so expect
> small fixes (import paths, your `ChatApi` shape). Treat it as a teaching implementation, not audited crypto code.

## 1. Idea in one picture

```
SETUP (first login, no key anywhere)
  browser: generate ECDH key pair (private key extractable ONLY for this moment)
           ├─ export private key as JWK
           ├─ salt + passphrase ──PBKDF2(600k)──► AES-256 "wrapping key"
           ├─ AES-GCM encrypt JWK  ─► encrypted blob
           ├─ PUT /api/users/me/keys { publicKey, encryptedPrivateKey }   (server stores blob it cannot read)
           └─ re-import private key as NON-extractable ─► IndexedDB

RESTORE (new device / cleared browser)
  GET /api/users/me/keys ─► blob + publicKey
  passphrase + blob.salt ──PBKDF2──► wrapping key ─► AES-GCM decrypt ─► JWK
  import (non-extractable) ─► verify public key == server's ─► IndexedDB
```

The server only ever stores: the **public key** (not secret) and an **encrypted blob**. It never sees the passphrase or
the private key.

Use a **separate recovery passphrase**, never the login password, because the server receives the login password on
every login.

---

## 2. Backend

### 2.1 `User` entity: two new columns

```java
@Column(name = "public_key", length = 500)
private String publicKey;          // base64 SPKI, safe to share

@Column(name = "key_backup", length = 4000)
private String keyBackup;          // JSON blob, encrypted client-side (opaque to the server)
```

With `ddl-auto: update` the columns are added automatically. Use a Flyway/Liquibase migration in production.

### 2.2 DTOs

```java
public record PutKeysRequest(
        @NotBlank @Size(max = 500) String publicKey,
        @NotBlank @Size(max = 4000) String encryptedPrivateKey,
        boolean rotate) {}                       // true = user knowingly replaces their key pair

public record KeyBundleResponse(String publicKey, String encryptedPrivateKey) {}

public record PublicKeyResponse(String username, String publicKey) {}
```

### 2.3 `KeyController`

```java
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class KeyController {

    private final UserRepository users;

    /** My own public key + encrypted backup (only the owner can read this). */
    @GetMapping("/me/keys")
    public KeyBundleResponse myKeys(Principal me) {
        User u = users.findByUsername(me.getName()).orElseThrow();
        return new KeyBundleResponse(u.getPublicKey(), u.getKeyBackup());
    }

    /** Store or update my key bundle. Changing the public key requires rotate=true. */
    @PutMapping("/me/keys")
    public ResponseEntity<Map<String, String>> putMyKeys(@Valid @RequestBody PutKeysRequest r, Principal me) {
        User u = users.findByUsername(me.getName()).orElseThrow();

        boolean replacingKey = u.getPublicKey() != null && !u.getPublicKey().equals(r.publicKey());
        if (replacingKey && !r.rotate()) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                    "error", "A different public key is already registered. Restore your backup or confirm key rotation."));
        }

        u.setPublicKey(r.publicKey());
        u.setKeyBackup(r.encryptedPrivateKey());
        users.save(u);
        return ResponseEntity.ok(Map.of("message", "Keys saved"));
    }

    /** Anyone logged in may fetch another user's public key (needed to encrypt to them). */
    @GetMapping("/{username}/public-key")
    public ResponseEntity<?> publicKey(@PathVariable String username) {
        return users.findByUsername(username.toLowerCase(Locale.ROOT))
                .filter(u -> u.getPublicKey() != null)
                .<ResponseEntity<?>>map(u -> ResponseEntity.ok(new PublicKeyResponse(u.getUsername(), u.getPublicKey())))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "No public key registered for this user")));
    }
}
```

Imports: `jakarta.validation.Valid`, `org.springframework.http.*`, `org.springframework.web.bind.annotation.*`,
`java.security.Principal`, `java.util.*`.

These routes don't clash with `UserController` (`/search`, `/{username}/online`).

---

## 3. Frontend

### 3.1 `crypto/keyStore.ts`: IndexedDB persistence

```ts
function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('chat-keys', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('keys');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

/** CryptoKey objects can be stored directly; non-extractable keys stay unreadable to JS. */
export async function saveKeyPair(username: string, pair: CryptoKeyPair): Promise<void> {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('keys', 'readwrite');
        tx.objectStore('keys').put(pair, username);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    // Ask the browser not to evict this origin's storage under pressure (best effort).
    await navigator.storage?.persist?.();
}

export async function loadKeyPair(username: string): Promise<CryptoKeyPair | undefined> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const req = db.transaction('keys').objectStore('keys').get(username);
        req.onsuccess = () => resolve(req.result as CryptoKeyPair | undefined);
        req.onerror = () => reject(req.error);
    });
}

export async function deleteKeyPair(username: string): Promise<void> {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('keys', 'readwrite');
        tx.objectStore('keys').delete(username);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}
```

### 3.2 `crypto/keyBackup.ts`: PBKDF2 + AES-GCM

```ts
const ECDH = {name: 'ECDH', namedCurve: 'P-256'} as const;
const PBKDF2_ITERATIONS = 600_000;          // OWASP guidance for PBKDF2-HMAC-SHA256
const MIN_ITER = 100_000;
const MAX_ITER = 5_000_000;                 // refuse absurd server-supplied values

const enc = new TextEncoder();
const dec = new TextDecoder();

const toB64 = (buf: ArrayBuffer | Uint8Array): string => {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let s = '';
    bytes.forEach((b) => (s += String.fromCharCode(b)));
    return btoa(s);
};
const fromB64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** What gets uploaded (as JSON text). Versioned so the KDF can be upgraded later (e.g. Argon2id). */
export interface BackupBlob {
    v: 1;
    kdf: 'PBKDF2-SHA256';
    iter: number;
    salt: string;   // base64
    iv: string;     // base64
    ct: string;     // base64 AES-GCM ciphertext of the private-key JWK
}

/** Binds the ciphertext to this account and format: a blob moved to another user fails to decrypt. */
const aad = (username: string) => enc.encode(`chat-key-backup:v1:${username}`);

async function deriveWrapKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
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
    if (blob.iter < MIN_ITER || blob.iter > MAX_ITER) throw new Error('Backup has invalid parameters');

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
```

Note: `exportKey('jwk')` on a P-256 private key includes `x`, `y` (public parts) and `d` (private). That is why restore
can rebuild the public key from the same decrypted JWK and verify it against the server.

### 3.3 `crypto/identity.ts`: setup / restore / status logic

```ts
import {loadKeyPair, saveKeyPair} from './keyStore';
import {
    decryptBackup, encryptBackup, exportPublicKey, generateIdentity, importIdentity, type BackupBlob
} from './keyBackup';

export interface KeyBundle {
    publicKey: string | null;
    encryptedPrivateKey: string | null;
}
export interface PutKeysBody {
    publicKey: string;
    encryptedPrivateKey: string;
    rotate: boolean;
}
/** Add these two methods to your ChatApi (see 3.4). */
export interface KeyApi {
    getMyKeys(): Promise<KeyBundle>;
    putMyKeys(body: PutKeysBody): Promise<unknown>;
}

export type KeyStatus =
    | 'ready'            // local key exists and matches the server
    | 'needs-setup'      // no key anywhere: create one + backup
    | 'needs-restore'    // backup on server, nothing on this device
    | 'mismatch';        // local key differs from the server's public key

export async function checkKeyStatus(username: string, api: KeyApi): Promise<KeyStatus> {
    const [local, remote] = await Promise.all([loadKeyPair(username), api.getMyKeys()]);

    if (local) {
        if (remote.publicKey && remote.publicKey !== await exportPublicKey(local.publicKey)) return 'mismatch';
        if (remote.publicKey) return 'ready';
        // local key exists but the server has nothing (e.g. DB reset): fall through to setup
        return 'needs-setup';
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

/** New device / cleared browser: download the blob, decrypt with the passphrase, store locally. */
export async function restoreKeys(username: string, passphrase: string, api: KeyApi): Promise<void> {
    const remote = await api.getMyKeys();
    if (!remote.encryptedPrivateKey || !remote.publicKey) throw new Error('No backup found for this account');

    const blob = JSON.parse(remote.encryptedPrivateKey) as BackupBlob;
    const jwk = await decryptBackup(blob, passphrase, username);
    const pair = await importIdentity(jwk);

    if (await exportPublicKey(pair.publicKey) !== remote.publicKey) {
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
    const remote = await api.getMyKeys();
    if (!remote.encryptedPrivateKey || !remote.publicKey) throw new Error('No backup found for this account');

    const jwk = await decryptBackup(JSON.parse(remote.encryptedPrivateKey) as BackupBlob, oldPassphrase, username);
    const blob = await encryptBackup(jwk, newPassphrase, username);
    await api.putMyKeys({
        publicKey: remote.publicKey,
        encryptedPrivateKey: JSON.stringify(blob),
        rotate: false
    });
}
```

### 3.4 Add the endpoints to your API layer

Adapt to however `api/endpoints.ts` builds `ChatApi`. The shape is:

```ts
// types/api.ts
export interface PublicKeyResponse { username: string; publicKey: string }

// inside createChatApi(request)
getMyKeys: () => request<KeyBundle>('/api/users/me/keys'),
putMyKeys: (body: PutKeysBody) => request<unknown>('/api/users/me/keys', {method: 'PUT', body}),
getPublicKey: (username: string) =>
    request<PublicKeyResponse>(`/api/users/${encodeURIComponent(username)}/public-key`),
```

`getPublicKey` is what you'll use later to derive the shared key when encrypting a message to someone.

### 3.5 `components/auth/KeyGate.tsx`: block the chat until the key is ready

```tsx
import {type FormEvent, type ReactNode, useEffect, useState} from 'react';
import {useAuth} from '../../hooks/useAuth';
import type {AuthUser} from '../../context/AuthContext';
import {getErrorMessage} from '../../utils/errors';
import {checkKeyStatus, type KeyStatus, restoreKeys, setupKeys} from '../../crypto/identity';

export default function KeyGate({user, children}: { user: AuthUser; children: ReactNode }) {
    const {chatApi} = useAuth();
    const [status, setStatus] = useState<KeyStatus | 'loading'>('loading');
    const [passphrase, setPassphrase] = useState('');
    const [confirm, setConfirm] = useState('');
    const [rotate, setRotate] = useState(false);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let cancelled = false;
        checkKeyStatus(user.username, chatApi)
            .then((s) => { if (!cancelled) setStatus(s); })
            .catch((e) => { if (!cancelled) setError(getErrorMessage(e)); });
        return () => { cancelled = true; };
    }, [user.username, chatApi]);

    if (status === 'ready') return <>{children}</>;

    const isSetup = status === 'needs-setup';

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        if (isSetup) {
            if (passphrase.length < 12) { setError('Use at least 12 characters (a few random words works well)'); return; }
            if (passphrase !== confirm) { setError('Passphrases do not match'); return; }
        }
        setBusy(true);
        try {
            if (isSetup) await setupKeys(user.username, passphrase, chatApi, rotate);
            else await restoreKeys(user.username, passphrase, chatApi);
            setStatus('ready');
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const startOver = () => {
        const ok = window.confirm(
            'Creating new keys means you can no longer read your previous messages, ' +
            'and your contacts will see that your key changed. Continue?');
        if (ok) { setRotate(true); setStatus('needs-setup'); setPassphrase(''); setError(''); }
    };

    if (status === 'loading') return <div className="auth-wrap"><div className="card">{error || 'Loading keys…'}</div></div>;

    return (
        <div className="auth-wrap">
            <div className="card">
                <h1>{isSetup ? 'Create your recovery passphrase' : 'Unlock your messages'}</h1>

                <p className="muted">
                    {isSetup
                        ? 'Your messages are encrypted so only you and the recipient can read them. ' +
                          'This passphrase protects the backup of your key. We cannot recover it. ' +
                          'If you forget it and lose this device, old messages are gone.'
                        : status === 'mismatch'
                            ? 'The key on this device does not match your account. Enter your recovery passphrase to restore the correct one.'
                            : 'Enter your recovery passphrase to restore your key on this device.'}
                </p>

                <form onSubmit={submit}>
                    <input type="password" placeholder="Recovery passphrase" autoComplete="off" required
                           value={passphrase} onChange={(e) => setPassphrase(e.target.value)}/>
                    {isSetup && (
                        <input type="password" placeholder="Confirm passphrase" autoComplete="off" required
                               value={confirm} onChange={(e) => setConfirm(e.target.value)}/>
                    )}
                    <button className="primary" type="submit" disabled={busy}>
                        {busy ? 'Working…' : isSetup ? 'Create keys' : 'Restore'}
                    </button>
                </form>

                {!isSetup && (
                    <button type="button" style={{marginTop: 10}} onClick={startOver}>
                        Forgot passphrase? Start over
                    </button>
                )}
                <div className="error">{error}</div>
            </div>
        </div>
    );
}
```

Wire it in `App.tsx`:

```tsx
return user
    ? <KeyGate user={user}><ChatPage user={user}/></KeyGate>
    : <AuthPage/>;
```

The PBKDF2 step takes a fraction of a second to about a second on a typical device. That is intentional, and "Working…"
covers it.

---

## 4. Security notes and limits

1. **The blob is only as strong as the passphrase.** Anyone who obtains the database can attack it offline. PBKDF2 at
   600k iterations slows this down but is GPU-friendly. Argon2id (via a WASM library such as `hash-wasm`) is stronger.
   The `kdf` and `v` fields in the blob exist so you can switch later without breaking old backups. Require long
   passphrases (12+ characters, or 4+ random words) and consider a strength meter.
2. **A stolen JWT is dangerous here.** It lets an attacker download the blob (an offline guessing target) and call
   `PUT … rotate: true`, replacing your public key with theirs so they receive your future messages. Mitigations:
   require the login password again for `rotate`, send a notification, rate-limit `/me/keys`, and have contacts' clients
   warn loudly on any key change.
3. **Key distribution is still trust-on-server.** Backup doesn't solve the man-in-the-middle problem from earlier: a
   malicious server can still hand out a wrong public key for a user. Show a fingerprint (hash of both public keys) that
   two users compare out of band.
4. **Rotation breaks history.** After "start over", old ciphertext is unreadable. Contacts' cached derived shared keys
   must be discarded when a partner's public key changes, so refetch via `getPublicKey` and compare against the cached
   one.
5. **Shared computers.** Offer "sign out and remove key from this device" that calls `deleteKeyPair(username)`.
   Otherwise the next person at that browser profile can use the stored key while it's present.
6. **The browser trust gap remains.** An XSS bug can still *use* the non-extractable key while the page is open, and the
   server still serves the JavaScript that does the crypto. Keep a strict Content-Security-Policy and minimal
   dependencies.
7. **Multi-device without restore** needs per-device keys and per-device encryption (the Signal/Matrix approach). This
   passphrase backup is the simpler alternative, where all devices share one identity key.
