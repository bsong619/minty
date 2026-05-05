// Loads the canonical grading prompt. The content is bundled via
// prompt-content.ts (a generated TS module) instead of a runtime
// Deno.readTextFile of prompt.md — Supabase CLI's bundler only follows
// `import` statements, so reading prompt.md at runtime crashes the deployed
// worker because the .md file isn't shipped. The eval harness at
// scripts/eval_grader.py still reads prompt.md directly, keeping prompt.md
// as the editable source of truth. Run scripts/build-prompt-ts.sh after
// every edit to prompt.md.

import { GRADE_PROMPT_RAW } from "./prompt-content.ts";

// Convenience split: the markdown has two H2 sections, "## SYSTEM" and "## USER",
// which map to Anthropic's system block (cacheable) and user message (per-request,
// holds the images). If the markdown structure changes, update these markers.
function sliceBetween(text: string, startMarker: string, endMarker: string | null): string {
  const start = text.indexOf(startMarker);
  if (start === -1) return "";
  const sliceFrom = start + startMarker.length;
  if (endMarker === null) return text.slice(sliceFrom).trim();
  const end = text.indexOf(endMarker, sliceFrom);
  return (end === -1 ? text.slice(sliceFrom) : text.slice(sliceFrom, end)).trim();
}

export const GRADE_PROMPT = GRADE_PROMPT_RAW;
export const SYSTEM_PROMPT = sliceBetween(GRADE_PROMPT, "## SYSTEM", "## USER");
export const USER_PROMPT = sliceBetween(GRADE_PROMPT, "## USER", null);
