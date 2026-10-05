package com.example.chat.message;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    @Query("""
            select m from ChatMessage m
            where (m.sender = :a and m.receiver = :b)
               or (m.sender = :b and m.receiver = :a)
            order by m.sentAt desc, m.id desc
            """)
    Page<ChatMessage> findConversation(@Param("a") String a, @Param("b") String b, Pageable pageable);

    @Query("""
            select m from ChatMessage m
            where m.sender = :u or m.receiver = :u
            order by m.sentAt desc, m.id desc
            """)
    List<ChatMessage> findRecentForUser(@Param("u") String u, Pageable pageable);
}
