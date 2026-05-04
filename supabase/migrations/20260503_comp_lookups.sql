-- comp_lookups: rate-limit ledger for the eBay comps edge function.
-- The function counts rows in the last hour per user_id; cap is enforced
-- in the function code (60/hr at time of writing).

create table if not exists public.comp_lookups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  looked_up_at timestamptz not null default now()
);

create index if not exists comp_lookups_user_recent_idx
  on public.comp_lookups (user_id, looked_up_at desc);

-- RLS: nobody reads or writes this table from the client. Only the service
-- role (used by the edge function) touches it.
alter table public.comp_lookups enable row level security;
