package com.example.chat.conversation.repository;

import com.example.chat.conversation.entity.ChatType;
import com.example.chat.conversation.entity.Conversation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface ConversationRepository extends JpaRepository<Conversation, Long> {

    Optional<Conversation> findByIdAndChatType(Long id, ChatType chatType);

    Optional<Conversation> findByDirectKey(String directKey);

    /**
     * Creates the one-to-one conversation unless it exists already: two first messages between the same pair may
     * race, and the unique direct_key lets exactly one of them win.
     *
     * @return 1 if this call created it, 0 if it existed
     */
    @Modifying
    @Query(value = """
            insert into conversation (chat_type, direct_key, created_by, created_at, last_activity_at)
            values ('ONE_TO_ONE', :directKey, :createdBy, now(), now())
            on conflict (direct_key) do nothing
            """, nativeQuery = true)
    int insertDirectIfAbsent(@Param("directKey") String directKey, @Param("createdBy") String createdBy);

    /**
     * Records a new message as the conversation's newest, unless a newer one got there first (concurrent sends).
     * "Newer" uses the same order as the history: sentAt, then id.
     */
    @Modifying
    @Query("""
            update Conversation c set c.lastMessageId = :messageId, c.lastActivityAt = :sentAt
            where c.id = :id
              and (c.lastMessageId is null
                   or c.lastActivityAt < :sentAt
                   or (c.lastActivityAt = :sentAt and c.lastMessageId < :messageId))
            """)
    int updateLastMessage(@Param("id") Long id, @Param("messageId") Long messageId, @Param("sentAt") Instant sentAt);

    /**
     * All conversations the user is a member of, with their newest message, most recent activity first.
     * One query: the member index yields the ids, the rest are primary-key lookups.
     */
    @Query("""
            select new com.example.chat.conversation.repository.ConversationWithLastMessage(c, m)
            from ConversationMember cm
            join Conversation c on c.id = cm.conversationId
            left join ChatMessage m on m.id = c.lastMessageId
            where cm.username = :username
            order by c.lastActivityAt desc, c.id desc
            """)
    List<ConversationWithLastMessage> findAllOfMember(@Param("username") String username);
}
