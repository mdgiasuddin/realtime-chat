package com.example.chat.message.dto;

import com.example.chat.conversation.entity.Conversation;
import com.example.chat.message.entity.ChatMessage;

import java.time.Instant;

/**
 * A row in the conversation list: either a direct chat (username set) or a group (groupId + name set).
 *
 * @param lastSentAt when the newest message was sent; for a group nobody has written in yet, when it was created
 */
public record ConversationDto(
        String type,
        String username,
        Long groupId,
        String name,
        String lastMessage,
        String lastSender,
        Instant lastSentAt
) {

    /**
     * @param last the newest message, or null if nobody has written yet
     */
    public static ConversationDto of(Conversation conversation, ChatMessage last, String me) {
        String lastMessage = last == null ? null : last.getContent();
        String lastSender = last == null ? null : last.getSender();
        return conversation.isGroup()
                ? new ConversationDto("group", null, conversation.getId(), conversation.getName(),
                lastMessage, lastSender, conversation.getLastActivityAt())
                : new ConversationDto("direct", conversation.otherParticipant(me), null, null,
                lastMessage, lastSender, conversation.getLastActivityAt());
    }
}
