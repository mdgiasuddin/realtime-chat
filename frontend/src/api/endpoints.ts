import {request, type RequestOptions} from './client';
import type {
    AddMembersRequest,
    AuthResponse,
    ChatMessage,
    Conversation,
    CreateGroupRequest,
    Group,
    LoginRequest,
    RegisterRequest,
    RenameGroupRequest,
    UpdateMemberRequest,
    UserSummary
} from '../types/api';

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

        /** Direct chats and groups, most recent activity first. */
        getConversations: () =>
            authed<Conversation[]>('/api/messages/conversations'),

        /** Returns the newest messages first. */
        getHistory: (username: string, page = 0, size = 50) =>
            authed<ChatMessage[]>(`/api/messages/${encodeURIComponent(username)}?page=${page}&size=${size}`),

        createGroup: (data: CreateGroupRequest) =>
            authed<Group>('/api/groups', {method: 'POST', body: data}),

        getGroup: (groupId: number) =>
            authed<Group>(`/api/groups/${groupId}`),

        addMembers: (groupId: number, data: AddMembersRequest) =>
            authed<Group>(`/api/groups/${groupId}/members`, {method: 'POST', body: data}),

        leaveGroup: (groupId: number) =>
            authed<void>(`/api/groups/${groupId}/members/me`, {method: 'DELETE'}),

        // Admin only:
        renameGroup: (groupId: number, data: RenameGroupRequest) =>
            authed<Group>(`/api/groups/${groupId}`, {method: 'PATCH', body: data}),

        deleteGroup: (groupId: number) =>
            authed<void>(`/api/groups/${groupId}`, {method: 'DELETE'}),

        removeMember: (groupId: number, username: string) =>
            authed<Group>(`/api/groups/${groupId}/members/${encodeURIComponent(username)}`, {method: 'DELETE'}),

        updateMember: (groupId: number, username: string, data: UpdateMemberRequest) =>
            authed<Group>(`/api/groups/${groupId}/members/${encodeURIComponent(username)}`, {
                method: 'PATCH',
                body: data
            }),

        /** Returns the newest messages first. */
        getGroupHistory: (groupId: number, page = 0, size = 50) =>
            authed<ChatMessage[]>(`/api/groups/${groupId}/messages?page=${page}&size=${size}`)
    };
}

export type ChatApi = ReturnType<typeof createChatApi>;
