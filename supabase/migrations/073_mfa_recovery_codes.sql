-- Recovery codes for two-step verification.
--
-- Supabase Auth has no recovery codes of its own. These are single-use codes
-- shown once when two-step verification is turned on (or regenerated), for
-- signing in after losing the authenticator. Using one turns two-step
-- verification off for the account, which then sets it up again.
--
-- Only hashes are stored — sha256 over the user id and the normalised code —
-- and only the server's DATABASE_URL connection reads or writes this table
-- (src/lib/auth/recovery-codes.ts). RLS is on with no policies and the API
-- roles hold no privileges, so it is unreachable through the Data API.
--
-- Safe to re-run.

begin;

create table if not exists public.mfa_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint mfa_recovery_codes_hash_unique unique (user_id, code_hash)
);

create index if not exists mfa_recovery_codes_user_idx on public.mfa_recovery_codes (user_id);

alter table public.mfa_recovery_codes enable row level security;
revoke all on public.mfa_recovery_codes from anon, authenticated;

commit;
