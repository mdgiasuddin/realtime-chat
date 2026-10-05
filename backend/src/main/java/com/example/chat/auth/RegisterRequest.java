package com.example.chat.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank @Size(max = 100) String name,
        @NotBlank @Size(min = 3, max = 50)
        @Pattern(regexp = "^[A-Za-z0-9_.]+$", message = "may contain letters, digits, '_' and '.' only")
        String username,
        @NotBlank @Size(min = 6, max = 100) String password,
        @Email String email,
        @Size(max = 30) String phone,
        @Size(max = 500) String bio
) {
}
