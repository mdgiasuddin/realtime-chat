import type {ChatMessage, Conversation} from '../types/api';

/** What a chat is with: one user or a group. */
export type ChatTarget =
    | { type: 'direct'; username: string }
    | { type: 'group'; groupId: number };

/** Stable string id of a chat, for maps and React keys: "u:bob" or "g:12". */
export type TargetKey = string;

export const targetKey = (target: ChatTarget): TargetKey =>
    target.type === 'direct' ? `u:${target.username}` : `g:${target.groupId}`;

export const conversationTarget = (c: Conversation): ChatTarget =>
    c.type === 'direct' ? {type: 'direct', username: c.username} : {type: 'group', groupId: c.groupId};

/** The chat a message belongs to, from my point of view. */
export function messageTarget(message: ChatMessage, me: string): ChatTarget {
    if (message.groupId !== null) return {type: 'group', groupId: message.groupId};
    return {type: 'direct', username: message.sender === me ? message.receiver : message.sender};
}
