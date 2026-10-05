import {useCallback, useEffect, useEffectEvent, useRef, useState} from 'react';
import {Client} from '@stomp/stompjs';
import {wsUrl} from '../api/client';
import type {ChatMessage, ErrorResponse, SendMessageRequest} from '../types/api';

const RECONNECT_DELAY_MS = 5000;

const Destinations = {
    send: '/app/chat.send',
    messages: '/user/queue/messages',
    errors: '/user/queue/errors'
} as const;

interface ChatSocketOptions {
    token: string;
    /** Called for every message delivered to (or echoed back to) the current user. */
    onMessage: (message: ChatMessage) => void;
    /** Called for server-side errors / connection errors. */
    onError: (message: string) => void;
}

interface ChatSocket {
    connected: boolean;
    /** Returns false if the socket isn't connected (the message is NOT queued). */
    send: (to: string, content: string) => boolean;
}

/** Opens a STOMP-over-WebSocket connection authenticated with the JWT. */
export function useChatSocket({token, onMessage, onError}: ChatSocketOptions): ChatSocket {
    const [connected, setConnected] = useState(false);
    const clientRef = useRef<Client | null>(null);

    // Effect events always see the latest callbacks, so the socket isn't recreated on every render.
    const handleMessage = useEffectEvent(onMessage);
    const handleError = useEffectEvent(onError);

    useEffect(() => {
        const client = new Client({
            brokerURL: wsUrl(),
            connectHeaders: {Authorization: `Bearer ${token}`},
            reconnectDelay: RECONNECT_DELAY_MS,
            onConnect: () => {
                setConnected(true);
                client.subscribe(Destinations.messages, (frame) =>
                    handleMessage(JSON.parse(frame.body) as ChatMessage));
                client.subscribe(Destinations.errors, (frame) =>
                    handleError((JSON.parse(frame.body) as ErrorResponse).error));
            },
            onWebSocketClose: () => setConnected(false),
            onStompError: (frame) => handleError(frame.headers.message ?? 'WebSocket error')
        });

        client.activate();
        clientRef.current = client;

        return () => {
            void client.deactivate();
            clientRef.current = null;
        };
    }, [token]);

    const send = useCallback((to: string, content: string) => {
        const client = clientRef.current;
        if (!client?.connected) return false;
        const body: SendMessageRequest = {to, content};
        client.publish({destination: Destinations.send, body: JSON.stringify(body)});
        return true;
    }, []);

    return {connected, send};
}
