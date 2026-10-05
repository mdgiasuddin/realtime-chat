package com.example.chat.auth;

import com.example.chat.security.JwtService;
import com.example.chat.user.User;
import com.example.chat.user.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

import static java.util.Locale.ROOT;
import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.CREATED;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authManager;
    private final JwtService jwtService;

    @PostMapping("/register")
    public ResponseEntity<Map<String, String>> register(@Valid @RequestBody RegisterRequest request) {
        String username = request.username().toLowerCase(ROOT);
        if (userRepository.existsByUsername(username)) {
            return ResponseEntity.status(CONFLICT).body(Map.of("error", "Username is already taken"));
        }
        User user = new User();
        user.setName(request.name().trim());
        user.setUsername(username);
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setEmail(request.email());
        user.setPhone(request.phone());
        user.setBio(request.bio());
        userRepository.save(user);
        return ResponseEntity.status(CREATED).body(Map.of("message", "Registered successfully"));
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        String username = request.username().toLowerCase(ROOT);
        // Throws BadCredentialsException (-> 401 via GlobalExceptionHandler) on failure
        authManager.authenticate(new UsernamePasswordAuthenticationToken(username, request.password()));
        User user = userRepository.findByUsername(username).orElseThrow();
        return new AuthResponse(jwtService.generateToken(user.getUsername()), user.getUsername(), user.getName());
    }
}
