// The canonical grading prompt is authored in prompt.md and inlined into
// prompt-content.ts by the regenerate script. We do NOT read prompt.md at
// runtime because the Supabase CLI's deploy bundler follows code imports
// only — it doesn't ship co-located .md assets, which means a runtime
// Deno.readTextFile against prompt.md crashes with "path not found" in
// the Edge runtime (event_message NotFound, deployment versions 11–13).
//
// To update the prompt: edit prompt.md, run scripts/regenerate-prompt.sh
// (which regenerates prompt-content.ts), commit both, then
// `supabase functions deploy grade`.
import { PROMPT_MD } from "./prompt-content.ts";
export const GRADE_PROMPT = PROMPT_MD;

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

export const SYSTEM_PROMPT = sliceBetween(GRADE_PROMPT, "## SYSTEM", "## USER");
export const USER_PROMPT = sliceBetween(GRADE_PROMPT, "## USER", null);
