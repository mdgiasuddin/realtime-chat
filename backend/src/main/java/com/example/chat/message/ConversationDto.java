package com.example.chat.message;

import com.example.chat.group.ChatGroup;

import java.time.Instant;

/**
 * A row in the conversation list: either a direct chat (username set) or a group (groupId + name set).
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

    public static ConversationDto direct(String username, ChatMessage last) {
        return new ConversationDto("direct", username, null, null,
                last.getContent(), last.getSender(), last.getSentAt());
    }

    /**
     * @param last the newest message in the group, or null if nobody has written yet
     */
    public static ConversationDto group(ChatGroup group, ChatMessage last) {
        return last == null
                ? new ConversationDto("group", null, group.getId(), group.getName(), null, null, group.getCreatedAt())
                : new ConversationDto("group", null, group.getId(), group.getName(),
                last.getContent(), last.getSender(), last.getSentAt());
    }
}
