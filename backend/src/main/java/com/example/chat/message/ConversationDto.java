package com.example.chat.message;

import java.time.Instant;

public record ConversationDto(
        String username,
        String lastMessage,
        Instant lastSentAt
) {
}
