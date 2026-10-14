// IndexedDB persistence for the identity key pair. CryptoKey objects can be stored directly;
// non-extractable keys stay unreadable to JS.

const DB_NAME = 'chat-keys';
const STORE = 'keys';

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function write(op: (store: IDBObjectStore) => void): Promise<void> {
    const db = await openDb();
    try {
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            op(tx.objectStore(STORE));
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } finally {
        db.close();
    }
}

export async function saveKeyPair(username: string, pair: CryptoKeyPair): Promise<void> {
    await write((store) => store.put(pair, username));
    // Ask the browser not to evict this origin's storage under pressure (best effort).
    await navigator.storage?.persist?.();
}

export async function loadKeyPair(username: string): Promise<CryptoKeyPair | undefined> {
    const db = await openDb();
    try {
        return await new Promise((resolve, reject) => {
            const req = db.transaction(STORE).objectStore(STORE).get(username);
            req.onsuccess = () => resolve(req.result as CryptoKeyPair | undefined);
            req.onerror = () => reject(req.error);
        });
    } finally {
        db.close();
    }
}

export function deleteKeyPair(username: string): Promise<void> {
    return write((store) => store.delete(username));
}
