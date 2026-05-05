-- Row-level security for scanned_cards.
--
-- Why this exists: the edge function uses the service-role key and bypasses
-- RLS for its own writes, so the table previously had RLS off in dev. Once we
-- expose any client-side query/insert (which we do via supabase-js with the
-- user's anon-key+JWT), RLS is the ONLY thing stopping a malicious actor from
-- reading or modifying other users' cards.
--
-- Idempotent: safe to re-run. Drops policies before recreating them.

alter table public.scanned_cards enable row level security;

drop policy if exists "users read own cards"   on public.scanned_cards;
drop policy if exists "users insert own cards" on public.scanned_cards;
drop policy if exists "users update own cards" on public.scanned_cards;
drop policy if exists "users delete own cards" on public.scanned_cards;

create policy "users read own cards"
  on public.scanned_cards for select
  using (auth.uid() = user_id);

create policy "users insert own cards"
  on public.scanned_cards for insert
  with check (auth.uid() = user_id);

create policy "users update own cards"
  on public.scanned_cards for update
  using (auth.uid() = user_id);

create policy "users delete own cards"
  on public.scanned_cards for delete
  using (auth.uid() = user_id);

-- Storage RLS for the private card-images bucket. Path layout is
-- `{user_id}/{cardId}_{side}.jpg` — the first folder segment is the owner.

drop policy if exists "users read own card images"   on storage.objects;
drop policy if exists "users insert own card images" on storage.objects;
drop policy if exists "users update own card images" on storage.objects;
drop policy if exists "users delete own card images" on storage.objects;

create policy "users read own card images"
  on storage.objects for select
  using (
    bucket_id = 'card-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "users insert own card images"
  on storage.objects for insert
  with check (
    bucket_id = 'card-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "users update own card images"
  on storage.objects for update
  using (
    bucket_id = 'card-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "users delete own card images"
  on storage.objects for delete
  using (
    bucket_id = 'card-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
