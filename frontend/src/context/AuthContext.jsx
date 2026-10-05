import {createContext, useCallback, useContext, useMemo, useState} from 'react';
import {request} from '../api.js';

const AuthContext = createContext(null);
const STORAGE_KEY = 'chat-auth';

function loadStored() {
    try {
        return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || null;
    } catch {
        return null;
    }
}

export function AuthProvider({children}) {
    // { token, username, name } or null.
    // sessionStorage = per-tab, so you can log in as different users in two tabs while testing.
    const [auth, setAuth] = useState(loadStored);

    const logout = useCallback(() => {
        sessionStorage.removeItem(STORAGE_KEY);
        setAuth(null);
    }, []);

    const login = useCallback(async (username, password) => {
        const r = await request('/api/auth/login', {method: 'POST', body: {username, password}});
        const value = {token: r.token, username: r.username, name: r.name};
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
        setAuth(value);
    }, []);

    const register = useCallback(async (data) => {
        await request('/api/auth/register', {method: 'POST', body: data});
        await login(data.username, data.password);
    }, [login]);

    // Authenticated API helper: api('/api/users/search?q=bo')
    const api = useCallback(
        (path, options = {}) => request(path, {...options, token: auth?.token, onUnauthorized: logout}),
        [auth, logout]
    );

    const value = useMemo(
        () => ({user: auth, token: auth?.token, login, register, logout, api}),
        [auth, login, register, logout, api]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
    return ctx;
}
