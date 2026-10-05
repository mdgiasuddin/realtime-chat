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

export interface ChatMessage {
    id: number;
    sender: string;
    receiver: string;
    content: string;
    sentAt: IsoDateString;
}

export interface Conversation {
    username: string;
    lastMessage: string;
    lastSentAt: IsoDateString;
}

export interface SendMessageRequest {
    to: string;
    content: string;
}

/** Body of every error response, REST or STOMP (/user/queue/errors). */
export interface ErrorResponse {
    error: string;
}
