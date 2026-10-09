package com.example.chat.group;

/**
 * Pushed to members on /user/queue/groups whenever a group changes.
 *
 * @param group  the group after the change (for DELETED: as it was just before)
 * @param actor  username of whoever made the change
 * @param target username the change was about (MEMBER_REMOVED, ROLE_CHANGED), otherwise null
 */
public record GroupEvent(GroupEventType type, GroupDto group, String actor, String target) {
}