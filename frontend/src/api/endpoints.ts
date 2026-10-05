import {request, type RequestOptions} from './client';
import type {AuthResponse, ChatMessage, Conversation, LoginRequest, RegisterRequest, UserSummary} from '../types/api';

/** Public endpoints (no JWT needed). */
export const authApi = {
    login: (credentials: LoginRequest) =>
        request<AuthResponse>('/api/auth/login', {method: 'POST', body: credentials}),

    register: (data: RegisterRequest) =>
        request<void>('/api/auth/register', {method: 'POST', body: data})
};

export type AuthedRequestOptions = Omit<RequestOptions, 'token' | 'onUnauthorized'>;

/** A `request` with the current user's JWT already bound to it. */
export type AuthedRequest = <T>(path: string, options?: AuthedRequestOptions) => Promise<T>;

/** Endpoints that require a logged-in user. */
export function createChatApi(authed: AuthedRequest) {
    return {
        searchUsers: (query: string, signal?: AbortSignal) =>
            authed<UserSummary[]>(`/api/users/search?q=${encodeURIComponent(query)}`, {signal}),

        getConversations: () =>
            authed<Conversation[]>('/api/messages/conversations'),

        /** Returns the newest messages first. */
        getHistory: (username: string, page = 0, size = 50) =>
            authed<ChatMessage[]>(`/api/messages/${encodeURIComponent(username)}?page=${page}&size=${size}`)
    };
}

export type ChatApi = ReturnType<typeof createChatApi>;
