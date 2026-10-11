package com.example.chat.group.dto;

import jakarta.validation.constraints.NotNull;

public record UpdateMemberRequest(
        @NotNull Boolean admin
) {
}
