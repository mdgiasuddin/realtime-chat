package com.example.chat.group;

import com.example.chat.message.ChatMessageDto;
import com.example.chat.message.MessageService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.util.List;

import static org.springframework.http.HttpStatus.CREATED;

/**
 * REST endpoints for managing group chats. Every endpoint except create requires membership, and the admin-only
 * ones require the admin role (-> 403 otherwise).
 */
@RestController
@RequestMapping("/api/groups")
@RequiredArgsConstructor
public class GroupController {

    private final GroupService groupService;
    private final MessageService messageService;

    @PostMapping
    public ResponseEntity<GroupDto> create(@Valid @RequestBody CreateGroupRequest request, Principal me) {
        return ResponseEntity.status(CREATED).body(groupService.create(me.getName(), request));
    }

    @GetMapping("/{id}")
    public GroupDto get(@PathVariable Long id, Principal me) {
        return groupService.get(me.getName(), id);
    }

    @PostMapping("/{id}/members")
    public GroupDto addMembers(@PathVariable Long id, @Valid @RequestBody AddMembersRequest request, Principal me) {
        return groupService.addMembers(me.getName(), id, request);
    }

    @DeleteMapping("/{id}/members/me")
    public ResponseEntity<Void> leave(@PathVariable Long id, Principal me) {
        groupService.leave(me.getName(), id);
        return ResponseEntity.noContent().build();
    }

    // ---- admin only ----

    @PatchMapping("/{id}")
    public GroupDto rename(@PathVariable Long id, @Valid @RequestBody RenameGroupRequest request, Principal me) {
        return groupService.rename(me.getName(), id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, Principal me) {
        groupService.delete(me.getName(), id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Removes another member. (Usernames are at least 3 characters, so this never shadows /members/me.)
     */
    @DeleteMapping("/{id}/members/{username}")
    public GroupDto removeMember(@PathVariable Long id, @PathVariable String username, Principal me) {
        return groupService.removeMember(me.getName(), id, username);
    }

    /**
     * Promotes or demotes a member: PATCH /api/groups/12/members/bob {"admin": true}
     */
    @PatchMapping("/{id}/members/{username}")
    public GroupDto updateMember(@PathVariable Long id,
                                 @PathVariable String username,
                                 @Valid @RequestBody UpdateMemberRequest request,
                                 Principal me) {
        return groupService.setAdmin(me.getName(), id, username, request.admin());
    }

    /**
     * Group messages, newest first, paged: GET /api/groups/12/messages?page=0&size=30
     */
    @GetMapping("/{id}/messages")
    public List<ChatMessageDto> history(@PathVariable Long id,
                                        Principal me,
                                        @RequestParam(defaultValue = "0") int page,
                                        @RequestParam(defaultValue = "30") int size) {
        return messageService.groupHistory(me.getName(), id, page, size);
    }
}
