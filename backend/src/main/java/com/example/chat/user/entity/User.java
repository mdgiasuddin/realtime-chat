package com.example.chat.user.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.NonNull;
import lombok.Setter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.Instant;
import java.util.Collection;
import java.util.HashSet;
import java.util.Set;

import static jakarta.persistence.GenerationType.IDENTITY;

@Entity
@Table(name = "_user")
@Getter
@Setter
@NoArgsConstructor
public class User implements UserDetails {

    @Id
    @GeneratedValue(strategy = IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, unique = true, length = 50)
    private String username;

    /**
     * BCrypt hash, never the raw password.
     */
    @Column(nullable = false)
    private String password;

    private String email;

    @Column(length = 30)
    private String phone;

    @Column(length = 500)
    private String bio;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    /**
     * E2EE public key as base64 SPKI, safe to share.
     */
    @Column(name = "public_key", length = 500)
    private String publicKey;

    /**
     * JSON blob holding the private key, encrypted client-side (opaque to the server).
     */
    @Column(name = "key_backup", length = 4000)
    private String keyBackup;

    @Override
    public @NonNull Collection<? extends GrantedAuthority> getAuthorities() {
        Set<SimpleGrantedAuthority> authorities = new HashSet<>();
        authorities.add(new SimpleGrantedAuthority("ROLE_USER"));
        return authorities;
    }
}
