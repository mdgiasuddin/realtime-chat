import {createContext} from 'react';
import type {ChatApi} from '../api/endpoints';
import type {LoginRequest, RegisterRequest} from '../types/api';

/** The logged-in user. Stays the same object while the access token is refreshed underneath. */
export interface AuthUser {
    username: string;
    name: string;
}

export interface AuthContextValue {
    user: AuthUser | null;
    login: (credentials: LoginRequest) => Promise<void>;
    register: (data: RegisterRequest) => Promise<void>;
    logout: () => void;
    /** The current access token, refreshed first if it's about to expire; null once logged out. */
    getAccessToken: () => Promise<string | null>;
    /** Authenticated endpoints; always use the current token. */
    chatApi: ChatApi;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
