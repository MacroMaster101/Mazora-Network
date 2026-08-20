-- Generalise creator discount codes so the same audited checkout path can
-- also issue event and promotional codes. Existing rows remain creators.

alter table public.creator_codes
  add column if not exists code_type text not null default 'creator';

alter table public.creator_codes
  drop constraint if exists creator_codes_type_check;

alter table public.creator_codes
  add constraint creator_codes_type_check
  check (code_type in ('creator', 'event'));

create index if not exists creator_codes_type_idx
  on public.creator_codes(code_type, created_at desc);
