package com.example.chat.message;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    @Query("""
            select m from ChatMessage m
            where (m.sender = :a and m.receiver = :b)
               or (m.sender = :b and m.receiver = :a)
            order by m.sentAt desc, m.id desc
            """)
    Page<ChatMessage> findConversation(@Param("a") String a, @Param("b") String b, Pageable pageable);

    /**
     * Recent direct (non-group) messages sent or received by the user.
     */
    @Query("""
            select m from ChatMessage m
            where m.groupId is null and (m.sender = :u or m.receiver = :u)
            order by m.sentAt desc, m.id desc
            """)
    List<ChatMessage> findRecentForUser(@Param("u") String u, Pageable pageable);

    @Query("""
            select m from ChatMessage m
            where m.groupId = :groupId
            order by m.sentAt desc, m.id desc
            """)
    Page<ChatMessage> findGroupHistory(@Param("groupId") Long groupId, Pageable pageable);

    /**
     * The newest message of each of the given groups (groups without messages are absent).
     */
    @Query("""
            select m from ChatMessage m
            where m.id in (select max(m2.id) from ChatMessage m2 where m2.groupId in :groupIds group by m2.groupId)
            """)
    List<ChatMessage> findLatestInGroups(@Param("groupIds") Collection<Long> groupIds);
}
