import {ApiError} from '../api/client';
import {authApi} from '../api/endpoints';
import type {AuthResponse} from '../types/api';

// localStorage is shared by all tabs, so one user is logged in per browser (the refresh-token cookie is per browser
// anyway). Tabs follow each other's logins, refreshes and logouts through the `storage` event.
const STORAGE_KEY = 'chat-auth';
const REFRESH_LOCK = 'chat-auth-refresh';

/** Refresh the access token this long before it expires. */
export const REFRESH_MARGIN_MS = 2 * 60 * 1000;

export interface Session {
    /** Access token (JWT). */
    token: string;
    username: string;
    name: string;
    /** When `token` expires, in this browser's clock (epoch ms). */
    expiresAt: number;
}

export function toSession({token, username, name, expiresIn}: AuthResponse): Session {
    return {token, username, name, expiresAt: Date.now() + expiresIn * 1000};
}

export function loadSession(): Session | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
        return null;
    }
}

export function saveSession(session: Session | null): void {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
}

export const needsRefresh = (session: Session): boolean =>
    session.expiresAt - Date.now() <= REFRESH_MARGIN_MS;

/** Calls `listener` with the stored session whenever another tab changes it. Returns the unsubscribe function. */
export function onSessionChange(listener: (session: Session | null) => void): () => void {
    const handle = (e: StorageEvent) => {
        if (e.key === STORAGE_KEY || e.key === null) listener(loadSession());
    };
    window.addEventListener('storage', handle);
    return () => window.removeEventListener('storage', handle);
}

/**
 * Exchanges the refresh-token cookie for a new access token and stores it.
 * Resolves to null if the session is over (the refresh token expired or was revoked); rejects on network errors.
 *
 * Tabs take turns (Web Locks), since the refresh token is single-use: a tab that waited finds the token another tab
 * just stored and uses that instead of refreshing again.
 *
 * @param staleToken the access token the caller has; if a different, fresh one is stored by now, that one is used
 */
export async function refreshSession(staleToken: string | undefined): Promise<Session | null> {
    const run = async (): Promise<Session | null> => {
        const stored = loadSession();
        if (stored && stored.token !== staleToken && !needsRefresh(stored)) return stored;
        try {
            const next = toSession(await authApi.refresh());
            saveSession(next);
            return next;
        } catch (err) {
            if (err instanceof ApiError && err.status === 401) {
                saveSession(null);
                return null;
            }
            throw err;
        }
    };
    // Web Locks only exist in secure contexts (HTTPS / localhost).
    return 'locks' in navigator ? navigator.locks.request(REFRESH_LOCK, run) : run();
}
