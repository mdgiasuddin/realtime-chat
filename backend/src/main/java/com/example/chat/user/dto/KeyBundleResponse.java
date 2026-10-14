package com.example.chat.user.dto;

public record KeyBundleResponse(
        String publicKey,
        String encryptedPrivateKey
) {
}
