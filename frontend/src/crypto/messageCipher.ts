import type {ChatApi} from '../api/endpoints';
import type {ChatMessage, Conversation} from '../types/api';
import type {ChatTarget} from '../utils/conversation';
import type {Identity} from './identity';
import {decryptMessage, encryptMessage, parseEnvelope, type RecipientTag, SharedKeyCache} from './messageCrypto';

// Matches SendMessageRequest.MAX_CONTENT_LENGTH in the backend (the whole envelope, not just the text).
const MAX_ENVELOPE_LENGTH = 60_000;

/**
 * - encrypted:   end-to-end encrypted and decrypted fine
 * - unencrypted: plain text (sent before encryption existed); anyone with server access can read or forge it
 * - unreadable:  encrypted, but not for this key (my key was rotated since, or I joined the group later)
 */
export type MessageSecurity = 'encrypted' | 'unencrypted' | 'unreadable';

/** A message as shown in the UI: `content` is the decrypted text (or a placeholder). */
export type DisplayMessage = ChatMessage & { security: MessageSecurity };

interface Opened {
    text: string;
    security: MessageSecurity;
}

export interface MessageCipher {
    /**
     * Encrypts `text` for everyone in the chat (and me). Fetches the recipients' current public keys first.
     * @param groupMembers usernames of the group's members, for group chats
     */
    encrypt: (target: ChatTarget, text: string, groupMembers: string[]) => Promise<string>;
    /** Never throws: messages that can't be decrypted come back as 'unreadable'. */
    decrypt: (message: ChatMessage) => Promise<DisplayMessage>;
    /** Decrypts the conversation's last-message preview. */
    decryptPreview: (conversation: Conversation) => Promise<Conversation>;
}

export function createMessageCipher(
    me: string,
    identity: Identity,
    chatApi: Pick<ChatApi, 'getPublicKeys'>
): MessageCipher {
    const sharedKeys = new SharedKeyCache(identity.pair.privateKey);
    // Decryption results, keyed by everything that's authenticated (so a relabelled copy isn't served from cache).
    const opened = new Map<string, Promise<Opened>>();

    const open = (content: string, sender: string, to: RecipientTag): Promise<Opened> => {
        const cacheKey = `${sender}>${to}|${content}`;
        let result = opened.get(cacheKey);
        if (!result) {
            const envelope = parseEnvelope(content);
            result = envelope
                ? decryptMessage(envelope, me, sender, to, sharedKeys).then(
                    (text): Opened => ({text, security: 'encrypted'}),
                    (): Opened => ({text: 'Unable to decrypt this message', security: 'unreadable'}))
                : Promise.resolve({text: content, security: 'unencrypted'});
            opened.set(cacheKey, result);
        }
        return result;
    };

    const encrypt = async (target: ChatTarget, text: string, groupMembers: string[]): Promise<string> => {
        const usernames = target.type === 'direct' ? [target.username, me] : [...groupMembers, me];
        const keys = await chatApi.getPublicKeys([...new Set(usernames)]);
        const recipients = new Map(keys.map((k) => [k.username, k.publicKey]));

        if (recipients.get(me) !== identity.publicKey) {
            throw new Error('Your encryption key was changed on another device. Reload the page to continue.');
        }
        if (target.type === 'direct' && !recipients.has(target.username)) {
            throw new Error(`@${target.username} hasn't set up encryption yet, so they can't receive messages`);
        }
        // Group members who never set up a key are left out; they'll see the message as unreadable.

        const to: RecipientTag = target.type === 'direct' ? `u:${target.username}` : `g:${target.groupId}`;
        const envelope = await encryptMessage(text, me, identity.publicKey, to, recipients, sharedKeys);
        if (envelope.length > MAX_ENVELOPE_LENGTH) {
            throw new Error('Message is too long for a chat this size');
        }
        return envelope;
    };

    const decrypt = async (message: ChatMessage): Promise<DisplayMessage> => {
        const to: RecipientTag = message.groupId !== null ? `g:${message.groupId}` : `u:${message.receiver}`;
        const {text, security} = await open(message.content, message.sender, to);
        return {...message, content: text, security};
    };

    const decryptPreview = async (c: Conversation): Promise<Conversation> => {
        if (c.lastMessage === null || c.lastSender === null) return c;
        let to: RecipientTag;
        if (c.type === 'group') to = `g:${c.groupId}`;
        else to = c.lastSender === me ? `u:${c.username}` : `u:${me}`;
        const {text} = await open(c.lastMessage, c.lastSender, to);
        return {...c, lastMessage: text};
    };

    return {encrypt, decrypt, decryptPreview};
}
