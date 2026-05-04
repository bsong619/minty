// Eval harness for the grading prompt.
//
// What this does:
//   1. Pulls N labeled samples from public.graded_card_samples (default 1000;
//      pass --target=10000 for a full 10k sweep).
//   2. For each sample, downloads the image to /tmp and asks Claude (via
//      claude-agent-sdk, using your Pro/Max SUBSCRIPTION — not API credits)
//      to grade it using prompt.md.
//   3. Compares the predicted grade against the slab's actual grade on the
//      slab's TPG scale (PSA / CGC / BGS / SGC).
//   4. Writes a confusion matrix + per-(grader, grade) accuracy to stdout
//      and a detailed JSON file to scripts/eval-results-<timestamp>.json.
//
// Why claude-agent-sdk and not the Anthropic SDK with an API key:
//   See ~/.claude/projects/-Users-brendensong/memory — for personal projects,
//   subscription auth via claude-agent-sdk avoids API charges. 10k vision
//   calls on the API would be real money; on the subscription it's included.
//
// How vision input works here:
//   claude-agent-sdk runs Claude Code under the hood. We save each card
//   image to /tmp/<itemId>.jpg and tell Claude the file path; the Read tool
//   loads the image into the conversation. Cleaner than base64-ing into the
//   prompt and avoids payload-size issues at 10k scale.
//
// Run:
//   cd ~/minty
//   bun add -d @anthropic-ai/claude-agent-sdk @supabase/supabase-js
//   export SUPABASE_URL=https://<project>.supabase.co
//   export SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
//   bun run scripts/eval-grader.ts --target=1000 --concurrency=3
//
// Auth: Claude Code login (run `claude login` once if you haven't).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { query } from "@anthropic-ai/claude-agent-sdk";
import {
  decideRetake,
  predictAllGraders,
  type SubGrades,
  type Quality,
} from "../supabase/functions/_shared/grader-predictions.ts";

// ---------------------------------------------------------------------------
// Args + env
// ---------------------------------------------------------------------------

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [[m[1], m[2]]] : a.startsWith("--") ? [[a.slice(2), "true"]] : [];
  }),
);

