package com.example.chat.message;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Exactly one of {@code to} (direct message) or {@code groupId} (group message) must be set.
 */
public record SendMessageRequest(
        String to,
        Long groupId,
        @NotBlank @Size(max = 2000) String content
) {
}
