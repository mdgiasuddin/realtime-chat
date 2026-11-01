package com.example.chat.message.repository;

import com.example.chat.message.entity.ChatMessage;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    /**
     * A page of the conversation's messages, newest first (served by idx_msg_conversation). Returns a List rather
     * than a Page, so no count query runs.
     */
    @Query("""
            select m from ChatMessage m
            where m.conversationId = :conversationId
            order by m.sentAt desc, m.id desc
            """)
    List<ChatMessage> findHistory(@Param("conversationId") Long conversationId, Pageable pageable);
}
