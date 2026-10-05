// Empty string => same origin (Vite proxy in dev, reverse proxy in prod).
const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

/** WebSocket URL for the STOMP endpoint. */
export function wsUrl() {
    if (API_URL) return API_URL.replace(/^http/, 'ws') + '/ws';
    const scheme = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    return `${scheme}${window.location.host}/ws`;
}

/**
 * Small fetch wrapper: adds JSON headers + JWT, throws Error(message) on non-2xx.
 * onUnauthorized is called on 401 for authenticated calls (e.g. expired token).
 */
export async function request(path, {method = 'GET', body, token, onUnauthorized} = {}) {
    const headers = {'Content-Type': 'application/json'};
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(API_URL + path, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 401 && token) {
        onUnauthorized?.();
        throw new Error('Session expired, please log in again');
    }
    if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
}
