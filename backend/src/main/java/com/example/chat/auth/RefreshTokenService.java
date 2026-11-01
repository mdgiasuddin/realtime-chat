package com.example.chat.auth;

import com.example.chat.auth.entity.RefreshToken;
import com.example.chat.auth.repository.RefreshTokenRepository;
import com.example.chat.exception.UnauthorizedException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;

/**
 * Opaque, single-use refresh tokens. Each refresh exchanges the token for a new one (rotation), so a stolen token
 * is only useful until the user's own client refreshes next.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final RefreshTokenRepository repository;

    @Value("${app.auth.refresh-token.validity}")
    private Duration validity;

    @Value("${app.auth.refresh-token.reuse-grace}")
    private Duration reuseGrace;

    /**
     * Starts a new session (token family) for the user.
     *
     * @return the token to hand to the client
     */
    @Transactional
    public String issue(String username) {
        return issue(username, UUID.randomUUID());
    }

    /**
     * Exchanges a valid refresh token for a new one of the same family; the old one stops working.
     * <p>
     * An already-rotated token showing up again means it was probably copied, so the whole family is revoked and
     * both the thief and the user have to log in again. The exception is a retry shortly after the rotation (two tabs
     * racing, or the response got lost on the way), which just gets another token.
     *
     * @throws UnauthorizedException if the token is missing, unknown, expired or revoked
     */
    @Transactional(noRollbackFor = UnauthorizedException.class)
    public Rotation rotate(String token) {
        RefreshToken current = token == null ? null : repository.findByTokenHashForUpdate(hash(token)).orElse(null);
        Instant now = Instant.now();
        if (current == null || current.getExpiresAt().isBefore(now)) {
            throw invalid();
        }
        if (current.getRotatedAt() == null) {
            current.setRotatedAt(now);
        } else if (current.getRotatedAt().plus(reuseGrace).isBefore(now)) {
            log.warn("Refresh token of {} was used again after rotation, revoking that session", current.getUsername());
            repository.deleteByFamilyId(current.getFamilyId());
            throw invalid();
        }
        return new Rotation(current.getUsername(), issue(current.getUsername(), current.getFamilyId()));
    }

    /**
     * Ends the session the token belongs to. Missing or unknown tokens are ignored.
     */
    @Transactional
    public void revoke(String token) {
        if (token != null) {
            repository.findByTokenHash(hash(token)).ifPresent(t -> repository.deleteByFamilyId(t.getFamilyId()));
        }
    }

    @Scheduled(fixedDelayString = "PT1H", initialDelayString = "PT1M")
    @Transactional
    public void deleteExpired() {
        int deleted = repository.deleteExpired(Instant.now());
        if (deleted > 0) {
            log.info("Deleted {} expired refresh tokens", deleted);
        }
    }

    private String issue(String username, UUID familyId) {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        RefreshToken entity = new RefreshToken();
        entity.setTokenHash(hash(token));
        entity.setUsername(username);
        entity.setFamilyId(familyId);
        entity.setExpiresAt(entity.getCreatedAt().plus(validity));
        repository.save(entity);
        return token;
    }

    private static String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static UnauthorizedException invalid() {
        return new UnauthorizedException("Session expired, please log in again");
    }

    /**
     * @param token the new refresh token
     */
    public record Rotation(String username, String token) {
    }
}
