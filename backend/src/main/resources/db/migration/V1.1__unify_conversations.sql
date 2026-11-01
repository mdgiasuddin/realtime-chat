-- One table for both kinds of chat: chat_group becomes conversation (chat_type GROUP or ONE_TO_ONE),
-- group_member becomes conversation_member and every message points at its conversation.
-- Group ids are kept, so the "g:<id>" tags bound into end-to-end encrypted group messages stay valid.


-- conversation

alter table chat_group
    rename to conversation;
alter table conversation
    rename constraint chat_group_pkey to conversation_pkey;
alter sequence chat_group_id_seq rename to conversation_id_seq;

alter table conversation
    add column chat_type varchar(10) not null default 'GROUP',
    -- "alice:bob" (the two usernames, sorted) for one-to-one chats, so each pair has exactly one; null for groups
    add column direct_key       varchar(101),
    -- newest message, kept up to date on every send so listing conversations needs no scan over the messages.
    -- No foreign key: messages are only ever deleted together with their conversation.
    add column last_message_id  bigint,
    -- sent_at of the newest message, or created_at while there is none; the conversation list is sorted by it
    add column last_activity_at timestamp(6) with time zone;

update conversation
set last_activity_at = created_at;

alter table conversation
    alter column chat_type drop default,
alter
column last_activity_at set not null,
    alter
column name drop
not null,
    add constraint chk_conversation_type check (chat_type in ('ONE_TO_ONE', 'GROUP')),
    add constraint chk_conversation_shape check (
        (chat_type = 'GROUP' and name is not null and direct_key is null)
            or (chat_type = 'ONE_TO_ONE' and name is null and direct_key is not null)),
    add constraint uq_conversation_direct_key unique (direct_key);


-- conversation_member

alter table group_member
    rename to conversation_member;
alter table conversation_member
    rename column group_id to conversation_id;
alter table conversation_member
    rename constraint group_member_pkey to conversation_member_pkey;
alter table conversation_member
    rename constraint group_member_group_id_fkey to conversation_member_conversation_id_fkey;
alter table conversation_member
    rename constraint chk_group_member_role to chk_conversation_member_role;

-- "my conversations": the ids come straight from the index, then the conversations are fetched by primary key
drop index if exists idx_group_member_username;
create index if not exists idx_conversation_member_username on conversation_member (username, conversation_id);


-- one-to-one conversations for the direct messages exchanged so far
-- (collate "C" sorts by code point, like Java's String.compareTo that builds the key at runtime)

insert into conversation (chat_type, direct_key, created_by, created_at, last_activity_at)
select 'ONE_TO_ONE',
       least(sender collate "C", receiver collate "C") || ':' || greatest(sender collate "C", receiver collate "C"),
       (array_agg(sender order by sent_at, id))[1],
       min(sent_at),
       min(sent_at)
from chat_message
where receiver is not null
group by least(sender collate "C", receiver collate "C"), greatest(sender collate "C", receiver collate "C");

insert into conversation_member (conversation_id, username, joined_at, role)
select c.id, p.username, c.created_at, 'MEMBER'
from conversation c
         cross join lateral (values (split_part(c.direct_key, ':', 1)),
                                    (split_part(c.direct_key, ':', 2))) as p (username)
where c.chat_type = 'ONE_TO_ONE' on conflict do nothing;


-- chat_message

alter table chat_message
    add column conversation_id bigint;

update chat_message m
set conversation_id = c.id from conversation c
where m.receiver is not null
  and c.direct_key = least(m.sender collate "C"
    , m.receiver collate "C") || ':' ||
    greatest(m.sender collate "C"
    , m.receiver collate "C");

update chat_message
set conversation_id = group_id
where group_id is not null;

drop index if exists idx_msg_group;
drop index if exists idx_msg_sender_receiver;
drop index if exists idx_msg_receiver;

-- receiver stays set on one-to-one messages: it's bound into their ciphertext as "u:<receiver>"
alter table chat_message
drop
constraint chk_msg_target,
    drop
column group_id,
    alter
column conversation_id set not null,
    add constraint chat_message_conversation_id_fkey
        foreign key (conversation_id) references conversation (id) on delete
cascade;

-- a conversation's history, newest first
create index if not exists idx_msg_conversation on chat_message (conversation_id, sent_at desc, id desc);

update conversation c
set last_message_id  = latest.id,
    last_activity_at = latest.sent_at from (select distinct on (conversation_id) conversation_id, id, sent_at
      from chat_message
      order by conversation_id, sent_at desc, id desc) latest
where c.id = latest.conversation_id;
