package com.example.chat.group;

import jakarta.validation.constraints.NotNull;

public record UpdateMemberRequest(
        @NotNull Boolean admin
) {
}
