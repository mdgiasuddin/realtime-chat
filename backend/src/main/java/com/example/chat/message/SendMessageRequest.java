package com.example.chat.message;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SendMessageRequest(
        @NotBlank String to,
        @NotBlank @Size(max = 2000) String content
) {
}
