package com.example.chat.message.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Exactly one of {@code to} (direct message) or {@code groupId} (group message) must be set.
 *
 * @param content an end-to-end encrypted envelope (JSON) built by the client; opaque to the server. It carries the
 *                message key wrapped once per recipient, so it grows with the group size.
 */
public record SendMessageRequest(
        String to,
        Long groupId,
        @NotBlank @Size(max = SendMessageRequest.MAX_CONTENT_LENGTH) String content
) {
    /**
     * Stays below the 64 KiB default STOMP inbound message size limit.
     */
    public static final int MAX_CONTENT_LENGTH = 60_000;
}
