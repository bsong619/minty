import { supabase } from "./supabase";

// Talks to the Supabase Edge Function at /functions/v1/comps. The eBay
// credentials live ONLY there — never bundled into the app. See
// supabase/functions/comps/index.ts for the server side.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const COMPS_ENDPOINT = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/comps` : "";

export interface CompSample {
  title: string;
  price: number;
  currency: string;
  url: string | null;
  thumbnail: string | null;
}

export interface CompsResult {
  count: number;
  currency: string;
  low: number | null;
  median: number | null;
  high: number | null;
  samples: CompSample[];
}

export interface CompsInput {
  cardName: string;
  cardSet?: string;
  cardYear?: string;
  cardNumber?: string;
  grade: number;
}

// In-memory cache. eBay listings change slowly; a 30-min TTL matches the
// edge function's Cache-Control hint and keeps the trends screen snappy.
const TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, { at: number; value: CompsResult }>();

function cacheKey(input: CompsInput): string {
  return [
    input.cardName.toLowerCase().trim(),
    (input.cardSet ?? "").toLowerCase().trim(),
    input.cardYear ?? "",
    input.cardNumber ?? "",
    input.grade,
  ].join("|");
}

export async function fetchComps(input: CompsInput): Promise<CompsResult> {
  if (!COMPS_ENDPOINT || !supabase) {
    throw new Error("Comps service not configured");
  }

  const key = cacheKey(input);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) throw new Error("Please sign in");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let res: Response;
  try {
    res = await fetch(COMPS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error("Comps request timed out");
    throw e;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    if (res.status === 429) throw new Error("Comp lookup rate limit reached");
    throw new Error("Couldn't load comps");
  }

  const value = (await res.json()) as CompsResult;
  cache.set(key, { at: Date.now(), value });
  return value;
}

export function formatCompPrice(n: number | null, currency = "USD"): string {
  if (n == null) return "—";
  const fmt = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: n >= 100 ? 0 : 2,
  });
  return fmt.format(n);
}
