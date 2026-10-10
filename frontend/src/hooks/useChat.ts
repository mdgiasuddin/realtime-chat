import {useCallback, useEffect, useRef, useState} from 'react';
import {ApiError} from '../api/client';
import type {ChatApi} from '../api/endpoints';
import type {ChatMessage, Conversation, Group, GroupEvent} from '../types/api';
import {type ChatTarget, conversationTarget, messageTarget, targetKey, type TargetKey} from '../utils/conversation';
import {getErrorMessage} from '../utils/errors';

const HISTORY_PAGE_SIZE = 50;

/** chat key ("u:bob" / "g:12") -> number of unread messages */
export type UnreadCounts = Record<TargetKey, number>;

interface ChatOptions {
    /** Username of the logged-in user. */
    me: string;
    chatApi: ChatApi;
    onNotify: (message: string) => void;
}

const isTarget = (target: ChatTarget | null, key: TargetKey): boolean =>
    target !== null && targetKey(target) === key;

const findConversation = (list: Conversation[], key: TargetKey): Conversation | undefined =>
    list.find((c) => targetKey(conversationTarget(c)) === key);

/** Moves the chat `message` belongs to the top, updating its preview. Unknown groups are left out. */
function bumpConversation(list: Conversation[], target: ChatTarget, message: ChatMessage): Conversation[] {
    const existing = findConversation(list, targetKey(target));
    const preview = {lastMessage: message.content, lastSender: message.sender, lastSentAt: message.sentAt};
    let updated: Conversation;
    if (target.type === 'direct') updated = {type: 'direct', username: target.username, ...preview};
    else if (existing) updated = {...existing, ...preview};
    else return list;
    return [updated, ...list.filter((c) => c !== existing)];
}

/** Adds a group I just joined at the top, or refreshes the name of one already listed. */
function upsertGroup(list: Conversation[], group: Group): Conversation[] {
    if (findConversation(list, targetKey({type: 'group', groupId: group.id}))) {
        return list.map((c) => (c.type === 'group' && c.groupId === group.id ? {...c, name: group.name} : c));
    }
    return [
        {
            type: 'group',
            groupId: group.id,
            name: group.name,
            lastMessage: null,
            lastSender: null,
            lastSentAt: group.createdAt
        },
        ...list
    ];
}

/** History goes first; live messages that arrived while it was loading are kept, without duplicates. */
function mergeHistory(history: ChatMessage[], live: ChatMessage[]): ChatMessage[] {
    const ids = new Set(history.map((m) => m.id));
    return [...history, ...live.filter((m) => !ids.has(m.id))];
}

