import {type ReactNode, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ApiError, request} from '../api/client';
import {authApi, type AuthedRequestOptions, createChatApi} from '../api/endpoints';
import type {LoginRequest, RegisterRequest} from '../types/api';
import {AuthContext, type AuthContextValue, type AuthUser} from './AuthContext';
import {
    loadSession,
    needsRefresh,
    onSessionChange,
    REFRESH_MARGIN_MS,
    refreshSession,
    saveSession,
    type Session,
    toSession
} from './session';

/** After a refresh failed for lack of network, try again this soon. */
const REFRESH_RETRY_MS = 30_000;

export function AuthProvider({children}: { children: ReactNode }) {
    // A stored session means someone is logged in in this browser: straight to the chat. If its access token has
    // expired meanwhile, the first request refreshes it.
    const [session, setSession] = useState<Session | null>(loadSession);
    /** The latest session, for callbacks that must not change identity whenever the token does. */
    const sessionRef = useRef(session);
    const refreshing = useRef<Promise<Session | null> | null>(null);

    const applySession = useCallback((next: Session | null) => {
        sessionRef.current = next;
        setSession(next);
    }, []);

    /** One refresh at a time per tab (refreshSession coordinates between tabs). */
    const refresh = useCallback((staleToken: string | undefined) => {
        refreshing.current ??= refreshSession(staleToken)
            .then((next) => {
                applySession(next);
                return next;
            })
            .finally(() => {
                refreshing.current = null;
            });
        return refreshing.current;
    }, [applySession]);

    // Other tabs logged in, out, or refreshed the token.
    useEffect(() => onSessionChange(applySession), [applySession]);

    // Refresh shortly before the access token expires. Rescheduled whenever the session changes, here or elsewhere.
    useEffect(() => {
        if (!session) return undefined;
        let timer: ReturnType<typeof setTimeout>;
        const schedule = (delay: number) => {
            timer = setTimeout(() => {
                refresh(session.token).catch(() => schedule(REFRESH_RETRY_MS));
            }, delay);
        };
        schedule(Math.max(0, session.expiresAt - REFRESH_MARGIN_MS - Date.now()));
        return () => clearTimeout(timer);
    }, [session, refresh]);

    const getAccessToken = useCallback(async () => {
        const current = sessionRef.current;
        if (!current) return null;
        if (!needsRefresh(current)) return current.token;
        try {
            return (await refresh(current.token))?.token ?? null;
        } catch (err) {
            // Offline: the old token may still be good for a minute or two.
            if (current.expiresAt > Date.now()) return current.token;
            throw err;
        }
    }, [refresh]);

    const logout = useCallback(() => {
        saveSession(null);
        applySession(null);
        // Revoke the refresh token too; if that fails, the cookie is still replaced by the next login.
        authApi.logout().catch(() => undefined);
    }, [applySession]);

    const login = useCallback(async (credentials: LoginRequest) => {
        const next = toSession(await authApi.login(credentials));
        saveSession(next);
        applySession(next);
    }, [applySession]);

    const register = useCallback(async (data: RegisterRequest) => {
        await authApi.register(data);
        await login({username: data.username, password: data.password});
    }, [login]);

    // Stable: reads the token at call time, so a refresh doesn't recreate everything built on chatApi.
    const chatApi = useMemo(() => createChatApi(async <T, >(path: string, options?: AuthedRequestOptions) => {
        const token = await getAccessToken();
        if (!token) throw new ApiError('Session expired, please log in again', 401);
        try {
            return await request<T>(path, {...options, token});
        } catch (err) {
            if (!(err instanceof ApiError && err.status === 401)) throw err;
            // Rejected before we expected it to expire: refresh once and retry once.
            const next = await refresh(token);
            if (!next) throw err;
            return request<T>(path, {...options, token: next.token});
        }
    }), [getAccessToken, refresh]);

    const username = session?.username;
    const name = session?.name;
    const user = useMemo<AuthUser | null>(
        () => (username !== undefined && name !== undefined ? {username, name} : null),
        [username, name]
    );

    const value = useMemo<AuthContextValue>(
        () => ({user, login, register, logout, getAccessToken, chatApi}),
        [user, login, register, logout, getAccessToken, chatApi]
    );

    return <AuthContext value={value}>{children}</AuthContext>;
}
