package com.example.chat.group;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CreateGroupRequest(
        @NotBlank @Size(max = 100) String name,
        /* Usernames of the other members; the creator is always added. */
        @NotEmpty List<String> members
) {
}
