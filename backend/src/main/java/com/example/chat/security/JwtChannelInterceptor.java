package com.example.chat.security;

import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.NonNull;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;

import java.util.Set;

import static org.springframework.messaging.simp.stomp.StompCommand.CONNECT;

/**
 * Authenticates the WebSocket session when the client sends the STOMP CONNECT frame.
 * The client must supply the header:  Authorization: Bearer <jwt>
 * The resulting Principal name (= username) is what Spring uses to route /user/** destinations.
 */
@Component
@RequiredArgsConstructor
public class JwtChannelInterceptor implements ChannelInterceptor {

    private final JwtService jwtService;

    @Override
    public Message<?> preSend(@NonNull Message<?> message, @NonNull MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor != null && CONNECT.equals(accessor.getCommand())) {
            String header = accessor.getFirstNativeHeader("Authorization");
            if (header == null || !header.startsWith("Bearer ")) {
                throw new MessagingException("Missing Authorization header");
            }
            String token = header.substring(7);
            if (!jwtService.isValid(token)) {
                throw new MessagingException("Invalid or expired token");
            }

            String username = jwtService.extractUsername(token);
            Authentication authentication = new UsernamePasswordAuthenticationToken(
                    username, null, Set.of(new SimpleGrantedAuthority("ROLE_USER")));

            accessor.setUser(authentication);
        }
        return message;
    }
}
