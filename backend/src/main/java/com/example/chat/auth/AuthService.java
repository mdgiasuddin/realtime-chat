package com.example.chat.auth;

import com.example.chat.auth.dto.AuthResponse;
import com.example.chat.auth.dto.LoginRequest;
import com.example.chat.auth.dto.RegisterRequest;
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

    public AuthResponse login(LoginRequest request) {
        String username = request.username().toLowerCase(ROOT);
        Authentication authentication = authManager.authenticate(
                new UsernamePasswordAuthenticationToken(username, request.password())
        );

        if (authentication.getPrincipal() instanceof User user) {
            return new AuthResponse(jwtService.generateToken(user.getUsername()), user.getUsername(), user.getName());
        }
        throw new BadCredentialsException("Invalid username or password");
    }

}
