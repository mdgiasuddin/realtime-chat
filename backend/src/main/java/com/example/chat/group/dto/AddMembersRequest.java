package com.example.chat.group.dto;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record AddMembersRequest(
        @NotEmpty List<String> usernames
) {
}
