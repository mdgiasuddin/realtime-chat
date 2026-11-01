package com.example.chat.conversation.repository;

import com.example.chat.conversation.entity.Conversation;
import com.example.chat.message.entity.ChatMessage;

/**
 * @param lastMessage null while nobody has written yet
 */
public record ConversationWithLastMessage(Conversation conversation, ChatMessage lastMessage) {
}
