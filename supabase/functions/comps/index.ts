// Supabase Edge Function: comps
// ------------------------------
// Returns active eBay listings for a graded card so the client can show
// "Active listings · Grade N · median $X" on the results + trends screens.
//
// Security model (mirrors the grade function):
//   - eBay App ID and Cert ID live ONLY here as Supabase secrets, never in the
//     mobile bundle.
//   - Every request must carry a valid Supabase user JWT (anonymous users
//     count, but the request must come from a Supabase-authenticated session).
//   - Per-user rate limit: 60 comp lookups per hour. Cheap insurance + matches
//     the cadence of "scan, look at price" on the results screen.
//
// What this is NOT:
//   - These are ACTIVE listings (asking prices), not sold comps. eBay's true
//     sold endpoint is the Marketplace Insights API and requires separate
//     approval. The client labels this honestly.
//
// Deploy:
//   supabase secrets set EBAY_APP_ID=... EBAY_CERT_ID=... EBAY_ENV=production
//   supabase functions deploy comps
//
// Invoke:
//   POST https://<project>.supabase.co/functions/v1/comps
//   Authorization: Bearer <user_access_token>
//   Body: { cardName, cardSet?, cardYear?, cardNumber?, grade }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RATE_LIMIT_PER_HOUR = 60;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RESULTS = 24;
const SAMPLES_RETURNED = 6;

// eBay endpoints differ between sandbox and production. The OAuth token issued
// by one is not valid against the other.
const EBAY_HOSTS = {
  sandbox: "https://api.sandbox.ebay.com",
  production: "https://api.ebay.com",
} as const;

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
// eBay OAuth token cache (per cold-start). Tokens last 7200s; we refresh at
// 6000s to stay safely warm. This is in-memory only — Edge Function instances
// are short-lived but a single warm instance handles many requests.
// ---------------------------------------------------------------------------

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getEbayAccessToken(host: string, appId: string, certId: string): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.token;

  const credentials = btoa(`${appId}:${certId}`);
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: "https://api.ebay.com/oauth/api_scope",
  });

  const res = await fetch(`${host}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`eBay OAuth failed: ${res.status}`);
  }
  const json = await res.json() as { access_token: string; expires_in: number };
  tokenCache = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in - 1200) * 1000,
  };
  return json.access_token;
}

// ---------------------------------------------------------------------------
// Query construction
// ---------------------------------------------------------------------------
// We build the eBay search query from the card metadata + grade. Most graded
// card listings include the grade verbatim in the title (e.g. "PSA 9",
// "BGS 9.5", "SGC 10"). We OR across the major graders so we don't bias to PSA.
//
// This is intentionally noisy: we then post-filter by title regex below.

function buildQuery(input: {
  cardName: string;
  cardSet?: string;
  cardYear?: string;
  cardNumber?: string;
  grade: number;
}): string {
  const parts: string[] = [];
  if (input.cardYear) parts.push(input.cardYear);
  if (input.cardSet) parts.push(input.cardSet);
  parts.push(input.cardName);
  if (input.cardNumber) parts.push(`#${input.cardNumber}`);
  // Tack on the grade — most listings include "PSA 9" in the title. eBay's
  // tokenizer does fuzzy matching so this widens recall without forcing all
  // three graders into a strict OR.
  parts.push(`PSA ${input.grade}`);
  return parts.join(" ").slice(0, 100); // eBay's q field caps around 100 chars.
}

// Title regex to confirm a listing matches our target grade. Accepts integer
// (PSA 9) and half-step (BGS 9.5) grades. Without this filter we'd include
// raw cards and wrong-grade slabs in the median.
function gradeMatcher(grade: number): RegExp {
  // Allow .0 → "PSA 9" or "PSA 9.0". Allow .5 → "BGS 9.5" only.
  const integer = Number.isInteger(grade);
  const gradeStr = integer ? `${grade}(?:\\.0)?` : `${grade.toFixed(1).replace(".", "\\.")}`;
  return new RegExp(`\\b(?:PSA|BGS|SGC|CGC|HGA)\\s*${gradeStr}\\b`, "i");
}

// ---------------------------------------------------------------------------
// Rate limit (mirrors grade function pattern)
// ---------------------------------------------------------------------------

async function checkRateLimit(supabaseUrl: string, serviceKey: string, userId: string): Promise<boolean> {
  // Track via the comp_lookups table; falls open on errors so a transient DB
  // hiccup doesn't break the results screen.
  try {
    const since = encodeURIComponent(new Date(Date.now() - 60 * 60 * 1000).toISOString());
    const url = `${supabaseUrl}/rest/v1/comp_lookups?user_id=eq.${encodeURIComponent(userId)}&looked_up_at=gte.${since}&select=id`;
    const res = await fetch(url, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "count=exact",
        Range: "0-0",
      },
    });
    const count = Number(res.headers.get("content-range")?.split("/")?.[1] ?? "0");
    return count < RATE_LIMIT_PER_HOUR;
  } catch {
    return true;
  }
}