/** Conversation list, unread counters, the open chat and its messages; group management; resync. */
export function useChat({me, chatApi, onNotify}: ChatOptions) {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [unread, setUnread] = useState<UnreadCounts>({});
    const [active, setActive] = useState<ChatTarget | null>(null);
    /** Details (members) of the open chat when it's a group; null while loading or for direct chats. */
    const [activeGroup, setActiveGroup] = useState<Group | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    // Let async callbacks read the current values rather than the ones captured at creation.
    const activeRef = useRef<ChatTarget | null>(null);
    const conversationsRef = useRef<Conversation[]>([]);
    useEffect(() => {
        conversationsRef.current = conversations;
    }, [conversations]);

    const loadConversations = useCallback(() => {
        chatApi.getConversations()
            .then(setConversations)
            .catch((err: unknown) => onNotify(getErrorMessage(err)));
    }, [chatApi, onNotify]);

    useEffect(loadConversations, [loadConversations]);

    /** Handles incoming (and echoed) messages from the WebSocket. */
    const receiveMessage = useCallback((message: ChatMessage) => {
        const isMine = message.sender === me;
        const target = messageTarget(message, me);
        const key = targetKey(target);
        const known = findConversation(conversationsRef.current, key);

        setConversations((prev) => bumpConversation(prev, target, message));

        if (isTarget(activeRef.current, key)) {
            setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
        } else if (!isMine) {
            setUnread((prev) => ({...prev, [key]: (prev[key] ?? 0) + 1}));
            onNotify(known?.type === 'group'
                ? `New message in ${known.name} from @${message.sender}`
                : `New message from @${message.sender}`);
        }
    }, [me, onNotify]);

    /** Drops a group from the list, closing it if it's open. */
    const removeGroup = useCallback((groupId: number) => {
        const key = targetKey({type: 'group', groupId});
        setConversations((prev) => prev.filter((c) => !(c.type === 'group' && c.groupId === groupId)));
        setUnread(({[key]: _removed, ...rest}) => rest);
        if (isTarget(activeRef.current, key)) {
            activeRef.current = null;
            setActive(null);
            setActiveGroup(null);
            setMessages([]);
        }
    }, []);

    /** Loads the history (and member list, for groups) of `target` and merges it into the open chat. */
    const loadChat = useCallback(async (target: ChatTarget) => {
        const key = targetKey(target);
        try {
            let page: ChatMessage[];
            if (target.type === 'direct') {
                page = await chatApi.getHistory(target.username, 0, HISTORY_PAGE_SIZE);
            } else {
                const [group, history] = await Promise.all([
                    chatApi.getGroup(target.groupId),
                    chatApi.getGroupHistory(target.groupId, 0, HISTORY_PAGE_SIZE)
                ]);
                if (!isTarget(activeRef.current, key)) return;
                setActiveGroup(group);
                page = history;
            }
            if (!isTarget(activeRef.current, key)) return; // user switched chats while loading
            const history = page.toReversed();              // API returns newest first
            setMessages((prev) => mergeHistory(history, prev));
        } catch (err) {
            if (target.type === 'group' && err instanceof ApiError && err.status === 403) {
                // Removed (or the group deleted) while we weren't listening.
                removeGroup(target.groupId);
                onNotify('You are no longer a member of that group');
            } else {
                onNotify(getErrorMessage(err));
            }
        }
    }, [chatApi, onNotify, removeGroup]);

    /** Opens a chat and loads its history. */
    const openConversation = useCallback(async (target: ChatTarget) => {
        activeRef.current = target;
        setActive(target);
        setActiveGroup(null);
        setMessages([]);
        setUnread((prev) => ({...prev, [targetKey(target)]: 0}));
        await loadChat(target);
    }, [loadChat]);

    /**
     * After a reconnect: refetch what may have changed while disconnected (new / removed groups, missed messages).
     * Unread counts for missed messages in other chats aren't recovered.
     */
    const resync = useCallback(() => {
        loadConversations();
        if (activeRef.current) void loadChat(activeRef.current);
    }, [loadConversations, loadChat]);

    /** Handles group events from the WebSocket. */
    const receiveGroupEvent = useCallback((event: GroupEvent) => {
        const {group, actor} = event;
        const key = targetKey({type: 'group', groupId: group.id});
        const gone = event.type === 'DELETED'
            || (event.type === 'MEMBER_LEFT' && actor === me)
            || (event.type === 'MEMBER_REMOVED' && event.target === me);
        if (gone) {
            removeGroup(group.id);
            if (actor !== me) {
                onNotify(event.type === 'DELETED'
                    ? `@${actor} deleted ${group.name}`
                    : `@${actor} removed you from ${group.name}`);
            }
            return;
        }
        const isNew = !findConversation(conversationsRef.current, key);
        setConversations((prev) => upsertGroup(prev, group));
        if (isTarget(activeRef.current, key)) setActiveGroup(group);
        if (isNew && actor !== me) onNotify(`@${actor} added you to ${group.name}`);
    }, [me, onNotify, removeGroup]);

    /** Creates a group and opens it. Resolves to false (after notifying) on failure. */
    const createGroup = useCallback(async (name: string, members: string[]) => {
        try {
            const group = await chatApi.createGroup({name, members});
            setConversations((prev) => upsertGroup(prev, group));
            void openConversation({type: 'group', groupId: group.id});
            return true;
        } catch (err) {
            onNotify(getErrorMessage(err));
            return false;
        }
    }, [chatApi, onNotify, openConversation]);

    /**
     * Runs an action on the open group and applies the updated group it returns.
     * Resolves to false (after notifying) on failure.
     */
    const updateActiveGroup = useCallback(async (action: (groupId: number) => Promise<Group | void>) => {
        const target = activeRef.current;
        if (target?.type !== 'group') return false;
        try {
            const group = await action(target.groupId);
            if (group) {
                setConversations((prev) => upsertGroup(prev, group));
                if (isTarget(activeRef.current, targetKey(target))) setActiveGroup(group);
            }
            return true;
        } catch (err) {
            onNotify(getErrorMessage(err));
            return false;
        }
    }, [onNotify]);

    const addMembers = useCallback((usernames: string[]) =>
        updateActiveGroup((id) => chatApi.addMembers(id, {usernames})), [chatApi, updateActiveGroup]);

    const leaveGroup = useCallback(() => updateActiveGroup(async (id) => {
        await chatApi.leaveGroup(id);
        removeGroup(id);
    }), [chatApi, updateActiveGroup, removeGroup]);

    // Admin only (the server answers 403 otherwise):

    const renameGroup = useCallback((name: string) =>
        updateActiveGroup((id) => chatApi.renameGroup(id, {name})), [chatApi, updateActiveGroup]);

    const removeMember = useCallback((username: string) =>
        updateActiveGroup((id) => chatApi.removeMember(id, username)), [chatApi, updateActiveGroup]);

    const setAdmin = useCallback((username: string, admin: boolean) =>
        updateActiveGroup((id) => chatApi.updateMember(id, username, {admin})), [chatApi, updateActiveGroup]);

    const deleteGroup = useCallback(() => updateActiveGroup(async (id) => {
        await chatApi.deleteGroup(id);
        removeGroup(id);
    }), [chatApi, updateActiveGroup, removeGroup]);

    return {
        conversations, unread, active, activeGroup, messages,
        receiveMessage, receiveGroupEvent, resync, openConversation,
        createGroup, addMembers, leaveGroup, renameGroup, removeMember, setAdmin, deleteGroup
    };
}
