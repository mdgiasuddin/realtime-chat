import {use} from 'react';
import {AuthContext, type AuthContextValue} from '../context/AuthContext';

export function useAuth(): AuthContextValue {
    const ctx = use(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
    return ctx;
}
