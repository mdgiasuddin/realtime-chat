-- E2EE identity: the public key (base64 SPKI) and the private key encrypted client-side (opaque JSON blob).
alter table _user
    add column public_key varchar(500);

alter table _user
    add column key_backup varchar(4000);
