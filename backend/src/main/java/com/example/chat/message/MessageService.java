package com.example.chat.message;

import com.example.chat.group.ChatGroup;
import com.example.chat.group.GroupService;
import com.example.chat.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import static java.util.Locale.ROOT;

@Service
@RequiredArgsConstructor
public class MessageService {

    private final ChatMessageRepository chatMessageRepository;
    private final UserRepository userRepository;
    private final GroupService groupService;

    /**
     * Saves a direct or group message, depending on which target the request carries.
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
            message.setReceiver(validRecipient(sender, request.to()));
        } else {
            groupService.requireMember(request.groupId(), sender);
            message.setGroupId(request.groupId());
        }
        message.setContent(request.content().trim());
        return new ChatMessageDto(chatMessageRepository.save(message));
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
     * Newest-first page of the conversation between two users.
     */
    @Transactional(readOnly = true)
    public List<ChatMessageDto> history(String me, String other, int page, int size) {
        return chatMessageRepository.findConversation(me, other.toLowerCase(ROOT), pageRequest(page, size))
                .map(ChatMessageDto::new)
                .getContent();
    }

    /**
     * Newest-first page of a group's messages. Only members may read them.
     */
    @Transactional(readOnly = true)
    public List<ChatMessageDto> groupHistory(String me, Long groupId, int page, int size) {
        groupService.requireMember(groupId, me);
        return chatMessageRepository.findGroupHistory(groupId, pageRequest(page, size))
                .map(ChatMessageDto::new)
                .getContent();
    }

    /**
     * Distinct chat partners and my groups, most recent activity first.
     */
    @Transactional(readOnly = true)
    public List<ConversationDto> conversations(String me) {
        List<ChatMessage> recent = chatMessageRepository.findRecentForUser(me, PageRequest.of(0, 500));
        Map<String, ConversationDto> byPartner = new LinkedHashMap<>();
        for (ChatMessage message : recent) {
            String other = message.getSender().equals(me) ? message.getReceiver() : message.getSender();
            byPartner.putIfAbsent(other, ConversationDto.direct(other, message));
        }
        List<ConversationDto> result = new ArrayList<>(byPartner.values());

        List<ChatGroup> groups = groupService.groupsOf(me);
        if (!groups.isEmpty()) {
            Map<Long, ChatMessage> latest = chatMessageRepository
                    .findLatestInGroups(groups.stream().map(ChatGroup::getId).toList()).stream()
                    .collect(Collectors.toMap(ChatMessage::getGroupId, Function.identity()));
            for (ChatGroup group : groups) {
                result.add(ConversationDto.group(group, latest.get(group.getId())));
            }
            result.sort(Comparator.comparing(ConversationDto::lastSentAt).reversed());
        }
        return result;
    }

    private static PageRequest pageRequest(int page, int size) {
        return PageRequest.of(Math.max(0, page), Math.clamp(size, 1, 100));
    }
}
