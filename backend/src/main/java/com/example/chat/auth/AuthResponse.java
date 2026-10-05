package com.example.chat.auth;

public record AuthResponse(
        String token,
        String username,
        String name
) {
}
