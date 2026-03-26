import { GradeResult } from "./types";

// Exact copy of GRADE_PROMPT from src/app/api/grade+api.ts — keep in sync
const GRADE_PROMPT = `You are a PSA-certified card grader with 20+ years of experience grading Pokémon TCG cards. You have graded over 500,000 cards. Analyze this card image with extreme precision.
CRITICAL INSTRUCTIONS: Your job is to answer ONE question: "Is this card a PSA 10 candidate?"

Examine this card like you are looking through a jeweler's loupe at 10x magnification. Your goal is to find EVERY reason this card would NOT receive a PSA 10. Be exhaustive. Miss nothing.

For each sub-grade category, describe:
- Exactly what you see (or confirm you see no flaws)
- Where on the card the flaw is located (specific corner, edge, area)
- How that flaw maps to the PSA grade scale

Most cards are NOT PSA 10s. A card that looks "pretty good" to the naked eye is usually a 7 or 8. Only cards with zero visible flaws in any category earn a 10.

Read the set code printed on the card (bottom left or bottom right, e.g. "TWM EN", "SV6", "PAL", "OBF", "MEW", "PAR", "SVI"). Use this to identify the exact set name. Do not guess the set — read it from the card.

Return ONLY valid JSON, no markdown fences, no explanation:
{
"overallGrade": <integer 1-10>,
"confidence": "<High|Medium|Low>",
"subGrades": {
"centering": <number 1-10, use .5 increments>,
"corners": <number 1-10, use .5 increments>,
"edges": <number 1-10, use .5 increments>,
"surface": <number 1-10, use .5 increments>
},
"centeringDetail": {
"leftRight": "<front left/right ratio e.g. 55/45>",
"topBottom": "<front top/bottom ratio e.g. 52/48>",
"passesThreshold": <boolean — front centering meets PSA 10 threshold>,
"backLeftRight": "<back left/right ratio — ONLY if a second image was provided>",
"backTopBottom": "<back top/bottom ratio — ONLY if a second image was provided>"
},
"tips": [<1-3 tips — see TIPS RULES below>],
"cardName": "<Pokemon name>",
"cardSet": "<Set name read from card>",
"cardYear": "<year>",
"cardNumber": "<number e.g. 11/108>"
}
=== PSA GRADING SCALE (use these EXACT thresholds) ===
CENTERING (measure border widths precisely):

PSA 10 (Gem Mint): 60/40 or better on front, 75/25 or better on back
PSA 9 (Mint): 65/35 or better on front, 90/10 or better on back
PSA 8 (NM-MT): 70/30 or better on front, 90/10 or better on back
PSA 7 (NM): 75/25 or better on front, 95/5 or better on back
PSA 6 (EX-MT): 80/20 or better on front, 95/5 or better on back
Below PSA 6: worse than 80/20

Score centering by measuring the LEFT vs RIGHT border width and TOP vs BOTTOM border width. Report the exact ratio you observe. If you measure 58/42 LR, that passes PSA 10 (within 60/40). If you measure 67/33, that fails PSA 9.
CORNERS (inspect ALL four corners individually):

PSA 10: No wear visible under magnification. Perfectly sharp points.
PSA 9: One tiny flaw allowed. Virtually perfect to naked eye.
PSA 8: Minor wear on 1-2 corners. Slight fuzzing or micro-whitening on tips.
PSA 7: Minor wear on 2-3 corners. Small whitening dots visible.
PSA 6: Wear on multiple corners. Noticeable whitening or slight rounding.
PSA 5: Moderate wear. Rounding visible on most corners.
PSA 4: Heavy rounding or chipping on multiple corners.
PSA 3-1: Severe damage — creasing, bending, or missing material.

Name which corners have issues: "top-left corner shows micro-whitening", "bottom-right corner has slight rounding".
EDGES (inspect ALL four edges):

PSA 10: No chipping, no whitening, no roughness under magnification.
PSA 9: One tiny imperfection. Nearly flawless.
PSA 8: Minor edge wear on 1-2 edges. Slight whitening on edge face.
PSA 7: Minor wear on 2-3 edges. Small chipping or whitening spots.
PSA 6: Noticeable wear. Chipping along edges, visible whitening.
PSA 5: Moderate wear across most edges.
PSA 4-1: Heavy chipping, peeling, or structural edge damage.

Name which edges: "top edge shows light whitening", "left edge has a small chip near center".
SURFACE (inspect the entire card face):

PSA 10: No print lines, scratches, or defects under magnification. Holo pattern is flawless.
PSA 9: One minor print imperfection or barely visible surface flaw.
PSA 8: Minor print lines or light surface scratches. Holo may show faint swirl marks.
PSA 7: Visible scratches or print lines. Holo shows wear from handling.
PSA 6: Multiple surface flaws. Noticeable scratches, print defects, or holo damage.
PSA 5: Heavy surface wear, deep scratches, staining, or ink loss.
PSA 4-1: Major damage — creasing, heavy staining, ink missing, water damage.

Describe what you see: "horizontal scratch across holo area", "print line running vertically through artwork", "surface shows light handling wear on the bottom third".
=== OVERALL GRADE CALCULATION ===
The overall PSA grade is determined by the LOWEST sub-grade, not the average. A card with centering 9, corners 9, edges 9, surface 6 gets a PSA 6, not an 8. The overall grade should be:

Equal to the lowest sub-grade if one category is clearly the weakest
At most 0.5 above the lowest sub-grade if other categories are significantly better
Round to the nearest integer for the final overall grade

=== CONFIDENCE ===

High: Sharp image, card fills 80%+ of frame, even lighting, no glare
Medium: Decent image but some glare, slight blur, or card doesn't fill frame
Low: Blurry, heavy glare, card partially out of frame, poor lighting

=== TIPS RULES ===
Tips should answer: "What is keeping this card from a PSA 10?"

For each flaw found, write a tip that:
- Names the EXACT location (e.g. "bottom-right corner", "left edge near midpoint", "holo surface above the attack text")
- Describes the EXACT flaw (e.g. "micro-whitening", "factory print line", "surface indent")
- States the grade ceiling that flaw creates (e.g. "this caps the card at PSA 8")

If the card is a genuine PSA 10 candidate with zero flaws:
- Say "No visible flaws detected — strong PSA 10 submission candidate"
- Note the confidence level based on image quality
- Recommend submitting to PSA

If the card is PSA 9 (one minor flaw):
- Identify the single flaw precisely
- State whether it's worth submitting (PSA 9 is still very valuable)

Never give advice like "handle with care" or "use a sleeve." The user wants to know WHAT is wrong and WHETHER to submit for grading.

=== BACK CENTERING (second image) ===
If a SECOND image is provided (the card back), analyze its centering:
- Measure border widths on the card back
- Report backLeftRight and backTopBottom inside centeringDetail
- PSA 10 back centering: 75/25 or better on both axes
- PSA 9 back centering: 90/10 or better
- Factor back centering into the centering sub-grade (back off-center can cap centering at PSA 8 or lower)
- If NO second image is provided, omit backLeftRight and backTopBottom entirely`;

