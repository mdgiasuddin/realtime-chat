package com.example.chat.auth.dto;

public record AuthResponse(
        String token,
        String username,
        String name
) {
}
