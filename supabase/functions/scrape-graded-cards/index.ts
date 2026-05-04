// Supabase Edge Function: scrape-graded-cards
// ---------------------------------------------
// Sweeps eBay's Browse API for slabbed (TPG-graded) cards and persists them
// into public.graded_card_samples for use by the eval harness. One pass aims
// to populate up to ~10k rows across all (grader × grade) pairs.
//
// Why a function and not a one-off script: the eBay credentials live as
// Supabase secrets here (same as the comps function). Keeping the scraper
// inside Supabase means we don't hand the prod Cert ID to a local script.
//
// Trigger model:
//   - Manually invoke with a service-role key (or a local supabase functions
//     invoke) — this is NOT a user-facing endpoint. Auth is service-role only.
//   - Idempotent: dedupes on (ebay_item_id) via on conflict do nothing.
//
// Deploy:
//   supabase secrets set EBAY_APP_ID=... EBAY_CERT_ID=... EBAY_ENV=production
//   supabase functions deploy scrape-graded-cards --no-verify-jwt
//
// Invoke (one-off, server-side):
//   curl -X POST https://<project>.supabase.co/functions/v1/scrape-graded-cards \
//        -H "Authorization: Bearer <service_role_key>" \
//        -H "Content-Type: application/json" \
//        -d '{ "targetTotal": 10000 }'

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REQUEST_TIMEOUT_MS = 15_000;
const PAGE_LIMIT = 200; // max eBay Browse API allows per request
const PER_QUERY_CAP = 600; // pages 0..2 per (grader, grade)
const DEFAULT_TARGET = 10_000;

const EBAY_HOSTS = {
  sandbox: "https://api.sandbox.ebay.com",
  production: "https://api.ebay.com",
} as const;

// Categories we sweep. Keeping it tight reduces noise from non-card matches.
//   261328 = Sports Trading Card Singles
//   183454 = CCG Individual Cards (TCG: Pokémon, Magic, Yu-Gi-Oh, etc.)
const CATEGORIES = ["261328", "183454"];

const GRADERS = ["PSA", "CGC", "BGS", "SGC"] as const;
type Grader = typeof GRADERS[number];

// Grades to sweep, per grader. PSA + SGC are integer; CGC + BGS use 0.5
// increments. We restrict to the published valid steps to keep search
// queries clean.
const PSA_GRADES = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
const CGC_GRADES = [10, 9.5, 9, 8.5, 8, 7, 6, 5, 4, 3, 2, 1];
const BGS_GRADES = [10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6, 5, 4, 3, 2, 1];
const SGC_GRADES = [10, 9.5, 9, 8.5, 8, 7, 6, 5, 4, 3, 2, 1];

