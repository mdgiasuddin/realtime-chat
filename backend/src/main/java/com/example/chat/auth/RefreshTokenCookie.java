package com.example.chat.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * The refresh token only ever travels in this cookie: HttpOnly, so page scripts (and XSS) can't read it, and scoped
 * to /api/auth, so no other request carries it.
 */
@Component
public class RefreshTokenCookie {

    public static final String NAME = "refresh_token";
    private static final String PATH = "/api/auth";

    @Value("${app.auth.refresh-token.validity}")
    private Duration validity;

    @Value("${app.auth.refresh-token.cookie-secure}")
    private boolean secure;

    @Value("${app.auth.refresh-token.cookie-same-site}")
    private String sameSite;

    public ResponseCookie create(String token) {
        return builder(token).maxAge(validity).build();
    }

    /**
     * Tells the browser to drop the cookie.
     */
    public ResponseCookie clear() {
        return builder("").maxAge(0).build();
    }

    private ResponseCookie.ResponseCookieBuilder builder(String value) {
        return ResponseCookie.from(NAME, value)
                .httpOnly(true)
                .secure(secure)
                .sameSite(sameSite)
                .path(PATH);
    }
}
