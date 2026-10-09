package com.example.chat.group;

import com.example.chat.user.UserSummary;

import java.time.Instant;
import java.util.List;

/**
 * @param members in the order they joined
 * @param admins  usernames of the members who are admins (never empty while the group has members)
 */
public record GroupDto(
        Long id,
        String name,
        String createdBy,
        Instant createdAt,
        List<UserSummary> members,
        List<String> admins
) {
}
