package com.example.chat.message;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.util.List;

/**
 * REST endpoints for message history.
 */
@RestController
@RequestMapping("/api/messages")
@RequiredArgsConstructor
public class MessageController {

    private final MessageService messageService;

    /**
     * People I've chatted with, most recent first.
     */
    @GetMapping("/conversations")
    public List<ConversationDto> conversations(Principal me) {
        return messageService.conversations(me.getName());
    }

    /**
     * Conversation with one user, newest first, paged: GET /api/messages/bob?page=0&size=30
     */
    @GetMapping("/{username}")
    public List<ChatMessageDto> history(@PathVariable String username,
                                        Principal me,
                                        @RequestParam(defaultValue = "0") int page,
                                        @RequestParam(defaultValue = "30") int size) {
        return messageService.history(me.getName(), username, page, size);
    }
}
