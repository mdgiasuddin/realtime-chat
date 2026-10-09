package com.example.chat.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);

    boolean existsByUsername(String username);

    List<User> findTop20ByUsernameContainingIgnoreCase(String q);

    List<User> findByUsernameIn(Collection<String> usernames);
}
