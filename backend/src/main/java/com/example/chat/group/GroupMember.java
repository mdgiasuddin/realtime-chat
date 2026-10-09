package com.example.chat.group;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

import static jakarta.persistence.EnumType.STRING;

@Entity
@Table(name = "group_members", indexes = {
        @Index(name = "idx_group_members_username", columnList = "username")
})
@IdClass(GroupMemberId.class)
@Getter
@Setter
@NoArgsConstructor
public class GroupMember {

    @Id
    private Long groupId;

    @Id
    @Column(length = 50)
    private String username;

    @Enumerated(STRING)
    @Column(nullable = false, length = 10)
    private GroupRole role = GroupRole.MEMBER;

    @Column(nullable = false)
    private Instant joinedAt = Instant.now();

    public GroupMember(Long groupId, String username, GroupRole role) {
        this.groupId = groupId;
        this.username = username;
        this.role = role;
    }

    public boolean isAdmin() {
        return role == GroupRole.ADMIN;
    }
}