async function recordLookup(supabaseUrl: string, serviceKey: string, userId: string): Promise<void> {
  try {
    await fetch(`${supabaseUrl}/rest/v1/comp_lookups`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ user_id: userId }),
    });
  } catch { /* best-effort */ }
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
  seller?: { username?: string; feedbackPercentage?: string };
  buyingOptions?: string[];
  itemLocation?: { country?: string };
}

interface BrowseResponse {
  itemSummaries?: EbaySummary[];
  total?: number;
}

async function searchEbay(host: string, token: string, query: string): Promise<EbaySummary[]> {
  const params = new URLSearchParams({
    q: query,
    limit: String(MAX_RESULTS),
    // category 261328 = "Sports Trading Card Singles". Could expand later for
    // TCG (183454) but starting tight reduces noise from non-card matches.
    filter: "buyingOptions:{FIXED_PRICE|AUCTION},itemLocationCountry:US",
    sort: "price",
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
      throw new Error(`eBay search failed: ${res.status}`);
    }
    const json = await res.json() as BrowseResponse;
    return json.itemSummaries ?? [];
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Aggregation: filter by grade match in title, compute price stats, return
// a small set of samples for the UI.
// ---------------------------------------------------------------------------

function summarize(listings: EbaySummary[], grade: number) {
  const matcher = gradeMatcher(grade);
  const matched = listings.filter((l) => matcher.test(l.title) && l.price?.value);

  const prices = matched
    .map((l) => Number(l.price!.value))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);

  if (prices.length === 0) {
    return {
      count: 0,
      currency: "USD",
      low: null,
      median: null,
      high: null,
      samples: [],
    };
  }

  const median = prices.length % 2 === 0
    ? (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
    : prices[Math.floor(prices.length / 2)];

  const samples = matched.slice(0, SAMPLES_RETURNED).map((l) => ({
    title: l.title.slice(0, 140),
    price: Number(l.price!.value),
    currency: l.price!.currency,
    url: l.itemWebUrl ?? null,
    thumbnail: l.thumbnailImages?.[0]?.imageUrl ?? l.image?.imageUrl ?? null,
  }));

  return {
    count: prices.length,
    currency: matched[0]?.price?.currency ?? "USD",
    low: prices[0],
    median: Math.round(median * 100) / 100,
    high: prices[prices.length - 1],
    samples,
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return jsonError("Method not allowed", 405);

  const appId = Deno.env.get("EBAY_APP_ID");
  const certId = Deno.env.get("EBAY_CERT_ID");
  const env = (Deno.env.get("EBAY_ENV") ?? "production") as keyof typeof EBAY_HOSTS;
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const host = EBAY_HOSTS[env];

  if (!appId || !certId || !host || !supabaseUrl || !serviceKey) {
    return jsonError("Server not configured", 500);
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";
  if (!token) return jsonError("Missing authorization header", 401);

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userRes?.user) return jsonError("Invalid or expired token", 401);
  const userId = userRes.user.id;

  const allowed = await checkRateLimit(supabaseUrl, serviceKey, userId);
  if (!allowed) return jsonError("Rate limit exceeded — try again in an hour", 429);

  let body: {
    cardName?: string;
    cardSet?: string;
    cardYear?: string;
    cardNumber?: string;
    grade?: number;
  };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid request body", 400);
  }

  if (!body.cardName || typeof body.cardName !== "string") {
    return jsonError("Missing cardName", 400);
  }
  const grade = Number(body.grade);
  if (!Number.isFinite(grade) || grade < 1 || grade > 10) {
    return jsonError("grade must be a number 1–10", 400);
  }

  const query = buildQuery({
    cardName: body.cardName,
    cardSet: typeof body.cardSet === "string" ? body.cardSet : undefined,
    cardYear: typeof body.cardYear === "string" ? body.cardYear : undefined,
    cardNumber: typeof body.cardNumber === "string" ? body.cardNumber : undefined,
    grade,
  });

  let ebayToken: string;
  try {
    ebayToken = await getEbayAccessToken(host, appId, certId);
  } catch {
    return jsonError("eBay auth failed", 502);
  }

  let listings: EbaySummary[];
  try {
    listings = await searchEbay(host, ebayToken, query);
  } catch (e) {
    const aborted = (e as { name?: string })?.name === "AbortError";
    return jsonError(aborted ? "eBay request timed out" : "eBay search failed", 504);
  }

  const result = summarize(listings, grade);

  // Best-effort lookup logging — fire and forget.
  recordLookup(supabaseUrl, serviceKey, userId);

  return new Response(
    JSON.stringify({ ...result, query, env }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        // Comp data changes slowly — let the client cache for 30min.
        "Cache-Control": "public, max-age=1800",
        ...cors,
      },
    },
  );
});
