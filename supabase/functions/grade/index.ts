// Supabase Edge Function: grade
// ------------------------------
// Proxies a card grading request to the Anthropic Claude API.
//
// Security model:
//   - The Anthropic key lives ONLY here, as a Supabase secret (ANTHROPIC_API_KEY).
//     It is never bundled into the mobile app.
//   - Every request must include a valid Supabase user JWT in the Authorization
//     header. Anonymous users are allowed (Supabase issues anon JWTs), but the
//     request must still come from a Supabase-authenticated session.
//   - Per-user rate limit: 30 grades per hour (cheap insurance against runaway
//     bills if a key ever leaks again).
//
// Deploy:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase functions deploy grade --no-verify-jwt=false
//
// Invoke from client:
//   POST https://<project>.supabase.co/functions/v1/grade
//   Authorization: Bearer <user_access_token>
//   Body: { imageBase64, mimeType?, backImageBase64? }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decideRetake, predictAllGraders } from "../_shared/grader-predictions.ts";
import { SYSTEM_PROMPT, USER_PROMPT } from "./prompt.ts";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 2048;
const REQUEST_TIMEOUT_MS = 30_000;
const RATE_LIMIT_PER_HOUR = 30;

// Prompt is loaded from prompt.md via prompt.ts so the eval harness at
// scripts/eval_grader.py can read the same source. Single source of truth —
// edit prompt.md and redeploy with `supabase functions deploy grade`.

// ---------------------------------------------------------------------------
// Validation constants & helpers
// ---------------------------------------------------------------------------

const VALID_BUCKETS = [
  "Lock 10",
  "Strong 10 candidate",
  "Coin-flip 9/10",
  "Likely 9",
  "Below 9",
] as const;
type Bucket = typeof VALID_BUCKETS[number];

const VALID_QUALITY = ["High", "Medium", "Low"] as const;
type Quality = typeof VALID_QUALITY[number];

const VALID_GATE_VALUES = ["PASS", "FAIL", "CANNOT_ASSESS", "NOT_PROVIDED"] as const;
const VALID_GATE_KEYS = [
  "frontCentering",
  "backCentering",
  "frontCorners",
  "backCorners",
  "frontEdges",
  "backEdges",
  "frontSurface",
  "backSurface",
  "printQuality",
] as const;

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

function toSafeScore(v: unknown, fallback = 5): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(10, Math.max(1, Math.round(n * 2) / 2)) : fallback;
}

function pickEnum<T extends readonly string[]>(
  raw: unknown,
  allowed: T,
  fallback: T[number],
): T[number] {
  return typeof raw === "string" && (allowed as readonly string[]).includes(raw)
    ? (raw as T[number])
    : fallback;
}

function clampLikelihood(raw: unknown): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  // Accept 0–1 floats or 0–100 ints; normalize to [0, 1].
  const normalized = n > 1 ? n / 100 : n;
  return Math.min(1, Math.max(0, normalized));
}

// Single source of truth for likelihood → bucket mapping. Used both to derive
// when the model omits/breaks the bucket field AND to override an obviously
// inconsistent bucket (e.g. likelihood 0.30 but model said "Lock 10").
function bucketFromLikelihood(p: number | null, grade: number): Bucket {
  if (p !== null) {
    if (p >= 0.85) return "Lock 10";
    if (p >= 0.65) return "Strong 10 candidate";
    if (p >= 0.40) return "Coin-flip 9/10";
    if (p >= 0.20) return "Likely 9";
    return "Below 9";
  }
  if (grade >= 10) return "Strong 10 candidate";
  if (grade === 9) return "Likely 9";
  return "Below 9";
}

function sanitizeStringField(raw: unknown, maxLen = 200): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed.slice(0, maxLen);
}

function sanitizeDetail<K extends string>(
  raw: unknown,
  allowedKeys: readonly K[],
): Partial<Record<K, string>> {
  if (!raw || typeof raw !== "object") return {};
  const out: Partial<Record<K, string>> = {};
  for (const key of allowedKeys) {
    const v = sanitizeStringField((raw as Record<string, unknown>)[key]);
    if (v) out[key] = v;
  }
  return out;
}

function sanitizeCenteringDetail(raw: unknown): {
  leftRight: string;
  topBottom: string;
  passesThreshold: boolean;
  backLeftRight?: string;
  backTopBottom?: string;
} {
  const obj = (raw && typeof raw === "object") ? (raw as Record<string, unknown>) : {};
  const out: {
    leftRight: string;
    topBottom: string;
    passesThreshold: boolean;
    backLeftRight?: string;
    backTopBottom?: string;
  } = {
    leftRight: sanitizeStringField(obj.leftRight) ?? "N/A",
    topBottom: sanitizeStringField(obj.topBottom) ?? "N/A",
    passesThreshold: obj.passesThreshold === true,
  };
  const blr = sanitizeStringField(obj.backLeftRight);
  const btb = sanitizeStringField(obj.backTopBottom);
  if (blr) out.backLeftRight = blr;
  if (btb) out.backTopBottom = btb;
  return out;
}

