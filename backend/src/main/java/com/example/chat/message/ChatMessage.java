package com.example.chat.message;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

import static jakarta.persistence.GenerationType.IDENTITY;

@Entity
@Table(name = "chat_messages", indexes = {
        @Index(name = "idx_msg_sender_receiver", columnList = "sender,receiver,sent_at"),
        @Index(name = "idx_msg_receiver", columnList = "receiver,sent_at"),
        @Index(name = "idx_msg_group", columnList = "group_id,sent_at")
})
@Getter
@Setter
@NoArgsConstructor
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String sender;      // username

    /**
     * Exactly one of receiver / groupId is set.
     */
    @Column(length = 50)
    private String receiver;    // username, for direct messages

    private Long groupId;       // for group messages

    @Column(nullable = false, length = 2000)
    private String content;

    @Column(nullable = false)
    private Instant sentAt = Instant.now();
}
