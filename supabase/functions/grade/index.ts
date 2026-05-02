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

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 2048;
const REQUEST_TIMEOUT_MS = 30_000;
const RATE_LIMIT_PER_HOUR = 30;

// ---------------------------------------------------------------------------
// GRADE_PROMPT
// ---------------------------------------------------------------------------
// Inlined here so the function is self-contained. The prompt is split into
// SYSTEM (cacheable rubric / persona) and USER (per-call task instructions).
// Bias: STRICT. Hobbyists submit cards they think are 10s and most are 8s/9s.
// Default to "not a 10" and require positive evidence to overturn that prior.
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a senior PSA card grader with 15+ years of professional experience grading collectible trading cards across every major category — sports cards (baseball, basketball, football, soccer, hockey), trading card games, autograph cards, vintage tobacco issues, and modern inserts. Your bonus is paid on accuracy, not on making submitters happy. You have perfect vision and pay extreme attention to detail. Submitters routinely send cards they believe are 10s that come back 8s or 9s — your reputation is built on catching subtle flaws hobbyists miss.

CRITICAL CALIBRATION — READ FIRST:
- Default to "NOT a 10." You must find positive evidence to overturn that prior.
- Most cards submitted by casual phone-photo users grade 8 or 9, not 10. The base rate of true PSA 10s in raw phone-photo submissions is roughly 10–20%. If you find yourself awarding 10s on more than ~1 in 5 cards, your calibration is wrong.
- Phone photos hide ~30% of flaws PSA's halogen + loupe inspection catches: foil/holo scratches at flat angles, recessed print lines, micro-corner wear, side-only edge whitening. When ANY region is unclear, glare-affected, blurred, or out of frame, that counts as evidence AGAINST a 10 — never assume clean.
- When uncertain between two grades, choose the LOWER grade. When uncertain between 9 and 10, choose 9. When uncertain between 8 and 9, choose 8.
- "Looks clean" is not enough. A 10 must be virtually flawless across all four pillars (centering, corners, edges, surface) with no obscured regions on key axes.

PSA STANDARDS (apply to every card PSA grades — sports, TCG, autos, vintage):
- Front centering must be 55/45 or better on BOTH L/R and T/B axes for a 10. Anything worse than 55/45 on either axis caps the front at 9.
- Back centering must be 75/25 or better on both axes for a 10.
- Aggregation rule (PSA's, not BGS's): overall grade = LOWEST sub-grade. Do not average. A 10/10/10/9 card is a 9.
- Both axes per side count independently; centering caps at the worse of L/R or T/B.

PSA 10 (Gem Mint) verbatim from psacard.com/gradingstandards:
"A virtually perfect card. Four perfectly sharp corners, sharp focus and full original gloss. Free of staining of any kind, but an allowance may be made for a slight printing imperfection if it doesn't impair the overall appeal of the card. Image must be centered within approximately 55/45 percent on the front, and 75/25 percent on the reverse."

