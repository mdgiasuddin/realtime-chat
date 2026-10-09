// Wire types mirroring the Spring Boot DTOs (backend/src/main/java/com/example/chat).

/** ISO-8601 timestamp, as Jackson serializes java.time.Instant. */
export type IsoDateString = string;

export interface LoginRequest {
    username: string;
    password: string;
}

export interface RegisterRequest {
    name: string;
    username: string;
    password: string;
    email: string | null;
    phone: string | null;
    bio: string | null;
}

export interface AuthResponse {
    token: string;
    username: string;
    name: string;
}

export interface UserSummary {
    id: number;
    name: string;
    username: string;
}

interface ChatMessageBase {
    id: number;
    sender: string;
    content: string;
    sentAt: IsoDateString;
}

/** A message goes either to one user (`receiver`) or to a group (`groupId`); the other field is null. */
export type ChatMessage =
    | (ChatMessageBase & { receiver: string; groupId: null })
    | (ChatMessageBase & { receiver: null; groupId: number });

interface ConversationBase {
    /** null for a group nobody has written in yet. */
    lastMessage: string | null;
    lastSender: string | null;
    /** For an empty group: when it was created. */
    lastSentAt: IsoDateString;
}

export interface DirectConversation extends ConversationBase {
    type: 'direct';
    username: string;
}

export interface GroupConversation extends ConversationBase {
    type: 'group';
    groupId: number;
    name: string;
}

export type Conversation = DirectConversation | GroupConversation;

export type SendMessageRequest =
    | { to: string; content: string }
    | { groupId: number; content: string };

export interface Group {
    id: number;
    name: string;
    createdBy: string;
    createdAt: IsoDateString;
    /** In the order they joined. */
    members: UserSummary[];
    /** Usernames of the admins (rename / delete / remove members / change roles). */
    admins: string[];
}

export interface CreateGroupRequest {
    name: string;
    /** Other members' usernames; the creator is added by the server. */
    members: string[];
}

export interface AddMembersRequest {
    usernames: string[];
}

export interface RenameGroupRequest {
    name: string;
}

export interface UpdateMemberRequest {
    admin: boolean;
}

/** Pushed on /user/queue/groups whenever a group changes. */
export interface GroupEvent {
    type: 'CREATED' | 'MEMBER_ADDED' | 'MEMBER_LEFT' | 'MEMBER_REMOVED' | 'ROLE_CHANGED' | 'RENAMED' | 'DELETED';
    /** The group after the change (for DELETED: as it was just before). */
    group: Group;
    /** Who made the change. */
    actor: string;
    /** Who the change was about (MEMBER_REMOVED, ROLE_CHANGED), otherwise null. */
    target: string | null;
}

/** Body of every error response, REST or STOMP (/user/queue/errors). */
export interface ErrorResponse {
    error: string;
}
