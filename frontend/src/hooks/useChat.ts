import {useCallback, useEffect, useRef, useState} from 'react';
import type {ChatApi} from '../api/endpoints';
import type {ChatMessage, Conversation} from '../types/api';
import {getErrorMessage} from '../utils/errors';

const HISTORY_PAGE_SIZE = 50;

/** username -> number of unread messages */
export type UnreadCounts = Record<string, number>;

interface ChatOptions {
    /** Username of the logged-in user. */
    me: string;
    chatApi: ChatApi;
    onNotify: (message: string) => void;
}

/** Moves the conversation with `username` to the top, updating its preview. */
function bumpConversation(list: Conversation[], username: string, message: ChatMessage): Conversation[] {
    return [
        {username, lastMessage: message.content, lastSentAt: message.sentAt},
        ...list.filter((c) => c.username !== username)
    ];
}

/** History goes first; live messages that arrived while it was loading are kept, without duplicates. */
function mergeHistory(history: ChatMessage[], live: ChatMessage[]): ChatMessage[] {
    const ids = new Set(history.map((m) => m.id));
    return [...history, ...live.filter((m) => !ids.has(m.id))];
}

/** Conversation list, unread counters and the messages of the open chat. */
export function useChat({me, chatApi, onNotify}: ChatOptions) {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [unread, setUnread] = useState<UnreadCounts>({});
    const [activeUser, setActiveUser] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    const activeRef = useRef<string | null>(null); // lets async callbacks read the current chat

    useEffect(() => {
        chatApi.getConversations()
            .then(setConversations)
            .catch((err: unknown) => onNotify(getErrorMessage(err)));
    }, [chatApi, onNotify]);

    /** Handles incoming (and echoed) messages from the WebSocket. */
    const receiveMessage = useCallback((message: ChatMessage) => {
        const isMine = message.sender === me;
        const other = isMine ? message.receiver : message.sender;

        setConversations((prev) => bumpConversation(prev, other, message));

        if (activeRef.current === other) {
            setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
        } else if (!isMine) {
            setUnread((prev) => ({...prev, [other]: (prev[other] ?? 0) + 1}));
            onNotify(`New message from @${message.sender}`);
        }
    }, [me, onNotify]);

    /** Opens a conversation and loads its history. */
    const openConversation = useCallback(async (username: string) => {
        activeRef.current = username;
        setActiveUser(username);
        setMessages([]);
        setUnread((prev) => ({...prev, [username]: 0}));
        try {
            const page = await chatApi.getHistory(username, 0, HISTORY_PAGE_SIZE);
            if (activeRef.current !== username) return; // user switched chats while loading
            const history = page.toReversed();          // API returns newest first
            setMessages((prev) => mergeHistory(history, prev));
        } catch (err) {
            onNotify(getErrorMessage(err));
        }
    }, [chatApi, onNotify]);

    return {conversations, unread, activeUser, messages, receiveMessage, openConversation};
}
