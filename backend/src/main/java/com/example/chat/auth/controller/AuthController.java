package com.example.chat.auth.controller;

import com.example.chat.auth.AuthService;
import com.example.chat.auth.RefreshTokenCookie;
import com.example.chat.auth.dto.AuthResponse;
import com.example.chat.auth.dto.LoginRequest;
import com.example.chat.auth.dto.RegisterRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

import static org.springframework.http.HttpHeaders.SET_COOKIE;
import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.CREATED;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final RefreshTokenCookie refreshTokenCookie;

    @PostMapping("/register")
    public ResponseEntity<Map<String, String>> register(@Valid @RequestBody RegisterRequest request) {
        Map<String, String> response = authService.register(request);
        if (response.containsKey("error")) {
            return ResponseEntity.status(CONFLICT).body(response);
        }
        return ResponseEntity.status(CREATED).body(response);
    }

    /**
     * Access token in the body, refresh token in the cookie. Ends the session of whoever was logged in in this
     * browser before.
     */
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(
            @Valid @RequestBody LoginRequest request,
            @CookieValue(name = RefreshTokenCookie.NAME, required = false) String refreshToken) {
        return withCookie(authService.login(request, refreshToken));
    }

    /**
     * New access token for the refresh-token cookie (which is rotated); 401 if it's missing, expired or revoked.
     */
    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(
            @CookieValue(name = RefreshTokenCookie.NAME, required = false) String refreshToken) {
        return withCookie(authService.refresh(refreshToken));
    }

    /**
     * Revokes the refresh token and drops the cookie. The access token stays valid until it expires (at most 30 min);
     * the client discards it.
     */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            @CookieValue(name = RefreshTokenCookie.NAME, required = false) String refreshToken) {
        authService.logout(refreshToken);
        return ResponseEntity.noContent().header(SET_COOKIE, refreshTokenCookie.clear().toString()).build();
    }

    private ResponseEntity<AuthResponse> withCookie(AuthService.Session session) {
        return ResponseEntity.ok()
                .header(SET_COOKIE, refreshTokenCookie.create(session.refreshToken()).toString())
                .body(session.response());
    }
}
