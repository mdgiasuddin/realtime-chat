package com.example.chat.conversation.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

import static com.example.chat.conversation.entity.MemberRole.ADMIN;
import static com.example.chat.conversation.entity.MemberRole.MEMBER;
import static jakarta.persistence.EnumType.STRING;

@Entity
@IdClass(ConversationMemberId.class)
@Getter
@Setter
@NoArgsConstructor
public class ConversationMember {

    @Id
    private Long conversationId;

    @Id
    @Column(length = 50)
    private String username;

    @Enumerated(STRING)
    @Column(nullable = false, length = 10)
    private MemberRole role = MEMBER;

    @Column(nullable = false)
    private Instant joinedAt = Instant.now();

    public ConversationMember(Long conversationId, String username, MemberRole role) {
        this.conversationId = conversationId;
        this.username = username;
        this.role = role;
    }

    public boolean isAdmin() {
        return role == ADMIN;
    }
}
