package com.example.chat.message.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

import static jakarta.persistence.GenerationType.IDENTITY;

@Entity
@Getter
@Setter
@NoArgsConstructor
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String sender;      // username

    @Column(nullable = false)
    private Long conversationId;

    /**
     * Set for one-to-one messages only (null in groups). Redundant with the conversation, but it's bound into the
     * ciphertext as "u:<receiver>", so it has to stay as it was sent.
     */
    @Column(length = 50)
    private String receiver;    // username

    /**
     * End-to-end encrypted envelope (JSON) the server cannot read.
     */
    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @Column(nullable = false)
    private Instant sentAt = Instant.now();
}