const TARGET = Number(args.target ?? 1000);
const CONCURRENCY = Number(args.concurrency ?? 3);
const ONLY_GRADER = args.grader as string | undefined;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env first.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Prompt: read prompt.md (single source of truth shared with the deployed
// grade function) and split into SYSTEM / USER blocks.
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = join(__dirname, "..", "supabase", "functions", "grade", "prompt.md");
const promptMd = readFileSync(PROMPT_PATH, "utf8");

function sliceBetween(text: string, start: string, end: string | null): string {
  const i = text.indexOf(start);
  if (i === -1) return "";
  const from = i + start.length;
  if (end === null) return text.slice(from).trim();
  const j = text.indexOf(end, from);
  return (j === -1 ? text.slice(from) : text.slice(from, j)).trim();
}

const SYSTEM_PROMPT = sliceBetween(promptMd, "## SYSTEM", "## USER");
const USER_PROMPT = sliceBetween(promptMd, "## USER", null);

if (!SYSTEM_PROMPT || !USER_PROMPT) {
  console.error("Failed to parse SYSTEM/USER blocks from prompt.md");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Supabase client (REST via fetch — keep deps minimal)
// ---------------------------------------------------------------------------

interface Sample {
  id: string;
  ebay_item_id: string;
  title: string;
  image_url: string;
  back_image_url: string | null;
  grader: string;
  grade: number;
  category: string | null;
  year: number | null;
}

async function loadSamples(target: number): Promise<Sample[]> {
  const url = new URL("/rest/v1/graded_card_samples", SUPABASE_URL);
  url.searchParams.set(
    "select",
    "id,ebay_item_id,title,image_url,back_image_url,grader,grade,category,year",
  );
  url.searchParams.set("order", "id");
  url.searchParams.set("limit", String(target * 2));
  if (ONLY_GRADER) url.searchParams.set("grader", `eq.${ONLY_GRADER}`);

  const res = await fetch(url, {
    headers: {
      apikey: SERVICE_KEY!,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Sample load failed: ${res.status} ${await res.text()}`);
  }
  const all = (await res.json()) as Sample[];

  // Stratify: (grader, integer-floor of grade) buckets so every band gets
  // representation. floor(target/buckets) rows per bucket.
  const buckets = new Map<string, Sample[]>();
  for (const s of all) {
    const k = `${s.grader}|${Math.floor(s.grade)}`;
    const arr = buckets.get(k) ?? [];
    arr.push(s);
    buckets.set(k, arr);
  }
  const perBucket = Math.max(1, Math.floor(target / Math.max(1, buckets.size)));
  const out: Sample[] = [];
  for (const arr of buckets.values()) {
    for (let i = 0; i < Math.min(perBucket, arr.length); i++) out.push(arr[i]);
  }
  return out.slice(0, target);
}

// ---------------------------------------------------------------------------
// Image fetch → temp file. Claude Code reads from disk via Read tool.
// ---------------------------------------------------------------------------

async function downloadToTemp(imageUrl: string, itemId: string): Promise<string | null> {
  try {
    const res = await fetch(imageUrl, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > 8 * 1024 * 1024) return null;
    const ext = res.headers.get("content-type")?.includes("png") ? "png" : "jpg";
    const path = join(tmpdir(), `minty-eval-${itemId}.${ext}`);
    await writeFile(path, buf);
    return path;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Claude vision call via claude-agent-sdk (subscription auth).
// We give Claude the Read tool and reference the file path in the prompt.
// max_turns=2: turn 1 reads the image, turn 2 returns JSON.
// ---------------------------------------------------------------------------

interface GradeOutput {
  overallGrade: number;
  psa10Likelihood: number | null;
  bucket: string;
  photoQuality: string;
  confidence: string;
  subGrades: SubGrades;
  centeringDetail: { leftRight?: string; topBottom?: string; passesThreshold?: boolean };
  hardPassGate: Record<string, string>;
  obscuredRegions: string[];
  disqualifyingFlaws: string[];
  tips: string[];
  cardName?: string;
  cardSet?: string;
  cardYear?: string;
  cardNumber?: string;
}

function extractJson(text: string): GradeOutput | null {
  const cleaned = text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  // Prefer the largest balanced object — model often emits prose first.
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!objMatch) return null;
  try {
    return JSON.parse(objMatch[0]) as GradeOutput;
  } catch {
    return null;
  }
}

async function gradeWithClaude(imagePath: string): Promise<GradeOutput> {
  const userMessage =
    `The card image to grade is at this absolute path on the local filesystem:\n` +
    `  ${imagePath}\n\n` +
    `Use the Read tool to load it (the Read tool supports images). Treat it as the FRONT of the card. ` +
    `No back image is provided — mark back-side hardPassGate fields as NOT_PROVIDED.\n\n` +
    USER_PROMPT;

  const stream = query({
    prompt: userMessage,
    options: {
      systemPrompt: SYSTEM_PROMPT,
      allowedTools: ["Read"],
      model: "claude-sonnet-4-6",
      maxTurns: 2,
      // cwd doesn't need to be the repo — we use absolute paths.
      cwd: tmpdir(),
    },
  });

  let text = "";
  for await (const msg of stream) {
    // claude-agent-sdk streams typed messages. We only care about assistant
    // text blocks; tool calls / results pass through.
    const content = (msg as { message?: { content?: unknown[] } })?.message?.content;
    if (Array.isArray(content)) {
      for (const block of content) {
        const b = block as { type?: string; text?: string };
        if (b.type === "text" && typeof b.text === "string") text += b.text;
      }
    }
  }
  const parsed = extractJson(text);
  if (!parsed) throw new Error(`No JSON in response (got ${text.length} chars)`);
  return parsed;
}

// ---------------------------------------------------------------------------
// Per-grader scale comparison
// ---------------------------------------------------------------------------

function predictedOnGraderScale(sub: SubGrades, opts: { obscuredRegions: number; confidence: Quality }, grader: string): number {
  const all = predictAllGraders(sub, opts);
  switch (grader) {
    case "PSA": return all.PSA.grade;
    case "CGC": return all.CGC.grade;
    case "BGS": return all.BGS.overall;
    case "TAG": return all.TAG.grade;
    case "SGC":
    case "HGA": return all.PSA.grade;
    default: return all.PSA.grade;
  }
}

// ---------------------------------------------------------------------------
// Concurrency-limited runner
// ---------------------------------------------------------------------------

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, i: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function next() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        results[i] = await worker(items[i], i);
      } catch (e) {
        results[i] = e as R;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, limit) }, () => next()));
  return results;
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

interface EvalRow {
  sample: Sample;
  predicted?: GradeOutput & { perGraderPredictions: ReturnType<typeof predictAllGraders>; needsRetake: boolean; retakeReasons: string[] };
  predictedOnScale?: number;
  delta?: number;
  error?: string;
}

function buildReport(rows: EvalRow[]) {
  const total = rows.length;
  const completed = rows.filter((r) => r.predicted).length;
  const errored = total - completed;
  const exact = rows.filter((r) => r.predicted && r.delta === 0).length;
  const within1 = rows.filter((r) => r.predicted && r.delta !== undefined && Math.abs(r.delta) <= 1).length;
  const retakes = rows.filter((r) => r.predicted?.needsRetake).length;

  const perGrader: Record<string, { count: number; exact: number; within1: number; biasSum: number; meanDelta: number }> = {};
  const confusion: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    if (!r.predicted) continue;
    const g = r.sample.grader;
    perGrader[g] = perGrader[g] ?? { count: 0, exact: 0, within1: 0, biasSum: 0, meanDelta: 0 };
    perGrader[g].count += 1;
    if (r.delta === 0) perGrader[g].exact += 1;
    if (r.delta !== undefined && Math.abs(r.delta) <= 1) perGrader[g].within1 += 1;
    if (r.delta !== undefined) perGrader[g].biasSum += r.delta;

    const actualKey = `${g}-${r.sample.grade}`;
    const predictedKey = String(r.predictedOnScale);
    confusion[actualKey] = confusion[actualKey] ?? {};
    confusion[actualKey][predictedKey] = (confusion[actualKey][predictedKey] ?? 0) + 1;
  }
  for (const k of Object.keys(perGrader)) {
    perGrader[k].meanDelta = perGrader[k].biasSum / Math.max(1, perGrader[k].count);
  }
  return {
    summary: {
      total,
      completed,
      errored,
      exact,
      exactPct: completed ? exact / completed : 0,
      within1Pct: completed ? within1 / completed : 0,
      retakeFlagged: retakes,
    },
    perGrader,
    confusion,
  };
}

function printReport(rep: ReturnType<typeof buildReport>) {
  const s = rep.summary;
  console.log("\n=== EVAL SUMMARY ===");
  console.log(`scanned:    ${s.total}`);
  console.log(`completed:  ${s.completed}`);
  console.log(`errored:    ${s.errored}`);
  console.log(`retakes:    ${s.retakeFlagged}`);
  console.log(`exact:      ${s.exact}/${s.completed} (${(s.exactPct * 100).toFixed(1)}%)`);
  console.log(`within ±1:  ${(s.within1Pct * 100).toFixed(1)}%`);
  console.log("\n=== PER-GRADER ===");
  for (const [g, r] of Object.entries(rep.perGrader)) {
    const exactPct = (r.exact / r.count * 100).toFixed(1);
    const withinPct = (r.within1 / r.count * 100).toFixed(1);
    const bias = r.meanDelta >= 0 ? `+${r.meanDelta.toFixed(2)}` : r.meanDelta.toFixed(2);
    console.log(`  ${g}: n=${r.count}  exact=${exactPct}%  ±1=${withinPct}%  bias=${bias}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const t0 = Date.now();
console.log(
  `Loading up to ${TARGET} samples${ONLY_GRADER ? ` (grader=${ONLY_GRADER})` : ""}...`,
);
const samples = await loadSamples(TARGET);
console.log(
  `Loaded ${samples.length} samples. Grading via Claude (subscription) at concurrency=${CONCURRENCY}.`,
);

let done = 0;
const rows = await runWithConcurrency(samples, CONCURRENCY, async (s): Promise<EvalRow> => {
  let imagePath: string | null = null;
  try {
    imagePath = await downloadToTemp(s.image_url, s.ebay_item_id);
    if (!imagePath) {
      done += 1;
      if (done % 25 === 0) console.log(`  progress: ${done}/${samples.length}`);
      return { sample: s, error: "image_download_failed" };
    }
    const raw = await gradeWithClaude(imagePath);
    const obscured = Array.isArray(raw.obscuredRegions) ? raw.obscuredRegions : [];
    const subGrades: SubGrades = {
      centering: Number(raw.subGrades?.centering ?? 5),
      corners: Number(raw.subGrades?.corners ?? 5),
      edges: Number(raw.subGrades?.edges ?? 5),
      surface: Number(raw.subGrades?.surface ?? 5),
    };
    const confidence = (raw.confidence as Quality) ?? "Medium";
    const photoQuality = (raw.photoQuality as Quality) ?? "Medium";
    const perGraderPredictions = predictAllGraders(subGrades, {
      obscuredRegions: obscured.length,
      confidence,
    });
    const { needsRetake, retakeReasons } = decideRetake({
      photoQuality,
      obscuredRegions: obscured,
      centeringDetail: raw.centeringDetail ?? {},
      hardPassGate: raw.hardPassGate as never,
    });
    const onScale = predictedOnGraderScale(
      subGrades,
      { obscuredRegions: obscured.length, confidence },
      s.grader,
    );
    const delta = onScale - s.grade;
    done += 1;
    if (done % 25 === 0) console.log(`  progress: ${done}/${samples.length}`);
    return {
      sample: s,
      predicted: { ...raw, perGraderPredictions, needsRetake, retakeReasons },
      predictedOnScale: onScale,
      delta,
    };
  } catch (e) {
    done += 1;
    if (done % 25 === 0) console.log(`  progress: ${done}/${samples.length}`);
    return { sample: s, error: String(e).slice(0, 200) };
  } finally {
    if (imagePath) await unlink(imagePath).catch(() => {});
  }
});

const report = buildReport(rows);
printReport(report);

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
mkdirSync(join(__dirname), { recursive: true });
const outPath = join(__dirname, `eval-results-${stamp}.json`);
writeFileSync(
  outPath,
  JSON.stringify(
    {
      meta: { target: TARGET, concurrency: CONCURRENCY, onlyGrader: ONLY_GRADER, elapsedMs: Date.now() - t0 },
      report,
      rows: rows.map((r) => ({
        sampleId: r.sample.id,
        title: r.sample.title.slice(0, 200),
        actual: { grader: r.sample.grader, grade: r.sample.grade },
        predicted: r.predicted
          ? {
            onScale: r.predictedOnScale,
            psa: r.predicted.perGraderPredictions.PSA.grade,
            cgc: r.predicted.perGraderPredictions.CGC.grade,
            bgs: r.predicted.perGraderPredictions.BGS.overall,
            tag: r.predicted.perGraderPredictions.TAG.grade,
            needsRetake: r.predicted.needsRetake,
            retakeReasons: r.predicted.retakeReasons,
          }
          : undefined,
        delta: r.delta,
        error: r.error,
      })),
    },
    null,
    2,
  ),
);
console.log(`\nWrote detailed results to ${outPath}`);
