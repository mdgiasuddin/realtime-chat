-- Refresh tokens, rotated on every use. All tokens descending from one login share a family_id, so the whole
-- line can be revoked at once (logout, or an already-used token showing up again).
create table if not exists refresh_token
(
    id
    bigint
    generated
    by
    default as
    identity
    primary
    key,
    -- SHA-256 (hex) of the token; the token itself is never stored
    token_hash
    varchar
(
    64
) not null unique,
    username varchar
(
    50
) not null,
    family_id uuid not null,
    created_at timestamp
(
    6
) with time zone not null,
      expires_at timestamp (6)
  with time zone not null,
      -- set once the token has been exchanged for a new one
      rotated_at timestamp (6)
  with time zone
      );

create index if not exists idx_refresh_token_family on refresh_token (family_id);

-- periodic cleanup of expired tokens
create index if not exists idx_refresh_token_expires on refresh_token (expires_at);