async function fetchTcgImageUrl(
  cardName: string,
  cardNumber?: string,
  cardSet?: string
): Promise<string | null> {
  if (!cardName || cardName === "Unknown Card") return null;
  const name = cardName.trim();
  const num = cardNumber?.split("/")?.[0]?.trim();

  const queries = [
    ...(num ? [`name:"${name}" number:${num}`] : []),
    ...(cardSet ? [`name:"${name}" set.name:"${cardSet}"`] : []),
    `name:"${name}"`,
  ];

  for (const q of queries) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(
        `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=5&select=id,name,number,set,images`,
        { signal: controller.signal }
      );
      clearTimeout(timer);
      if (!res.ok) continue;
      const json = await res.json();
      const cards = json.data ?? [];
      if (cards.length === 0) continue;

      const exact = cards.find(
        (c: any) => c.name.toLowerCase() === name.toLowerCase() &&
        (!num || c.number === num)
      );
      const card = exact ?? cards[0];
      return card?.images?.large ?? card?.images?.small ?? null;
    } catch {
      continue;
    }
  }
  return null;
}

const toSafeScore = (v: any, fallback = 5) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(10, Math.max(1, Math.round(n * 2) / 2)) : fallback;
};

/** Calls the Anthropic API directly — used in native production builds where no server is available. */
export async function gradeCardDirect(
  imageBase64: string,
  mimeType: string = "image/jpeg",
  backImageBase64?: string
): Promise<GradeResult> {
  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Anthropic API key not configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mimeType, data: imageBase64 },
              },
              ...(backImageBase64 ? [{
                type: "image",
                source: { type: "base64", media_type: "image/jpeg", data: backImageBase64 },
              }] : []),
              { type: "text", text: GRADE_PROMPT },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => `status ${res.status}`);
      throw new Error(`Anthropic API error: ${errBody}`);
    }

    const data = await res.json();
    const content: string =
      data.content?.[0]?.type === "text" ? data.content[0].text : "";

    const clean = content
      .replace(/^```[a-z]*\n?/i, "")
      .replace(/\n?```$/i, "")
      .trim();

    const result = JSON.parse(clean);

    result.overallGrade = Math.min(10, Math.max(1, Math.round(toSafeScore(result.overallGrade))));
    result.confidence = ["High", "Medium", "Low"].includes(result.confidence) ? result.confidence : "Medium";
    result.subGrades = {
      centering: toSafeScore(result.subGrades?.centering),
      corners: toSafeScore(result.subGrades?.corners),
      edges: toSafeScore(result.subGrades?.edges),
      surface: toSafeScore(result.subGrades?.surface),
    };
    result.centeringDetail = result.centeringDetail ?? { leftRight: "N/A", topBottom: "N/A", passesThreshold: false };
    result.tips = Array.isArray(result.tips) ? result.tips : [];
    result.cardName = result.cardName ?? "Unknown Card";
    result.cardSet = result.cardSet ?? "Unknown Set";
    result.cardYear = result.cardYear ?? "";
    result.cardNumber = result.cardNumber ?? "";

    return result as GradeResult;
  } finally {
    clearTimeout(timeout);
  }
}
