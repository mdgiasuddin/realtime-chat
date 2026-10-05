package com.example.chat.message;

import com.example.chat.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static java.util.Locale.ROOT;

@Service
@RequiredArgsConstructor
public class MessageService {

    private final ChatMessageRepository chatMessageRepository;
    private final UserRepository userRepository;

    @Transactional
    public ChatMessageDto save(String sender, SendMessageRequest request) {
        String receiver = request.to().trim().toLowerCase(ROOT);
        if (!userRepository.existsByUsername(receiver)) {
            throw new IllegalArgumentException("Recipient not found: " + receiver);
        }
        if (receiver.equals(sender)) {
            throw new IllegalArgumentException("You cannot message yourself");
        }
        ChatMessage message = new ChatMessage();
        message.setSender(sender);
        message.setReceiver(receiver);
        message.setContent(request.content().trim());
        return new ChatMessageDto(chatMessageRepository.save(message));
    }

    /**
     * Newest-first page of the conversation between two users.
     */
    @Transactional(readOnly = true)
    public List<ChatMessageDto> history(String me, String other, int page, int size) {
        int safeSize = Math.clamp(size, 1, 100);
        int safePage = Math.max(0, page);
        return chatMessageRepository.findConversation(me, other.toLowerCase(ROOT), PageRequest.of(safePage, safeSize))
                .map(ChatMessageDto::new)
                .getContent();
    }

    /**
     * Distinct chat partners, most recent conversation first.
     */
    @Transactional(readOnly = true)
    public List<ConversationDto> conversations(String me) {
        List<ChatMessage> recent = chatMessageRepository.findRecentForUser(me, PageRequest.of(0, 500));
        Map<String, ConversationDto> byPartner = new LinkedHashMap<>();
        for (ChatMessage message : recent) {
            String other = message.getSender().equals(me) ? message.getReceiver() : message.getSender();
            byPartner.putIfAbsent(other, new ConversationDto(other, message.getContent(), message.getSentAt()));
        }
        return new ArrayList<>(byPartner.values());
    }
}
