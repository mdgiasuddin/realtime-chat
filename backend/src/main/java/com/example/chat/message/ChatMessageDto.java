package com.example.chat.message;

import java.time.Instant;

public record ChatMessageDto(Long id, String sender, String receiver, Long groupId, String content, Instant sentAt) {

    public ChatMessageDto(ChatMessage chatMessage) {
        this(chatMessage.getId(), chatMessage.getSender(), chatMessage.getReceiver(), chatMessage.getGroupId(),
                chatMessage.getContent(), chatMessage.getSentAt());
    }
}
