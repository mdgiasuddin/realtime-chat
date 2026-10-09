package com.example.chat.group;

import com.example.chat.common.ForbiddenException;
import com.example.chat.user.User;
import com.example.chat.user.UserRepository;
import com.example.chat.user.UserSummary;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import static com.example.chat.group.GroupEventType.CREATED;
import static com.example.chat.group.GroupEventType.DELETED;
import static com.example.chat.group.GroupEventType.MEMBER_ADDED;
import static com.example.chat.group.GroupEventType.MEMBER_LEFT;
import static com.example.chat.group.GroupEventType.MEMBER_REMOVED;
import static com.example.chat.group.GroupEventType.RENAMED;
import static com.example.chat.group.GroupEventType.ROLE_CHANGED;
import static com.example.chat.group.GroupRole.ADMIN;
import static com.example.chat.group.GroupRole.MEMBER;
import static java.util.Locale.ROOT;

@Service
@RequiredArgsConstructor
public class GroupService {

    /**
     * Messages are fanned out to every member individually, so keep groups reasonably small.
     */
    static final int MAX_MEMBERS = 100;

    private final ChatGroupRepository groupRepository;
    private final GroupMemberRepository memberRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Creates a group; the creator becomes its admin.
     */
    @Transactional
    public GroupDto create(String me, CreateGroupRequest request) {
        Set<String> others = normalize(request.members());
        others.remove(me);
        if (others.isEmpty()) {
            throw new IllegalArgumentException("A group needs at least one other member");
        }
        // The creator joins first, so they also count as the longest-standing member.
        Set<String> usernames = new LinkedHashSet<>(List.of(me));
        usernames.addAll(others);
        checkSize(usernames.size());
        requireUsersExist(usernames);

        ChatGroup group = new ChatGroup();
        group.setName(request.name().trim());
        group.setCreatedBy(me);
        group = groupRepository.save(group);
        for (String username : usernames) {
            memberRepository.save(new GroupMember(group.getId(), username, username.equals(me) ? ADMIN : MEMBER));
        }

        GroupDto dto = toDto(group);
        publishAfterCommit(usernames, new GroupEvent(CREATED, dto, me, null));
        return dto;
    }

    /**
     * Any member can add others.
     */
    @Transactional
    public GroupDto addMembers(String me, Long groupId, AddMembersRequest request) {
        requireMember(groupId, me);
        ChatGroup group = groupRepository.findById(groupId).orElseThrow();

        Set<String> added = normalize(request.usernames());
        added.removeIf(username -> memberRepository.existsByGroupIdAndUsername(groupId, username));
        if (added.isEmpty()) {
            throw new IllegalArgumentException("Those users are already members");
        }
        checkSize(memberRepository.countByGroupId(groupId) + added.size());
        requireUsersExist(added);
        for (String username : added) {
            memberRepository.save(new GroupMember(groupId, username, MEMBER));
        }

        GroupDto dto = toDto(group);
        publishAfterCommit(usernames(dto), new GroupEvent(MEMBER_ADDED, dto, me, null));
        return dto;
    }

    /**
     * Removes me from the group. If I was the last admin, the longest-standing member takes over;
     * the group (and its messages) is deleted when its last member leaves.
     */
    @Transactional
    public void leave(String me, Long groupId) {
        GroupMember membership = requireMembership(groupId, me);
        ChatGroup group = groupRepository.findById(groupId).orElseThrow();
        memberRepository.delete(membership);
        memberRepository.flush();

        List<GroupMember> remaining = memberRepository.findByGroupIdOrderByJoinedAtAsc(groupId);
        if (remaining.isEmpty()) {
            groupRepository.delete(group);
        } else if (remaining.stream().noneMatch(GroupMember::isAdmin)) {
            remaining.getFirst().setRole(ADMIN);
        }

        GroupDto dto = toDto(group);
        // Notify the leaver too, so their other tabs/devices drop the group.
        publishAfterCommit(plus(usernames(dto), me), new GroupEvent(MEMBER_LEFT, dto, me, null));
    }

    @Transactional
    public GroupDto rename(String me, Long groupId, RenameGroupRequest request) {
        requireAdmin(groupId, me);
        ChatGroup group = groupRepository.findById(groupId).orElseThrow();
        group.setName(request.name().trim());

        GroupDto dto = toDto(group);
        publishAfterCommit(usernames(dto), new GroupEvent(RENAMED, dto, me, null));
        return dto;
    }

    /**
     * Deletes the group with all its messages.
     */
    @Transactional
    public void delete(String me, Long groupId) {
        requireAdmin(groupId, me);
        ChatGroup group = groupRepository.findById(groupId).orElseThrow();
        GroupDto dto = toDto(group);
        groupRepository.delete(group); // members and messages go with it (ON DELETE CASCADE)
        publishAfterCommit(usernames(dto), new GroupEvent(DELETED, dto, me, null));
    }

