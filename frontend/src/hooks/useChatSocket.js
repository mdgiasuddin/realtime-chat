import {useCallback, useEffect, useRef, useState} from 'react';
import {Client} from '@stomp/stompjs';
import {wsUrl} from '../api.js';

/**
 * Opens a STOMP-over-WebSocket connection authenticated with the JWT.
 *  - onMessage(msg): called for every message delivered to /user/queue/messages
 *  - onError(text):  called for server-side errors / connection errors
 * Returns { connected, send(to, content) }.
 */
export function useChatSocket(token, onMessage, onError) {
    const [connected, setConnected] = useState(false);
    const clientRef = useRef(null);

    // Keep latest callbacks in refs so the socket isn't recreated on every render.
    const onMessageRef = useRef(onMessage);
    const onErrorRef = useRef(onError);
    useEffect(() => {
        onMessageRef.current = onMessage;
        onErrorRef.current = onError;
    });

    useEffect(() => {
        if (!token) return undefined;

        const client = new Client({
            brokerURL: wsUrl(),
            connectHeaders: {Authorization: `Bearer ${token}`},
            reconnectDelay: 5000,
            onConnect: () => {
                setConnected(true);
                client.subscribe('/user/queue/messages', (frame) => onMessageRef.current?.(JSON.parse(frame.body)));
                client.subscribe('/user/queue/errors', (frame) => onErrorRef.current?.(JSON.parse(frame.body).error));
            },
            onWebSocketClose: () => setConnected(false),
            onStompError: (frame) => onErrorRef.current?.(frame.headers.message || 'WebSocket error')
        });

        client.activate();
        clientRef.current = client;

        return () => {
            client.deactivate();
            clientRef.current = null;
        };
    }, [token]);

    const send = useCallback((to, content) => {
        const client = clientRef.current;
        if (!client || !client.connected) return false;
        client.publish({destination: '/app/chat.send', body: JSON.stringify({to, content})});
        return true;
    }, []);

    return {connected, send};
}
