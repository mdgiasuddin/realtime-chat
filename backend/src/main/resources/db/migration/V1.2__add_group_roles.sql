alter table group_members
    add column role varchar(10) not null default 'MEMBER';

alter table group_members
    add constraint chk_group_member_role check (role in ('ADMIN', 'MEMBER'));

-- Existing groups: the creator becomes admin...
update group_members m
set role = 'ADMIN' from chat_groups g
where g.id = m.group_id
  and g.created_by = m.username;

-- ...and groups whose creator already left get their longest-standing member as admin.
update group_members m
set role = 'ADMIN'
where not exists (select 1 from group_members a where a.group_id = m.group_id and a.role = 'ADMIN')
  and m.username = (select f.username
                    from group_members f
                    where f.group_id = m.group_id
                    order by f.joined_at, f.username
    limit 1);