function gradesFor(g: Grader): number[] {
  switch (g) {
    case "PSA": return PSA_GRADES;
    case "CGC": return CGC_GRADES;
    case "BGS": return BGS_GRADES;
    case "SGC": return SGC_GRADES;
  }
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

// ---------------------------------------------------------------------------
// eBay OAuth (mirrors comps function — refresh ~20min before token expiry).
// ---------------------------------------------------------------------------

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getEbayToken(host: string, appId: string, certId: string): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.token;
  const credentials = btoa(`${appId}:${certId}`);
  const res = await fetch(`${host}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    }),
  });
  if (!res.ok) throw new Error(`eBay OAuth failed: ${res.status}`);
  const json = await res.json() as { access_token: string; expires_in: number };
  tokenCache = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in - 1200) * 1000,
  };
  return json.access_token;
}

// ---------------------------------------------------------------------------
// Title parsing: pull (grader, grade) out of the listing title. eBay sellers
// are remarkably consistent — "PSA 10", "BGS 9.5", "CGC 8" etc.
// ---------------------------------------------------------------------------

const TITLE_GRADE_RE =
  /\b(PSA|CGC|BGS|SGC|TAG|HGA)\s*(?:GEM\s*MT?\s*|MINT\s*|MT\s*)?(\d{1,2}(?:\.5)?)\b/i;

function parseGraderAndGrade(title: string): { grader: Grader | "TAG" | "HGA"; grade: number } | null {
  const m = TITLE_GRADE_RE.exec(title);
  if (!m) return null;
  const grader = m[1].toUpperCase() as Grader | "TAG" | "HGA";
  const grade = Number(m[2]);
  if (!Number.isFinite(grade) || grade < 1 || grade > 10) return null;
  return { grader, grade };
}

// Year heuristic: take the first 4-digit number that looks like a card year.
function parseYear(title: string): number | null {
  const m = title.match(/\b(19[5-9]\d|20[0-3]\d)\b/);
  if (!m) return null;
  const y = Number(m[1]);
  return y >= 1950 && y <= 2030 ? y : null;
}

// ---------------------------------------------------------------------------
// eBay Browse API: itemSummary search
// ---------------------------------------------------------------------------

interface EbaySummary {
  itemId: string;
  title: string;
  price?: { value: string; currency: string };
  itemWebUrl?: string;
  image?: { imageUrl: string };
  thumbnailImages?: { imageUrl: string }[];
  additionalImages?: { imageUrl: string }[];
  categoryPath?: string;
}

interface BrowseResponse {
  itemSummaries?: EbaySummary[];
  total?: number;
}

async function searchPage(
  host: string,
  token: string,
  query: string,
  category: string,
  offset: number,
): Promise<EbaySummary[]> {
  const params = new URLSearchParams({
    q: query,
    category_ids: category,
    limit: String(PAGE_LIMIT),
    offset: String(offset),
    filter: "buyingOptions:{FIXED_PRICE|AUCTION},itemLocationCountry:US",
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${host}/buy/browse/v1/item_summary/search?${params}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      // Soft-fail individual pages so one bad page doesn't kill the sweep.
      console.warn(`eBay search ${res.status} for q=${query} cat=${category} off=${offset}`);
      return [];
    }
    const json = await res.json() as BrowseResponse;
    return json.itemSummaries ?? [];
  } catch (e) {
    console.warn("eBay search error:", e);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Sweep: for each (grader × grade × category), pull up to PER_QUERY_CAP
// listings and dedupe into a Set.
// ---------------------------------------------------------------------------

type Sample = {
  ebay_item_id: string;
  title: string;
  image_url: string;
  back_image_url: string | null;
  grader: string;
  grade: number;
  category: string;
  year: number | null;
  ebay_price: number | null;
  ebay_currency: string | null;
  ebay_url: string | null;
};

function categoryLabel(categoryId: string): string {
  if (categoryId === "261328") return "sports";
  if (categoryId === "183454") return "tcg";
  return "other";
}

async function sweep(
  host: string,
  token: string,
  targetTotal: number,
  onSample: (s: Sample) => Promise<void>,
): Promise<{ scanned: number; kept: number; perGrader: Record<string, number>; perGrade: Record<string, number> }> {
  let scanned = 0;
  let kept = 0;
  const perGrader: Record<string, number> = {};
  const perGrade: Record<string, number> = {};
  const seen = new Set<string>();

  outer: for (const grader of GRADERS) {
    for (const grade of gradesFor(grader)) {
      for (const cat of CATEGORIES) {
        const queries = [
          `${grader} ${grade}`,
          `${grader} ${grade} GEM MINT`,
        ];
        for (const q of queries) {
          for (let offset = 0; offset < PER_QUERY_CAP; offset += PAGE_LIMIT) {
            if (kept >= targetTotal) break outer;
            const items = await searchPage(host, token, q, cat, offset);
            scanned += items.length;
            for (const it of items) {
              if (seen.has(it.itemId)) continue;
              seen.add(it.itemId);
              const parsed = parseGraderAndGrade(it.title);
              if (!parsed) continue;
              // Title must agree with the query — the query "PSA 10" can match
              // "PSA 10 lot of cards" listings that contain other grades. We
              // require exact (grader, grade) parsed from the title.
              if (parsed.grader !== grader) continue;
              if (parsed.grade !== grade) continue;
              const imageUrl = it.image?.imageUrl ?? it.thumbnailImages?.[0]?.imageUrl;
              if (!imageUrl) continue;
              const back = it.additionalImages?.[1]?.imageUrl ?? null;
              const sample: Sample = {
                ebay_item_id: it.itemId,
                title: it.title.slice(0, 500),
                image_url: imageUrl,
                back_image_url: back,
                grader,
                grade,
                category: categoryLabel(cat),
                year: parseYear(it.title),
                ebay_price: it.price ? Number(it.price.value) : null,
                ebay_currency: it.price?.currency ?? null,
                ebay_url: it.itemWebUrl ?? null,
              };
              await onSample(sample);
              kept += 1;
              perGrader[grader] = (perGrader[grader] ?? 0) + 1;
              perGrade[`${grader} ${grade}`] = (perGrade[`${grader} ${grade}`] ?? 0) + 1;
              if (kept >= targetTotal) break outer;
            }
            if (items.length < PAGE_LIMIT) break; // exhausted this query/cat
          }
        }
      }
    }
  }

  return { scanned, kept, perGrader, perGrade };
}

// ---------------------------------------------------------------------------
// Insert into Supabase. We batch in groups of 200 to keep request bodies
// reasonable. on conflict do nothing on (ebay_item_id) so re-runs are
// idempotent.
// ---------------------------------------------------------------------------

const BATCH_SIZE = 200;

function makeBatcher(supabaseUrl: string, serviceKey: string) {
  let buffer: Sample[] = [];
  async function flush() {
    if (buffer.length === 0) return;
    const payload = buffer;
    buffer = [];
    const res = await fetch(
      `${supabaseUrl}/rest/v1/graded_card_samples?on_conflict=ebay_item_id`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Prefer: "resolution=ignore-duplicates,return=minimal",
        },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      console.warn("graded_card_samples insert failed:", res.status, body.slice(0, 500));
    }
  }
  return {
    async push(s: Sample) {
      buffer.push(s);
      if (buffer.length >= BATCH_SIZE) await flush();
    },
    flush,
  };
}

// ---------------------------------------------------------------------------
// Entrypoint: service-role only.
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return jsonError("Method not allowed", 405);

  const appId = Deno.env.get("EBAY_APP_ID");
  const certId = Deno.env.get("EBAY_CERT_ID");
  const env = (Deno.env.get("EBAY_ENV") ?? "production") as keyof typeof EBAY_HOSTS;
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!appId || !certId || !supabaseUrl || !serviceKey) {
    return jsonError("Server not configured", 500);
  }

  // Service-role auth: this endpoint is admin-only.
  const authHeader = req.headers.get("authorization") ?? "";
  const provided = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";
  if (provided !== serviceKey) {
    return jsonError("Forbidden", 403);
  }

  let targetTotal = DEFAULT_TARGET;
  try {
    const body = await req.json();
    if (typeof body?.targetTotal === "number" && body.targetTotal > 0) {
      targetTotal = Math.min(50_000, Math.floor(body.targetTotal));
    }
  } catch { /* empty body is fine */ }

  const host = EBAY_HOSTS[env] ?? EBAY_HOSTS.production;

  let token: string;
  try {
    token = await getEbayToken(host, appId, certId);
  } catch (e) {
    console.error("eBay OAuth error:", e);
    return jsonError("eBay auth failed", 502);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Confirm the table exists (cheap pre-flight) so we fail fast with a
  // useful error if the migration wasn't run.
  const { error: tableErr } = await supabase
    .from("graded_card_samples")
    .select("id", { head: true, count: "exact" })
    .limit(1);
  if (tableErr) {
    return jsonError(`graded_card_samples table missing: ${tableErr.message}`, 500);
  }

  const batcher = makeBatcher(supabaseUrl, serviceKey);
  const startedAt = Date.now();
  let summary;
  try {
    summary = await sweep(host, token, targetTotal, async (s) => {
      await batcher.push(s);
    });
    await batcher.flush();
  } catch (e) {
    console.error("sweep error:", e);
    return jsonError("Sweep failed", 502);
  }

  return new Response(JSON.stringify({
    targetTotal,
    elapsedMs: Date.now() - startedAt,
    ...summary,
  }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...cors },
  });
});
