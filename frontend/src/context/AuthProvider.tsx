import {type ReactNode, useCallback, useMemo, useState} from 'react';
import {request} from '../api/client';
import {authApi, type AuthedRequestOptions, createChatApi} from '../api/endpoints';
import type {LoginRequest, RegisterRequest} from '../types/api';
import {AuthContext, type AuthContextValue, type AuthUser} from './AuthContext';

// sessionStorage = per-tab, so you can log in as different users in two tabs while testing.
const STORAGE_KEY = 'chat-auth';

function loadStoredUser(): AuthUser | null {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
        return null;
    }
}

export function AuthProvider({children}: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(loadStoredUser);
    const token = user?.token;

    const logout = useCallback(() => {
        sessionStorage.removeItem(STORAGE_KEY);
        setUser(null);
    }, []);

    const login = useCallback(async (credentials: LoginRequest) => {
        const {token, username, name} = await authApi.login(credentials);
        const loggedIn: AuthUser = {token, username, name};
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(loggedIn));
        setUser(loggedIn);
    }, []);

    const register = useCallback(async (data: RegisterRequest) => {
        await authApi.register(data);
        await login({username: data.username, password: data.password});
    }, [login]);

    const chatApi = useMemo(
        () => createChatApi(<T, >(path: string, options?: AuthedRequestOptions) =>
            request<T>(path, {...options, token, onUnauthorized: logout})),
        [token, logout]
    );

    const value = useMemo<AuthContextValue>(
        () => ({user, login, register, logout, chatApi}),
        [user, login, register, logout, chatApi]
    );

    return <AuthContext value={value}>{children}</AuthContext>;
}