    @Transactional
    public GroupDto removeMember(String me, Long groupId, String username) {
        requireAdmin(groupId, me);
        String target = username.trim().toLowerCase(ROOT);
        if (target.equals(me)) {
            throw new IllegalArgumentException("Leave the group to remove yourself");
        }
        GroupMember membership = memberRepository.findById(new GroupMemberId(groupId, target))
                .orElseThrow(() -> new IllegalArgumentException("Not a member: " + target));
        ChatGroup group = groupRepository.findById(groupId).orElseThrow();
        memberRepository.delete(membership);
        memberRepository.flush();

        GroupDto dto = toDto(group);
        // The removed user is notified too, so their client drops the group.
        publishAfterCommit(plus(usernames(dto), target), new GroupEvent(MEMBER_REMOVED, dto, me, target));
        return dto;
    }

    /**
     * Promotes a member to admin or demotes an admin; the last admin can't be demoted.
     */
    @Transactional
    public GroupDto setAdmin(String me, Long groupId, String username, boolean admin) {
        requireAdmin(groupId, me);
        String target = username.trim().toLowerCase(ROOT);
        GroupMember membership = memberRepository.findById(new GroupMemberId(groupId, target))
                .orElseThrow(() -> new IllegalArgumentException("Not a member: " + target));
        if (membership.isAdmin() && !admin && memberRepository.countByGroupIdAndRole(groupId, ADMIN) == 1) {
            throw new IllegalArgumentException("A group needs at least one admin");
        }
        membership.setRole(admin ? ADMIN : MEMBER);

        GroupDto dto = toDto(groupRepository.findById(groupId).orElseThrow());
        publishAfterCommit(usernames(dto), new GroupEvent(ROLE_CHANGED, dto, me, target));
        return dto;
    }

    @Transactional(readOnly = true)
    public GroupDto get(String me, Long groupId) {
        requireMember(groupId, me);
        return toDto(groupRepository.findById(groupId).orElseThrow());
    }

    /**
     * Groups I'm a member of, in no particular order.
     */
    @Transactional(readOnly = true)
    public List<ChatGroup> groupsOf(String me) {
        return groupRepository.findAllById(memberRepository.findGroupIdsByUsername(me));
    }

    @Transactional(readOnly = true)
    public List<String> memberUsernames(Long groupId) {
        return memberRepository.findByGroupIdOrderByJoinedAtAsc(groupId).stream()
                .map(GroupMember::getUsername)
                .toList();
    }

    public void requireMember(Long groupId, String username) {
        if (!memberRepository.existsByGroupIdAndUsername(groupId, username)) {
            throw new ForbiddenException("You are not a member of this group");
        }
    }

    private GroupMember requireMembership(Long groupId, String username) {
        return memberRepository.findById(new GroupMemberId(groupId, username))
                .orElseThrow(() -> new ForbiddenException("You are not a member of this group"));
    }

    private void requireAdmin(Long groupId, String username) {
        if (!requireMembership(groupId, username).isAdmin()) {
            throw new ForbiddenException("Only group admins can do that");
        }
    }

    private GroupDto toDto(ChatGroup group) {
        List<GroupMember> memberships = memberRepository.findByGroupIdOrderByJoinedAtAsc(group.getId());
        Map<String, User> users = userRepository.findByUsernameIn(memberships.stream().map(GroupMember::getUsername).toList())
                .stream()
                .collect(Collectors.toMap(User::getUsername, Function.identity()));
        List<UserSummary> members = memberships.stream()
                .map(m -> users.get(m.getUsername()))
                .map(user -> new UserSummary(user.getId(), user.getName(), user.getUsername()))
                .toList();
        List<String> admins = memberships.stream()
                .filter(GroupMember::isAdmin)
                .map(GroupMember::getUsername)
                .toList();
        return new GroupDto(group.getId(), group.getName(), group.getCreatedBy(), group.getCreatedAt(), members, admins);
    }

    private void requireUsersExist(Set<String> usernames) {
        Set<String> found = userRepository.findByUsernameIn(usernames).stream()
                .map(User::getUsername)
                .collect(Collectors.toSet());
        usernames.stream()
                .filter(username -> !found.contains(username))
                .findFirst()
                .ifPresent(missing -> {
                    throw new IllegalArgumentException("User not found: " + missing);
                });
    }

    private static void checkSize(long size) {
        if (size > MAX_MEMBERS) {
            throw new IllegalArgumentException("A group can have at most " + MAX_MEMBERS + " members");
        }
    }

    private static Set<String> normalize(Collection<String> usernames) {
        return usernames.stream()
                .filter(username -> username != null && !username.isBlank())
                .map(username -> username.trim().toLowerCase(ROOT))
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private static List<String> usernames(GroupDto group) {
        return group.members().stream().map(UserSummary::username).toList();
    }

    private static Set<String> plus(Collection<String> usernames, String extra) {
        Set<String> result = new LinkedHashSet<>(usernames);
        result.add(extra);
        return result;
    }

    /**
     * Push only once the change is committed, so clients that react by fetching see the new state.
     */
    private void publishAfterCommit(Collection<String> recipients, GroupEvent event) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                recipients.forEach(username -> messagingTemplate.convertAndSendToUser(username, "/queue/groups", event));
            }
        });
    }
}
