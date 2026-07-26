-- Upgrade legacy/Drizzle-created installations that stored the short code in
-- plaintext. Existing values are hashed before the plaintext column is removed.
alter table public.minecraft_link_codes
  add column if not exists code_hash text;

do $upgrade$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'minecraft_link_codes'
      and column_name = 'code'
  ) then
    execute $sql$
      update public.minecraft_link_codes
      set code_hash = encode(digest(upper(trim(code)), 'sha256'), 'hex')
      where code_hash is null
    $sql$;
    alter table public.minecraft_link_codes drop column code;
  end if;
end
$upgrade$;

alter table public.minecraft_link_codes
  alter column code_hash set not null;

create unique index if not exists minecraft_link_codes_hash_idx
  on public.minecraft_link_codes(code_hash);

create index if not exists minecraft_link_codes_user_idx
  on public.minecraft_link_codes(user_id);
-- Atomically consumes a short-lived link code and attaches the authenticated
-- website account to the UUID reported by the trusted Minecraft server plugin.
create or replace function public.consume_minecraft_link_code(
  p_code_hash text,
  p_minecraft_uuid uuid,
  p_minecraft_username text
)
returns table(linked boolean, reason text)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_code_id uuid;
  v_user_id uuid;
  v_existing_user_id uuid;
  v_account_id uuid;
begin
  if p_minecraft_username !~ '^[A-Za-z0-9_]{3,16}$' then
    return query select false, 'invalid_username'::text;
    return;
  end if;

  select id, user_id
    into v_code_id, v_user_id
  from public.minecraft_link_codes
  where code_hash = p_code_hash
    and used_at is null
    and expires_at > now()
  for update;

  if not found then
    return query select false, 'invalid_or_expired'::text;
    return;
  end if;

  select user_id
    into v_existing_user_id
  from public.minecraft_accounts
  where minecraft_uuid = p_minecraft_uuid
  for update;

  if found and v_existing_user_id <> v_user_id then
    return query select false, 'minecraft_already_linked'::text;
    return;
  end if;

  insert into public.minecraft_accounts (
    user_id,
    minecraft_uuid,
    minecraft_username,
    linked_at,
    updated_at
  )
  values (
    v_user_id,
    p_minecraft_uuid,
    p_minecraft_username,
    now(),
    now()
  )
  on conflict (user_id) do update set
    minecraft_uuid = excluded.minecraft_uuid,
    minecraft_username = excluded.minecraft_username,
    linked_at = excluded.linked_at,
    updated_at = excluded.updated_at
  returning id into v_account_id;

  insert into public.player_statistics (minecraft_account_id)
  values (v_account_id)
  on conflict (minecraft_account_id) do nothing;

  update public.minecraft_link_codes
  set used_at = now()
  where id = v_code_id and used_at is null;

  if not found then
    return query select false, 'invalid_or_expired'::text;
    return;
  end if;

  return query select true, 'linked'::text;
exception
  when unique_violation then
    return query select false, 'minecraft_already_linked'::text;
end
$function$;

revoke all on function public.consume_minecraft_link_code(text, uuid, text) from public;
revoke all on function public.consume_minecraft_link_code(text, uuid, text) from anon;
revoke all on function public.consume_minecraft_link_code(text, uuid, text) from authenticated;
grant execute on function public.consume_minecraft_link_code(text, uuid, text) to service_role;

create index if not exists minecraft_link_codes_expiry_idx
  on public.minecraft_link_codes(expires_at)
  where used_at is null;