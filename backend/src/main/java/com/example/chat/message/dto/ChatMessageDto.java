package com.example.chat.message.dto;

import com.example.chat.message.entity.ChatMessage;

import java.time.Instant;

/**
 * Exactly one of {@code receiver} (one-to-one message) or {@code groupId} (group message) is set.
 */
public record ChatMessageDto(Long id, String sender, String receiver, Long groupId, String content, Instant sentAt) {

    public ChatMessageDto(ChatMessage chatMessage) {
        this(chatMessage.getId(), chatMessage.getSender(), chatMessage.getReceiver(),
                chatMessage.getReceiver() == null ? chatMessage.getConversationId() : null,
                chatMessage.getContent(), chatMessage.getSentAt());
    }
}
