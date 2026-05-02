// Loads the canonical grading prompt from prompt.md at module-init time.
//
// prompt.md is the single source of truth — edit it, redeploy the function,
// and the new prompt is live. Keeping the prompt in markdown lets non-engineers
// review/tune it via PRs without touching TypeScript.
//
// Supabase Edge Functions bundle files colocated with the function entrypoint,
// so prompt.md ships alongside index.ts when you run `supabase functions deploy`.
const promptUrl = new URL("./prompt.md", import.meta.url);
export const GRADE_PROMPT = await Deno.readTextFile(promptUrl);

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
