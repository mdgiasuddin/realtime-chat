// Empty string => same origin (Vite proxy in dev, reverse proxy in prod).
const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

/** WebSocket URL for the STOMP endpoint. */
export function wsUrl(): string {
    if (API_URL) return API_URL.replace(/^http/, 'ws') + '/ws';
    const scheme = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    return `${scheme}${window.location.host}/ws`;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
    method?: HttpMethod;
    body?: unknown;
    /** JWT; when set, a 401 is treated as an expired session. */
    token?: string;
    onUnauthorized?: () => void;
    signal?: AbortSignal;
}

/** Thrown for any non-2xx response. */
export class ApiError extends Error {
    readonly status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

/**
 * Small fetch wrapper: adds JSON headers + JWT, throws ApiError on non-2xx.
 * onUnauthorized is called on 401 for authenticated calls (e.g. expired token).
 */
export async function request<T>(
    path: string,
    {method = 'GET', body, token, onUnauthorized, signal}: RequestOptions = {}
): Promise<T> {
    const headers: Record<string, string> = {'Content-Type': 'application/json'};
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(API_URL + path, {
        method,
        headers,
        signal,
        body: body !== undefined ? JSON.stringify(body) : undefined
    });

    const data: unknown = await res.json().catch(() => null);

    if (res.status === 401 && token) {
        onUnauthorized?.();
        throw new ApiError('Session expired, please log in again', res.status);
    }
    if (!res.ok) {
        throw new ApiError(extractError(data) ?? `Request failed (${res.status})`, res.status);
    }
    return data as T;
}

function extractError(data: unknown): string | undefined {
    if (typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string') {
        return data.error;
    }
    return undefined;
}
