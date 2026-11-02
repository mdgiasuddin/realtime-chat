package com.example.chat.auth.service;

import com.example.chat.auth.dto.AuthResponse;
import com.example.chat.auth.dto.LoginRequest;
import com.example.chat.auth.dto.RegisterRequest;
import com.example.chat.exception.UnauthorizedException;
import com.example.chat.security.JwtService;
import com.example.chat.user.entity.User;
import com.example.chat.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Map;

import static java.util.Locale.ROOT;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authManager;
    private final JwtService jwtService;
    private final RefreshTokenService refreshTokenService;

    public Map<String, String> register(RegisterRequest request) {
        String username = request.username().toLowerCase(ROOT);
        if (userRepository.existsByUsername(username)) {
            return Map.of("error", "Username is already taken");
        }
        User user = new User();
        user.setName(request.name().trim());
        user.setUsername(username);
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setEmail(request.email());
        user.setPhone(request.phone());
        user.setBio(request.bio());
        userRepository.save(user);

        return Map.of("message", "Registered successfully");
    }

    /**
     * @param previousRefreshToken the refresh token this browser already holds, if any. Only one user is logged in
     *                             per browser, so that session ends.
     */
    public Session login(LoginRequest request, String previousRefreshToken) {
        String username = request.username().toLowerCase(ROOT);
        Authentication authentication = authManager.authenticate(
                new UsernamePasswordAuthenticationToken(username, request.password())
        );

        if (authentication.getPrincipal() instanceof User user) {
            refreshTokenService.revoke(previousRefreshToken);
            return session(user, refreshTokenService.issue(user.getUsername()));
        }
        throw new BadCredentialsException("Invalid username or password");
    }

    /**
     * A new access token for a valid refresh token, which is rotated along the way.
     */
    public Session refresh(String refreshToken) {
        RefreshTokenService.Rotation rotation = refreshTokenService.rotate(refreshToken);
        User user = userRepository.findByUsername(rotation.username())
                .orElseThrow(() -> new UnauthorizedException("Session expired, please log in again"));
        return session(user, rotation.token());
    }

    public void logout(String refreshToken) {
        refreshTokenService.revoke(refreshToken);
    }

    private Session session(User user, String refreshToken) {
        AuthResponse response = new AuthResponse(jwtService.generateToken(user.getUsername()), user.getUsername(),
                user.getName(), jwtService.getAccessTokenValidity().toSeconds());
        return new Session(response, refreshToken);
    }

    /**
     * @param response     the body for the client
     * @param refreshToken goes into the HttpOnly cookie, never into the body
     */
    public record Session(AuthResponse response, String refreshToken) {
    }
}
