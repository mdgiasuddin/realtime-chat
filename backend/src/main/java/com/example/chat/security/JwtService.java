package com.example.chat.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtParserBuilder;
import io.jsonwebtoken.Jwts;
import jakarta.annotation.Nonnull;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.security.Key;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.Date;

@Slf4j
@Component
public class JwtService {

    @Value("${app.jwt.private-key-path}")
    private String privateKeyPath;
    @Value("${app.jwt.public-key-path}")
    private String publicKeyPath;
    private PrivateKey privateKey;
    private PublicKey publicKey;

    @PostConstruct
    public void init() {
        try {
            this.privateKey = loadPrivateKey(privateKeyPath);
            this.publicKey = loadPublicKey(publicKeyPath);

            log.info("Private & Public key loaded successfully");
        } catch (final Exception e) {
            log.error("Error loading private key", e);
            throw new RuntimeException("Error loading private key", e);
        }
    }

    private PrivateKey loadPrivateKey(final String privateKeyPath) throws Exception {
        try (final InputStream is = this.getClass().getClassLoader().getResourceAsStream(privateKeyPath)) {
            if (is == null) {
                throw new RuntimeException("Private key not found");
            }

            final String key = new String(is.readAllBytes());
            final String privateKeyPEM = key.replaceAll("\\s", "");

            final byte[] encoded = Base64.getDecoder().decode(privateKeyPEM);
            final PKCS8EncodedKeySpec keySpec = new PKCS8EncodedKeySpec(encoded);
            return KeyFactory.getInstance("RSA").generatePrivate(keySpec);
        }
    }

    private PublicKey loadPublicKey(final String publicKeyPath) throws Exception {
        try (final InputStream is = this.getClass().getClassLoader().getResourceAsStream(publicKeyPath)) {
            if (is == null) {
                throw new RuntimeException("Public key not found");
            }

            final String key = new String(is.readAllBytes());
            final String publicKeyPEM = key.replaceAll("\\s", "");

            final byte[] encoded = Base64.getDecoder().decode(publicKeyPEM);
            final X509EncodedKeySpec keySpec = new X509EncodedKeySpec(encoded);
            return KeyFactory.getInstance("RSA").generatePublic(keySpec);
        }
    }

    public String generateToken(@Nonnull final String username) {
        return buildToken(username, privateKey);
    }

    public String extractUsername(String token) {
        return extractAllClaims(token).getSubject();
    }

    public boolean isValid(String token) {
        try {
            extractAllClaims(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    protected Claims extractAllClaims(String token) {
        JwtParserBuilder parserBuilder = Jwts.parser().verifyWith(publicKey);

        return parserBuilder
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    protected String buildToken(String username, Key signingKey) {
        final Date now = new Date();
        final Date expiration = new Date(System.currentTimeMillis() + 86400000);

        return Jwts.builder()
                .subject(username)
                .issuedAt(now)
                .expiration(expiration)
                .issuer("realtime-chat-app")
                .signWith(signingKey)
                .compact();
    }
}
