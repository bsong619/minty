#!/usr/bin/env bash
# Regenerates supabase/functions/grade/prompt-content.ts from prompt.md.
#
# Why: Supabase CLI bundles only files reachable via `import` statements. A
# runtime `Deno.readTextFile("./prompt.md")` is NOT followed, so prompt.md
# never makes it into the deployed function and the worker crashes on first
# request. Embedding prompt.md as a TS string sidesteps that entirely.
#
# Run after every edit to prompt.md. The eval harness still reads prompt.md
# directly, so prompt.md remains the source of truth.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/supabase/functions/grade/prompt.md"
OUT="$ROOT/supabase/functions/grade/prompt-content.ts"

if [ ! -f "$SRC" ]; then
  echo "ERROR: $SRC not found" >&2
  exit 1
fi

node -e "
const fs = require('fs');
const c = fs.readFileSync('$SRC', 'utf8');
const banner = '// Auto-generated from prompt.md. Run scripts/build-prompt-ts.sh after edits.\n// Do not edit by hand — your changes will be overwritten on next regen.\n\n';
fs.writeFileSync('$OUT', banner + 'export const GRADE_PROMPT_RAW: string = ' + JSON.stringify(c) + ';\n');
"

echo "Wrote $OUT ($(wc -c < "$OUT" | tr -d ' ') bytes)"
