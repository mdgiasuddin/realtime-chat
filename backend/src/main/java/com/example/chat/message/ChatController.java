package com.example.chat.message;

import com.example.chat.common.ForbiddenException;
import com.example.chat.group.GroupService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageExceptionHandler;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.Map;

/**
 * WebSocket (STOMP) endpoints.
 */
@Controller
@RequiredArgsConstructor
@Slf4j
public class ChatController {

    private final MessageService messageService;
    private final GroupService groupService;
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Client publishes to /app/chat.send with body {"to":"bob","content":"hi"} (direct)
     * or {"groupId":12,"content":"hi"} (group).
     */
    @MessageMapping("/chat.send")
    public void send(@Valid @Payload SendMessageRequest request, Principal principal) {
        // The sender always comes from the authenticated principal, never from the payload.
        ChatMessageDto saved = messageService.save(principal.getName(), request);

        if (saved.groupId() != null) {
            // Fan out to every member's personal queue (the sender included, as an echo).
            for (String member : groupService.memberUsernames(saved.groupId())) {
                messagingTemplate.convertAndSendToUser(member, "/queue/messages", saved);
            }
            return;
        }

        // 1) Push to the receiver. If they have no open session this is a no-op;
        //    they'll see the message in history on their next login.
        messagingTemplate.convertAndSendToUser(saved.receiver(), "/queue/messages", saved);

        // 2) Echo to the sender (confirmation + keeps their other tabs/devices in sync).
        messagingTemplate.convertAndSendToUser(saved.sender(), "/queue/messages", saved);
    }

    @MessageExceptionHandler
    @SendToUser("/queue/errors")
    public Map<String, String> handleError(Exception e) {
        if (e instanceof IllegalArgumentException || e instanceof ForbiddenException) {
            return Map.of("error", e.getMessage());
        }
        log.warn("Error handling chat message", e);
        return Map.of("error", "Invalid message");
    }
}
