package com.example.chat.conversation.repository;

import com.example.chat.conversation.entity.ChatType;
import com.example.chat.conversation.entity.ConversationMember;
import com.example.chat.conversation.entity.ConversationMemberId;
import com.example.chat.conversation.entity.MemberRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ConversationMemberRepository extends JpaRepository<ConversationMember, ConversationMemberId> {

    List<ConversationMember> findByConversationIdOrderByJoinedAtAsc(Long conversationId);

    boolean existsByConversationIdAndUsername(Long conversationId, String username);

    /**
     * Is the user a member of the conversation, and is it of the given type?
     */
    @Query("""
            select case when count(m) > 0 then true else false end
            from ConversationMember m join Conversation c on c.id = m.conversationId
            where m.conversationId = :id and m.username = :username and c.chatType = :chatType
            """)
    boolean isMember(@Param("id") Long conversationId,
                     @Param("username") String username,
                     @Param("chatType") ChatType chatType);

    long countByConversationId(Long conversationId);

    long countByConversationIdAndRole(Long conversationId, MemberRole role);
}
