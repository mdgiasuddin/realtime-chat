package com.example.chat.message.service;

import com.example.chat.conversation.service.ConversationService;
import com.example.chat.group.service.GroupService;
import com.example.chat.message.dto.ChatMessageDto;
import com.example.chat.message.dto.ConversationDto;
import com.example.chat.message.dto.SendMessageRequest;
import com.example.chat.message.entity.ChatMessage;
import com.example.chat.message.repository.ChatMessageRepository;
import com.example.chat.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static java.util.Locale.ROOT;

@Service
@RequiredArgsConstructor
public class MessageService {

    private final ChatMessageRepository chatMessageRepository;
    private final UserRepository userRepository;
    private final GroupService groupService;
    private final ConversationService conversationService;

    /**
     * Saves a direct or group message, depending on which target the request carries. The first direct message
     * between two users creates their conversation.
     */
    @Transactional
    public ChatMessageDto save(String sender, SendMessageRequest request) {
        boolean direct = request.to() != null && !request.to().isBlank();
        if (direct == (request.groupId() != null)) {
            throw new IllegalArgumentException("Specify either a recipient or a group");
        }
        ChatMessage message = new ChatMessage();
        message.setSender(sender);
        if (direct) {
            String receiver = validRecipient(sender, request.to());
            message.setReceiver(receiver);
            message.setConversationId(conversationService.findOrCreateDirect(sender, receiver).getId());
        } else {
            groupService.requireMember(request.groupId(), sender);
            message.setConversationId(request.groupId());
        }
        message.setContent(request.content().trim());
        ChatMessage saved = chatMessageRepository.save(message);
        conversationService.recordLastMessage(saved);
        return new ChatMessageDto(saved);
    }

    private String validRecipient(String sender, String to) {
        String receiver = to.trim().toLowerCase(ROOT);
        if (!userRepository.existsByUsername(receiver)) {
            throw new IllegalArgumentException("Recipient not found: " + receiver);
        }
        if (receiver.equals(sender)) {
            throw new IllegalArgumentException("You cannot message yourself");
        }
        return receiver;
    }

    /**
     * Newest-first page of the conversation between two users (empty if they never wrote to each other).
     */
    @Transactional(readOnly = true)
    public List<ChatMessageDto> history(String me, String other, int page, int size) {
        return conversationService.findDirect(me, other.trim().toLowerCase(ROOT))
                .map(conversation -> page(conversation.getId(), page, size))
                .orElse(List.of());
    }

    /**
     * Newest-first page of a group's messages. Only members may read them.
     */
    @Transactional(readOnly = true)
    public List<ChatMessageDto> groupHistory(String me, Long groupId, int page, int size) {
        groupService.requireMember(groupId, me);
        return page(groupId, page, size);
    }

    /**
     * My direct chats and groups, most recent activity first.
     */
    @Transactional(readOnly = true)
    public List<ConversationDto> conversations(String me) {
        return conversationService.conversationsOf(me).stream()
                .map(row -> ConversationDto.of(row.conversation(), row.lastMessage(), me))
                .toList();
    }

    private List<ChatMessageDto> page(Long conversationId, int page, int size) {
        PageRequest pageRequest = PageRequest.of(Math.max(0, page), Math.clamp(size, 1, 100));
        return chatMessageRepository.findHistory(conversationId, pageRequest).stream()
                .map(ChatMessageDto::new)
                .toList();
    }
}