function sanitizeGate(raw: unknown): Partial<Record<typeof VALID_GATE_KEYS[number], typeof VALID_GATE_VALUES[number]>> {
  if (!raw || typeof raw !== "object") return {};
  const out: Partial<Record<typeof VALID_GATE_KEYS[number], typeof VALID_GATE_VALUES[number]>> = {};
  for (const key of VALID_GATE_KEYS) {
    const v = (raw as Record<string, unknown>)[key];
    if (typeof v === "string" && (VALID_GATE_VALUES as readonly string[]).includes(v)) {
      out[key] = v as typeof VALID_GATE_VALUES[number];
    }
  }
  return out;
}

function sanitizeStringArray(raw: unknown, maxItems: number, maxLen = 200): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    const s = sanitizeStringField(item, maxLen);
    if (s) out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
}

async function checkRateLimit(supabaseUrl: string, serviceKey: string, userId: string): Promise<boolean> {
  // Lightweight rate limit using a Postgres count of recent scans.
  // Falls open (allows the request) on errors so a transient DB issue doesn't break grading.
  try {
    const since = encodeURIComponent(new Date(Date.now() - 60 * 60 * 1000).toISOString());
    const url = `${supabaseUrl}/rest/v1/scanned_cards?user_id=eq.${encodeURIComponent(userId)}&scanned_at=gte.${since}&select=id`;
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return jsonError("Method not allowed", 405);

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!anthropicKey || !supabaseUrl || !serviceKey) {
    return jsonError("Server not configured", 500);
  }

  // ---- Auth: require a Supabase user (anonymous users count) ----
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";
  if (!token) return jsonError("Missing authorization header", 401);

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userRes?.user) return jsonError("Invalid or expired token", 401);
  const userId = userRes.user.id;

  // ---- Rate limit ----
  const allowed = await checkRateLimit(supabaseUrl, serviceKey, userId);
  if (!allowed) {
    return jsonError("Rate limit exceeded — try again in an hour", 429);
  }

  // ---- Parse body ----
  let imageBase64: string;
  let mimeType: string;
  let backImageBase64: string | undefined;
  try {
    const body = await req.json();
    imageBase64 = body.imageBase64;
    mimeType = body.mimeType ?? "image/jpeg";
    backImageBase64 = body.backImageBase64;
  } catch {
    return jsonError("Invalid request body", 400);
  }
  if (!imageBase64 || typeof imageBase64 !== "string") {
    return jsonError("Missing imageBase64", 400);
  }
  // 8 MB cap on a single base64 payload — safety, not correctness.
  if (imageBase64.length > 8 * 1024 * 1024) {
    return jsonError("Image too large", 413);
  }
  if (backImageBase64 && typeof backImageBase64 === "string" && backImageBase64.length > 8 * 1024 * 1024) {
    return jsonError("Back image too large", 413);
  }

  // ---- Call Anthropic ----
  // Image-first ordering per Anthropic vision best practices. Image 1 = front,
  // image 2 = back (if provided), then the per-call task prompt.
  const contentParts: unknown[] = [
    { type: "text", text: "Image 1 (FRONT):" },
    { type: "image", source: { type: "base64", media_type: mimeType, data: imageBase64 } },
  ];
  if (backImageBase64) {
    contentParts.push({ type: "text", text: "Image 2 (BACK):" });
    contentParts.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: backImageBase64 } });
  }
  contentParts.push({ type: "text", text: USER_PROMPT });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let anthropicRes: Response;
  try {
    anthropicRes = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: [
          // cache_control on the static rubric — Anthropic returns cache_read_input_tokens
          // for prompts within ~5min of the last call, cutting cost ~10x on warm hits.
          { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
        ],
        messages: [{ role: "user", content: contentParts }],
      }),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeout);
    const aborted = (e as { name?: string })?.name === "AbortError";
    return jsonError(aborted ? "Grading timed out" : "Anthropic request failed", 504);
  } finally {
    clearTimeout(timeout);
  }

  if (!anthropicRes.ok) {
    // Don't surface raw Anthropic errors to the client.
    return jsonError("Grading service error", anthropicRes.status === 401 ? 500 : 502);
  }

  const data = await anthropicRes.json();
  const content = typeof data.content?.[0]?.text === "string" ? data.content[0].text : "";
  const clean = content.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();

  let result: Record<string, unknown>;
  try {
    result = JSON.parse(clean);
  } catch {
    return jsonError("Failed to parse AI response", 502);
  }

  // ---- Validate + sanitize every field on the way out ----
  const subGradesRaw = (result.subGrades ?? {}) as Record<string, unknown>;
  const subGrades = {
    centering: toSafeScore(subGradesRaw.centering),
    corners: toSafeScore(subGradesRaw.corners),
    edges: toSafeScore(subGradesRaw.edges),
    surface: toSafeScore(subGradesRaw.surface),
  };

  // Overall grade: trust the model if it's in [1,10], otherwise derive from
  // floor(min(subGrades)). PSA's aggregation rule, not BGS averaging.
  const minSub = Math.floor(Math.min(subGrades.centering, subGrades.corners, subGrades.edges, subGrades.surface));
  const modelGrade = Number(result.overallGrade);
  const overallGrade = Number.isFinite(modelGrade)
    ? Math.min(10, Math.max(1, Math.round(modelGrade)))
    : minSub;

  const psa10Likelihood = clampLikelihood(result.psa10Likelihood);

  // Bucket: derive from likelihood per the spec. Only honor the model's bucket
  // if it matches the threshold its own likelihood implies — otherwise the
  // likelihood wins. This catches "Lock 10" + likelihood 0.4 inconsistencies.
  const derivedBucket = bucketFromLikelihood(psa10Likelihood, overallGrade);
  const modelBucket = pickEnum(result.bucket, VALID_BUCKETS, derivedBucket);
  const bucket: Bucket = (psa10Likelihood !== null && modelBucket !== derivedBucket)
    ? derivedBucket
    : modelBucket;

  const photoQuality: Quality = pickEnum(result.photoQuality, VALID_QUALITY, "Medium");
  const confidence: Quality = pickEnum(result.confidence, VALID_QUALITY, "Medium");

  const cornersDetail = sanitizeDetail(result.cornersDetail, [
    "topLeft", "topRight", "bottomLeft", "bottomRight", "notes",
  ] as const);
  const edgesDetail = sanitizeDetail(result.edgesDetail, [
    "top", "right", "bottom", "left", "notes",
  ] as const);
  const surfaceDetail = sanitizeDetail(result.surfaceDetail, [
    "scratches", "holoScratches", "printLines", "indentations", "staining", "notes",
  ] as const);

  const centeringDetail = sanitizeCenteringDetail(result.centeringDetail);
  const hardPassGate = sanitizeGate(result.hardPassGate);
  const disqualifyingFlaws = sanitizeStringArray(result.disqualifyingFlaws, 10);
  const obscuredRegions = sanitizeStringArray(result.obscuredRegions, 10);

  // Per-TPG predictions and retake decision are derived deterministically
  // from the sub-grades / quality signals — see _shared/grader-predictions.ts
  // for the rationale on why this lives in code, not the prompt.
  const perGraderPredictions = predictAllGraders(subGrades, {
    obscuredRegions: obscuredRegions.length,
    confidence,
  });
  const { needsRetake, retakeReasons } = decideRetake({
    photoQuality,
    obscuredRegions,
    centeringDetail,
    hardPassGate,
  });

  const safeResult = {
    overallGrade,
    psa10Likelihood,
    bucket,
    photoQuality,
    confidence,
    needsRetake,
    retakeReasons,
    subGrades,
    centeringDetail,
    cornersDetail,
    edgesDetail,
    surfaceDetail,
    hardPassGate,
    disqualifyingFlaws,
    obscuredRegions,
    perGraderPredictions,
    tips: sanitizeStringArray(result.tips, 3, 600),
    cardName: sanitizeStringField(result.cardName, 120) ?? "Unknown Card",
    pokemonName: sanitizeStringField(result.pokemonName, 60) ?? null,
    cardSet: sanitizeStringField(result.cardSet, 120) ?? "Unknown Set",
    setCode: sanitizeStringField(result.setCode, 16) ?? null,
    cardYear: sanitizeStringField(result.cardYear, 16) ?? "",
    cardNumber: sanitizeStringField(result.cardNumber, 32) ?? "",
    totalCount: sanitizeStringField(result.totalCount, 16) ?? null,
    regulationMark: sanitizeStringField(result.regulationMark, 4) ?? null,
    rarity: sanitizeStringField(result.rarity, 32) ?? null,
    illustrator: sanitizeStringField(result.illustrator, 60) ?? null,
    language: sanitizeStringField(result.language, 16) ?? null,
    identificationConfidence: pickEnum(result.identificationConfidence, VALID_QUALITY, "Medium"),
  };

  return new Response(JSON.stringify(safeResult), {
    status: 200,
    headers: { "Content-Type": "application/json", ...cors },
  });
});
