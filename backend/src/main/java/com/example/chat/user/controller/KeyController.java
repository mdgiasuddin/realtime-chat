package com.example.chat.user.controller;

import com.example.chat.exception.ConflictException;
import com.example.chat.exception.ForbiddenException;
import com.example.chat.exception.NotFoundException;
import com.example.chat.user.dto.KeyBundleResponse;
import com.example.chat.user.dto.PublicKeyResponse;
import com.example.chat.user.dto.PutKeysRequest;
import com.example.chat.user.entity.User;
import com.example.chat.user.repository.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.util.List;
import java.util.Map;

import static java.util.Locale.ROOT;

/**
 * E2EE key distribution. The server only stores the public key and a backup of the private key that was encrypted
 * in the browser with the user's recovery passphrase, so it can never read the private key.
 */
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class KeyController {

    private static final int MAX_BATCH = 500;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    /**
     * My own public key + encrypted backup (only the owner can read this).
     */
    @GetMapping("/me/keys")
    public KeyBundleResponse myKeys(Principal me) {
        User user = userRepository.findByUsername(me.getName()).orElseThrow();
        return new KeyBundleResponse(user.getPublicKey(), user.getKeyBackup());
    }

    /**
     * Store or update my key bundle. Requires my login password (-> 403 if wrong; not 401, which clients treat as an
     * expired session). Changing the public key additionally requires rotate=true (-> 409 otherwise).
     */
    @PutMapping("/me/keys")
    public Map<String, String> putMyKeys(@Valid @RequestBody PutKeysRequest request, Principal me) {
        User user = userRepository.findByUsername(me.getName()).orElseThrow();
        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            throw new ForbiddenException("Incorrect password");
        }

        boolean replacingKey = user.getPublicKey() != null && !user.getPublicKey().equals(request.publicKey());
        if (replacingKey && !request.rotate()) {
            throw new ConflictException(
                    "A different public key is already registered. Restore your backup or confirm key rotation.");
        }

        user.setPublicKey(request.publicKey());
        user.setKeyBackup(request.encryptedPrivateKey());
        userRepository.save(user);
        return Map.of("message", "Keys saved");
    }

    /**
     * Anyone logged in may fetch another user's public key (needed to encrypt to them).
     */
    @GetMapping("/{username}/public-key")
    public PublicKeyResponse publicKey(@PathVariable String username) {
        return userRepository.findByUsername(username.toLowerCase(ROOT))
                .filter(user -> user.getPublicKey() != null)
                .map(user -> new PublicKeyResponse(user.getUsername(), user.getPublicKey()))
                .orElseThrow(() -> new NotFoundException("No public key registered for this user"));
    }

    /**
     * Public keys of several users at once (e.g. all members of a group): GET /api/users/public-keys?usernames=a,b.
     * Users without a registered key are left out.
     */
    @GetMapping("/public-keys")
    public List<PublicKeyResponse> publicKeys(@RequestParam List<String> usernames) {
        if (usernames.size() > MAX_BATCH) {
            throw new IllegalArgumentException("At most " + MAX_BATCH + " usernames per request");
        }
        List<String> normalized = usernames.stream().map(u -> u.trim().toLowerCase(ROOT)).distinct().toList();
        return userRepository.findByUsernameIn(normalized).stream()
                .filter(user -> user.getPublicKey() != null)
                .map(user -> new PublicKeyResponse(user.getUsername(), user.getPublicKey()))
                .toList();
    }
}
