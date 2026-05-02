# Security & Deployment

## Architecture

The Anthropic API key **never** ships to clients. All grading requests go:

```
iOS/Android/web client
    │  POST /functions/v1/grade
    │  Authorization: Bearer <user JWT>
    ▼
Supabase Edge Function (supabase/functions/grade/)
    │  validates JWT, applies rate limit
    │  forwards to Anthropic with server-side key
    ▼
Anthropic Claude API
```

The key lives only as a Supabase Function secret on the server.

## What lives where

| Value | Location | Safe to ship to client? |
|---|---|---|
| `ANTHROPIC_API_KEY` | Supabase Function secret | NO — server only |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Function secret (auto-injected) | NO — server only |
| `EXPO_PUBLIC_SUPABASE_URL` | `.env.local`, bundled into app | yes |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `.env.local`, bundled into app | yes — anon key is public by design, RLS protects data |

## First-time deploy

Prereqs: Supabase CLI (`brew install supabase/tap/supabase`) and a project.

```bash
# 1. Link the local repo to your Supabase project
supabase link --project-ref bkpuudfomoabbdbngxcs

# 2. Set the Anthropic key as a secret (server-only)
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

# 3. Deploy the grade function
supabase functions deploy grade
```

After deploy, the function is reachable at:
`https://bkpuudfomoabbdbngxcs.supabase.co/functions/v1/grade`

The mobile app already calls this URL via `src/lib/grading-engine.ts`.

## Rotate the leaked key (do this now)

Build 40 shipped to TestFlight with `EXPO_PUBLIC_ANTHROPIC_API_KEY` bundled in
the IPA. Anyone who decompiles a copy of build 40 can extract that key.

1. Open <https://console.anthropic.com/settings/keys> and **revoke** the old key
2. Create a new key
3. `supabase secrets set ANTHROPIC_API_KEY=<new key>`
4. Submit a new build (41+) — old binary is now harmless because it points at a
   key that's been revoked

## Required Supabase migration (v2 grading schema)

The richer GradeResult schema (`psa10Likelihood`, `bucket`, `photoQuality`, structured
sub-grade details, hard-pass gate) wants these new columns on `scanned_cards`.
The client retries without them if they don't exist, so the app keeps working
on the old schema — but you'll lose the new fields.

```sql
alter table scanned_cards
  add column if not exists psa10_likelihood   real,
  add column if not exists photo_quality      text,
  add column if not exists hard_pass_gate     jsonb,
  add column if not exists disqualifying_flaws text[],
  add column if not exists obscured_regions   text[],
  add column if not exists tcg_image_url      text;

-- Optional: tables for streak / challenge / leaderboard features.
-- The home/streak/trends screens render gracefully without these, but adding
-- them lets the streak pill, daily challenge progress, and friends leaderboard
-- show real numbers.

create table if not exists user_streaks (
  user_id uuid primary key references auth.users on delete cascade,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_scan_date date,
  freeze_days_remaining int not null default 0
);

create table if not exists daily_challenges (
  user_id uuid references auth.users on delete cascade,
  challenge_date date,
  scans_completed int not null default 0,
  xp_awarded int not null default 0,
  primary key (user_id, challenge_date)
);

create table if not exists friendships (
  user_a uuid references auth.users on delete cascade,
  user_b uuid references auth.users on delete cascade,
  status text check (status in ('pending','accepted')) default 'pending',
  created_at timestamptz default now(),
  primary key (user_a, user_b)
);
```

## Required Supabase RLS policies

The edge function uses the service-role key to bypass RLS for its own writes.
Client-side code uses the anon key + user JWT. Confirm these policies on
`scanned_cards`:

```sql
-- Users can only read their own cards
create policy "users read own cards" on scanned_cards
  for select using (auth.uid() = user_id);

-- Users can only insert as themselves
create policy "users insert own cards" on scanned_cards
  for insert with check (auth.uid() = user_id);

-- Users can only update their own cards
create policy "users update own cards" on scanned_cards
  for update using (auth.uid() = user_id);

-- Users can only delete their own cards
create policy "users delete own cards" on scanned_cards
  for delete using (auth.uid() = user_id);
```

## Account deletion (Apple Guideline 5.1.1(v))

Settings → Delete Account calls `supabase.rpc("delete_user_account")`. That RPC
must:

1. Delete the user's `scanned_cards` rows
2. Delete the user's storage objects from `card-images/{user_id}/...`
3. Delete the user's `profiles` row
4. Call `auth.admin.deleteUser(user_id)` to remove the auth row
5. **Revoke Sign-in-with-Apple tokens** via Apple's `/auth/revoke` endpoint
   (Apple specifically requires this for SIWA users — failure = 5.1.1(v) reject)

Sample RPC:

```sql
create or replace function delete_user_account()
returns void
language plpgsql
security definer
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  delete from scanned_cards where user_id = uid;
  delete from profiles where id = uid;
  -- storage objects: delete via REST from a separate edge function, or
  -- use storage.objects table directly
  delete from storage.objects where bucket_id = 'card-images' and (storage.foldername(name))[1] = uid::text;
  perform auth.admin.delete_user(uid);
end;
$$;
```

The SIWA token revocation step requires a second edge function (Postgres can't
make outbound HTTPS calls); do it from a `delete-account` edge function that
calls Apple's revoke endpoint with your team key, then triggers the RPC above.

## Rate limiting

The edge function caps at 30 grades / hour / user. Tune `RATE_LIMIT_PER_HOUR`
in `supabase/functions/grade/index.ts`.

## Never commit

- `.env` (kept empty, gitignored)
- `.env.local` (gitignored, only contains EXPO_PUBLIC_* values)
- Any `*.p8`, `*.p12`, `*.key`, `*.mobileprovision` (already gitignored)
- AppleID-issued team keys for SIWA revocation
