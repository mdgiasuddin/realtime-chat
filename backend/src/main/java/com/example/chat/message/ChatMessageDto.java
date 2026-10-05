package com.example.chat.message;

import java.time.Instant;

public record ChatMessageDto(Long id, String sender, String receiver, String content, Instant sentAt) {

    public ChatMessageDto(ChatMessage chatMessage) {
        this(chatMessage.getId(), chatMessage.getSender(), chatMessage.getReceiver(), chatMessage.getContent(), chatMessage.getSentAt());
    }
}
