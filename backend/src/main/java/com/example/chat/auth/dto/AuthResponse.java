package com.example.chat.auth.dto;

/**
 * Returned by login and refresh. The refresh token isn't in here: it's set as an HttpOnly cookie.
 *
 * @param token     access token (JWT) for the Authorization header and the WebSocket CONNECT frame
 * @param expiresIn seconds until {@code token} expires (relative, so the client's clock doesn't matter)
 */
public record AuthResponse(
        String token,
        String username,
        String name,
        long expiresIn
) {
}
