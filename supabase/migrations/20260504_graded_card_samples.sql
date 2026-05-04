-- graded_card_samples: labeled dataset of TPG-graded cards scraped from eBay.
-- Used by the eval harness to measure how often Claude's grade prediction
-- matches the slab's actual grade. The eval target is up to 10k rows.
--
-- Population strategy (see supabase/functions/scrape-graded-cards/index.ts):
--   - Sweep eBay Browse API for "PSA 10" ... "PSA 1", "CGC 10" ... "CGC 1",
--     "BGS 10" ... "BGS 1" across multiple categories
--   - Parse grade + grader from listing title (regex)
--   - Dedupe by ebay_item_id; one row per listing
--   - Insert image URL, not the bytes — eval harness fetches at runtime
--
-- IMPORTANT: this is research / eval data, not user data. No PII.

create table if not exists public.graded_card_samples (
  id uuid primary key default gen_random_uuid(),
  ebay_item_id text not null unique,
  title text not null,
  image_url text not null,
  back_image_url text,
  grader text not null check (grader in ('PSA', 'CGC', 'BGS', 'SGC', 'TAG', 'HGA')),
  grade numeric(3,1) not null check (grade >= 1 and grade <= 10),
  category text,
  -- e.g. 'sports', 'tcg-pokemon', 'tcg-magic', 'autograph', 'vintage'
  sport text,
  year smallint,
  player text,
  set_name text,
  ebay_price numeric,
  ebay_currency text,
  ebay_url text,
  -- Slab images on eBay are typically the FRONT of the card inside the slab.
  -- For two-image listings we capture the back if eBay returns one in
  -- additionalImages — many sellers post both.
  scraped_at timestamptz not null default now()
);

-- Sweep queries pull by (grader, grade), so this is the hot index.
create index if not exists graded_card_samples_grader_grade_idx
  on public.graded_card_samples (grader, grade);

-- Eval harness usually samples randomly per (grader, grade) pair. A separate
-- index on scraped_at lets us "give me the latest 10k" without a sequential
-- scan as the table grows.
create index if not exists graded_card_samples_scraped_at_idx
  on public.graded_card_samples (scraped_at desc);

-- RLS: research data, but we lock it down anyway. Only the service role
-- (used by the scrape function and eval harness) reads/writes.
alter table public.graded_card_samples enable row level security;
