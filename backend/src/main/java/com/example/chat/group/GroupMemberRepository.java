package com.example.chat.group;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface GroupMemberRepository extends JpaRepository<GroupMember, GroupMemberId> {

    List<GroupMember> findByGroupIdOrderByJoinedAtAsc(Long groupId);

    boolean existsByGroupIdAndUsername(Long groupId, String username);

    @Query("select m.groupId from GroupMember m where m.username = :u")
    List<Long> findGroupIdsByUsername(@Param("u") String username);

    long countByGroupId(Long groupId);

    long countByGroupIdAndRole(Long groupId, GroupRole role);
}
