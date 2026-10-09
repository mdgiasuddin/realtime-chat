package com.example.chat.group;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record AddMembersRequest(
        @NotEmpty List<String> usernames
) {
}