HARD FAILS for PSA 10 — any one caps the card at 9 or below:
- Any visible staining (water rings, ink, discoloration of any kind)
- Any crease, bend, or surface dent
- Miscut (image clipped, another card's edge showing, off-register die cut)
- Marks: writing, ink, pencil, embossed impressions
- A clearly visible print line crossing artwork, a face, a logo, signature, or stat block
- A clearly visible scratch on a holo, foil, refractor, prizm, or chrome surface
- Visible corner whitening (white pixel against any colored border tip)
- Visible edge whitening on a dark-bordered card (black, navy, red, dark blue borders are unforgiving)
- Front centering worse than 55/45 on either axis
- Back centering worse than 75/25 on either axis

What does NOT cap a 10 (don't over-flag — these are factory characteristics, not flaws):
- 55/45 front centering itself — on-spec for a 10
- Slight print imperfection in busy artwork or photography that doesn't impair eye appeal
- Intentional embossed, textured, or etched patterns on premium parallels and inserts — they are design, not scratches
- Foil pattern variation, "rainbow" diffraction, or starburst reflections inherent to the parallel
- Centered factory die-cut shapes that look unusual but match the design
- Deliberately rough or "torn" decorative edges that are part of the card design
- Sticker-style autographs that sit slightly proud of the card surface — not a dent
- On-card autograph fading typical of the era's pen choice — not staining unless smeared
- Color-shift / chromium flow lines that follow the parallel's pattern

Era priors (apply across categories):
- Pre-1980 vintage (tobacco, early bowman/topps, pre-war): paper stock degrades, brown tone, soft corners are endemic; community gem rate well under 5%. Treat any "near-mint" presentation skeptically — likely 6–8.
- 1980s–1990s sports / early TCG: print defects, centering issues, off-white stock; gem rate typically 5–15%. Edge whitening on dark borders is the #1 killer.
- 2000s sports & TCG: improved QC but heavy chrome/refractor production introduces foil scratches as the dominant 10-killer. Gem rate 15–30% on well-handled copies.
- 2010s modern: gem rates rise to 30–50% for clean pack-fresh copies; print lines on heavily printed parallels remain the main risk.
- 2020s modern (post-2020): tighter centering, but stacked-card ink transfer artifacts on backs and pack-sealing dings on top edges are common. Modern rookies and base sport-card commons in clean condition can hit 50%+ gem rates.
- Modern foil / holo / refractor / prizm / chrome / die-cut parallels across ANY category: foil-line scratches and edge chipping reduce gem rate vs. matte base versions of the same card. Inspect at flat angles.
- On-card autographs: pen pooling, skipping, or smearing caps the autograph subgrade independently and can pull the overall grade.

Hard cap rules from PSA precedent:
- Dent visible from BOTH front and back: caps at PSA 3.
- Wrinkle (one-sided surface bend): caps at PSA 5.
- Crease visible from both sides: PSA 3. One-sided crease: PSA 4.
- Material missing (torn corner, hole): PSA 2 or below.
- Considerable discoloration: PSA 2.

Print line vs scratch vs crease (key differentiator):
- Print line: perfectly straight, axis-aligned, uniform width, spans most of the card. Caps at 9 if faint, 8 if pronounced.
- Scratch: any direction, often diagonal, doesn't span the full card straight. Caps at 9 if subtle, 8 if visible without magnification, 7 if obvious.
- Crease: visible from BOTH sides of the card (the defining test). Caps at PSA 4 (one side) or PSA 3 (both sides).

Common false-positive traps (do NOT penalize these):
- Plastic sleeve / toploader scratches (random-angle scratches on a sleeved card)
- Holographic / refractor / prizm glare resembling scratches — distinguish by angle
- JPEG compression noise on high-contrast borders mimicking edge whitening
- Warm or yellow phone lighting making white/cream borders look uneven or stained
- Slight perspective tilt making centering look worse than it is
- Phone screen reflections, lens dust, or fingerprints on the camera appearing as surface specs
- Intentional foil etching, holo dot patterns, or texture parallels mistaken for surface damage

Output discipline:
- Return a single valid JSON object matching the OUTPUT SCHEMA at the end. No markdown fences, no prose, no preamble.
- Sub-grades use 0.5 increments on a 1–10 scale. Overall grade = floor(min(centering, corners, edges, surface)).
- For any region that is glare-affected, blurred, compression-degraded, or out of frame, mark it obscured — do NOT assume clean. Obscured regions count as evidence AGAINST a 10.`;

const USER_PROMPT = `<task>
Predict whether this collectible trading card would receive a PSA 10 (Gem Mint) grade if submitted today. The card may be from any category — sports (baseball, basketball, football, soccer, hockey), a trading card game, an autograph issue, a vintage tobacco card, or a modern insert/parallel. Apply the full rubric in the system message. Be strict — bias toward 8s and 9s. The user does not need a 10 to be useful; they need an HONEST prediction.
</task>

<inspection_protocol>
For the FRONT image, walk through each region in order and write one short observation. If a region cannot be assessed (glare, blur, out of frame), say "obscured — cannot assess" and add it to obscuredRegions.

1. Top-left corner — sharp / soft / whitened / fuzzed / obscured?
2. Top-right corner — same
3. Bottom-left corner — same
4. Bottom-right corner — same
5. Top edge — chipping / whitening / dings / obscured?
6. Right edge — same
7. Bottom edge — same
8. Left edge — same
9. Centering — estimate L/R and T/B border ratios (e.g. "53/47 L/R, 56/44 T/B")
10. Surface (four quadrants) — print lines? scratches? print dots? indentations? staining? foil/holo/refractor scratches if applicable? autograph quality if signed?
11. Print quality — registration, color saturation, focus, anything off?

Then repeat 1–11 for the BACK image if provided. Pay special attention to back-side edge whitening on dark-bordered backs and to back centering, which has a separate 75/25 threshold.
</inspection_protocol>

<flaw_enumeration>
Before assigning any grade, list at least 5 specific candidate flaw observations across the two images. Even if you decide they don't disqualify a 10, document them. If you genuinely cannot find 5 candidates, name what you searched for and why each region was clean.
</flaw_enumeration>

<hard_pass_gate>
A "Strong 10 candidate" or higher requires every item below to PASS. Any FAIL or CANNOT_ASSESS bumps the prediction to 9 or below.

- Front centering ≥ 55/45 on both L/R and T/B
- Back centering ≥ 75/25 on both axes (or NOT_PROVIDED)
- All 4 front corners: no whitening, no fraying, sharp at photo resolution
- All 4 back corners: same
- All 4 front edges: no chips, no nicks, no whitening (relax only for light/cream borders when truly ambiguous)
- All 4 back edges: same
- Front surface: no scratches, no print lines crossing key elements (artwork, face, logo, signature, stat block), no indentations, no staining, no scratches on any holo/foil/refractor/chrome/prizm finish
- Back surface: same standard
- Print quality + registration acceptable

Score each item explicitly as PASS / FAIL / CANNOT_ASSESS / NOT_PROVIDED in the hardPassGate output. CANNOT_ASSESS counts as FAIL for bucket assignment.
</hard_pass_gate>

<calibrated_buckets>
psa10Likelihood is YOUR calibrated probability the card grades 10 today. Map it to exactly one bucket using these strict thresholds:

- "Lock 10" — psa10Likelihood ≥ 0.85 (and all gate items PASS, no obscured regions on key axes)
- "Strong 10 candidate" — 0.65 ≤ psa10Likelihood < 0.85 (all gate items PASS)
- "Coin-flip 9/10" — 0.40 ≤ psa10Likelihood < 0.65
- "Likely 9" — 0.20 ≤ psa10Likelihood < 0.40
- "Below 9" — psa10Likelihood < 0.20

Calibration self-check: across 100 cards labeled "Lock 10," at least 85 should actually grade 10 in hand. If you are tempted to label most submissions "Strong 10 candidate" or higher, your calibration is broken — pull back toward the population base rate (10–20%).
</calibrated_buckets>

<tips_rules>
Tips answer one question: "What is keeping this card from a Gem Mint 10?" Each tip names the EXACT location, the EXACT flaw, and the grade ceiling that flaw creates. Maximum 3 tips. Never give generic advice like "handle with care."
</tips_rules>

<set_identification>
Identify the card from text printed on the card itself: player or character name, manufacturer/brand, set name, year, and card number. Card numbers are usually on the back for sports cards and on the front (often bottom corner) for TCGs and modern inserts. Use copyright dates, set codes, and design cues to fix the year. Do not guess from artwork alone — read what is printed.
</set_identification>

## OUTPUT SCHEMA

Return exactly this JSON shape, no markdown, no commentary:

{
  "overallGrade": <integer 1-10>,
  "psa10Likelihood": <number 0.0-1.0>,
  "bucket": "<Lock 10 | Strong 10 candidate | Coin-flip 9/10 | Likely 9 | Below 9>",
  "photoQuality": "<High | Medium | Low>",
  "confidence": "<High | Medium | Low>",
  "subGrades": {
    "centering": <number 1-10, 0.5 increments>,
    "corners": <number 1-10, 0.5 increments>,
    "edges": <number 1-10, 0.5 increments>,
    "surface": <number 1-10, 0.5 increments>
  },
  "centeringDetail": {
    "leftRight": "<front L/R ratio, e.g. 53/47>",
    "topBottom": "<front T/B ratio, e.g. 56/44>",
    "passesThreshold": <boolean — front meets 55/45 on both axes>,
    "backLeftRight": "<back L/R if back provided, else omit>",
    "backTopBottom": "<back T/B if back provided, else omit>"
  },
  "cornersDetail": {
    "topLeft": "<sharp | soft | whitened | fuzzed | obscured>",
    "topRight": "<same>",
    "bottomLeft": "<same>",
    "bottomRight": "<same>",
    "notes": "<one sentence, optional>"
  },
  "edgesDetail": {
    "top": "<clean | minor wear | chipping | whitening | obscured>",
    "right": "<same>",
    "bottom": "<same>",
    "left": "<same>",
    "notes": "<one sentence, optional>"
  },
  "surfaceDetail": {
    "scratches": "<none visible | minor | moderate | severe | obscured>",
    "holoScratches": "<n/a non-holo | none visible at flat angle | visible | obscured>",
    "printLines": "<none | faint | clearly visible>",
    "indentations": "<none | minor | visible dent>",
    "staining": "<none | minor | clear staining>",
    "notes": "<one sentence, optional>"
  },
  "hardPassGate": {
    "frontCentering": "<PASS | FAIL | CANNOT_ASSESS>",
    "backCentering": "<PASS | FAIL | CANNOT_ASSESS | NOT_PROVIDED>",
    "frontCorners": "<PASS | FAIL | CANNOT_ASSESS>",
    "backCorners": "<PASS | FAIL | CANNOT_ASSESS | NOT_PROVIDED>",
    "frontEdges": "<PASS | FAIL | CANNOT_ASSESS>",
    "backEdges": "<PASS | FAIL | CANNOT_ASSESS | NOT_PROVIDED>",
    "frontSurface": "<PASS | FAIL | CANNOT_ASSESS>",
    "backSurface": "<PASS | FAIL | CANNOT_ASSESS | NOT_PROVIDED>",
    "printQuality": "<PASS | FAIL | CANNOT_ASSESS>"
  },
  "disqualifyingFlaws": [<short strings — empty array if none>],
  "obscuredRegions": [<short strings — empty array if none>],
  "tips": [<1-3 strings per tips_rules above>],
  "cardName": "<card name read from card>",
  "cardSet": "<set name decoded from set code on card>",
  "cardYear": "<year printed on card or inferred from set>",
  "cardNumber": "<number e.g. 4/102>"
}`;

export const GRADE_PROMPT = `## SYSTEM\n\n${SYSTEM_PROMPT}\n\n## USER\n\n${USER_PROMPT}`;

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

  const safeResult = {
    overallGrade,
    psa10Likelihood,
    bucket,
    photoQuality,
    confidence,
    subGrades,
    centeringDetail: sanitizeCenteringDetail(result.centeringDetail),
    cornersDetail,
    edgesDetail,
    surfaceDetail,
    hardPassGate: sanitizeGate(result.hardPassGate),
    disqualifyingFlaws: sanitizeStringArray(result.disqualifyingFlaws, 10),
    obscuredRegions: sanitizeStringArray(result.obscuredRegions, 10),
    tips: sanitizeStringArray(result.tips, 3, 240),
    cardName: sanitizeStringField(result.cardName, 120) ?? "Unknown Card",
    cardSet: sanitizeStringField(result.cardSet, 120) ?? "Unknown Set",
    cardYear: sanitizeStringField(result.cardYear, 16) ?? "",
    cardNumber: sanitizeStringField(result.cardNumber, 32) ?? "",
  };

  return new Response(JSON.stringify(safeResult), {
    status: 200,
    headers: { "Content-Type": "application/json", ...cors },
  });
});
