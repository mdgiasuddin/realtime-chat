package com.example.chat.conversation.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

import static com.example.chat.conversation.entity.ChatType.GROUP;
import static jakarta.persistence.EnumType.STRING;
import static jakarta.persistence.GenerationType.IDENTITY;

/**
 * A group chat or a one-to-one chat. Its participants are {@link ConversationMember}s either way.
 */
@Entity
@Getter
@Setter
@NoArgsConstructor
public class Conversation {

    @Id
    @GeneratedValue(strategy = IDENTITY)
    private Long id;

    @Enumerated(STRING)
    @Column(nullable = false, length = 10)
    private ChatType chatType;

    /**
     * Group name; null for one-to-one chats.
     */
    @Column(length = 100)
    private String name;

    /**
     * See {@link #directKey(String, String)}; null for groups.
     */
    @Column(length = 101, unique = true)
    private String directKey;

    @Column(nullable = false, length = 50)
    private String createdBy;   // username

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    /**
     * Newest message, null while there is none.
     */
    private Long lastMessageId;

    /**
     * When the newest message was sent (createdAt while there is none); conversation lists are sorted by it.
     */
    @Column(nullable = false)
    private Instant lastActivityAt = createdAt;

    public boolean isGroup() {
        return chatType == GROUP;
    }

    /**
     * The username at the other end of a one-to-one chat.
     */
    public String otherParticipant(String me) {
        String[] usernames = directKey.split(":");
        return usernames[0].equals(me) ? usernames[1] : usernames[0];
    }

    /**
     * Identifies the one-to-one chat between two users: "alice:bob", the same whoever starts it. (Usernames never
     * contain ':'.)
     */
    public static String directKey(String a, String b) {
        return a.compareTo(b) <= 0 ? a + ":" + b : b + ":" + a;
    }
}
