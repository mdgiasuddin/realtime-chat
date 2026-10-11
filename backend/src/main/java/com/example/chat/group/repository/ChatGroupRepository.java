package com.example.chat.group.repository;

import com.example.chat.group.entity.ChatGroup;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatGroupRepository extends JpaRepository<ChatGroup, Long> {
}
