import {createContext} from 'react';
import type {ChatApi} from '../api/endpoints';
import type {AuthResponse, LoginRequest, RegisterRequest} from '../types/api';

/** The logged-in user, exactly as returned by /api/auth/login. */
export type AuthUser = AuthResponse;

export interface AuthContextValue {
    user: AuthUser | null;
    login: (credentials: LoginRequest) => Promise<void>;
    register: (data: RegisterRequest) => Promise<void>;
    logout: () => void;
    /** Authenticated endpoints, bound to the current user's token. */
    chatApi: ChatApi;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
