package com.example.chat.user;

import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.user.SimpUserRegistry;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.util.List;
import java.util.Map;

import static java.util.Locale.ROOT;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final SimpUserRegistry userRegistry; // tracks currently connected WebSocket users

    /**
     * Search other users by (partial) username.
     */
    @GetMapping("/search")
    public List<UserSummary> search(@RequestParam String q, Principal me) {
        String query = q.trim();
        if (query.isEmpty()) {
            return List.of();
        }
        return userRepository.findTop20ByUsernameContainingIgnoreCase(query).stream()
                .filter(user -> !user.getUsername().equals(me.getName()))
                .map(user -> new UserSummary(user.getId(), user.getName(), user.getUsername()))
                .toList();
    }

    /**
     * Is the given user currently connected via WebSocket?
     */
    @GetMapping("/{username}/online")
    public Map<String, Boolean> online(@PathVariable String username) {
        return Map.of("online", userRegistry.getUser(username.toLowerCase(ROOT)) != null);
    }
}
