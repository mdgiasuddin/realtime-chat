package com.example.chat.conversation.service;

import com.example.chat.conversation.entity.Conversation;
import com.example.chat.conversation.entity.ConversationMember;
import com.example.chat.conversation.repository.ConversationMemberRepository;
import com.example.chat.conversation.repository.ConversationRepository;
import com.example.chat.conversation.repository.ConversationWithLastMessage;
import com.example.chat.message.entity.ChatMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

import static com.example.chat.conversation.entity.MemberRole.MEMBER;

/**
 * What both kinds of conversation have in common. Group management lives in GroupService.
 */
@Service
@RequiredArgsConstructor
public class ConversationService {

    private final ConversationRepository conversationRepository;
    private final ConversationMemberRepository memberRepository;

    /**
     * The one-to-one conversation between two users, created (with both as members) on the first message.
     */
    @Transactional
    public Conversation findOrCreateDirect(String me, String other) {
        String key = Conversation.directKey(me, other);
        return conversationRepository.findByDirectKey(key).orElseGet(() -> {
            boolean created = conversationRepository.insertDirectIfAbsent(key, me) == 1;
            Conversation conversation = conversationRepository.findByDirectKey(key).orElseThrow();
            if (created) {
                memberRepository.save(new ConversationMember(conversation.getId(), me, MEMBER));
                memberRepository.save(new ConversationMember(conversation.getId(), other, MEMBER));
            }
            return conversation;
        });
    }

    @Transactional(readOnly = true)
    public Optional<Conversation> findDirect(String me, String other) {
        return conversationRepository.findByDirectKey(Conversation.directKey(me, other));
    }

    /**
     * Keeps the conversation's "newest message" (used for the conversation list) up to date.
     */
    @Transactional
    public void recordLastMessage(ChatMessage message) {
        conversationRepository.updateLastMessage(message.getConversationId(), message.getId(), message.getSentAt());
    }

    /**
     * All of my conversations, one-to-one and group, with their newest message, most recent activity first.
     */
    @Transactional(readOnly = true)
    public List<ConversationWithLastMessage> conversationsOf(String me) {
        return conversationRepository.findAllOfMember(me);
    }
}
