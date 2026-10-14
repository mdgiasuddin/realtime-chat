package com.example.chat.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * @param publicKey           base64 SPKI
 * @param encryptedPrivateKey JSON blob encrypted client-side with the user's recovery passphrase
 * @param rotate              true = the user knowingly replaces their existing key pair
 */
public record PutKeysRequest(
        @NotBlank @Size(max = 500) String publicKey,
        @NotBlank @Size(max = 4000) String encryptedPrivateKey,
        boolean rotate
) {
}
