// Deterministic mapping from the four universal sub-grades (centering, corners,
// edges, surface) to per-TPG predictions, plus a needsRetake decision.
//
// Why deterministic: every TPG grades on the same physical attributes. Once
// the model has produced sub-grades, the overall grade per service is a rule,
// not a judgment call. Keeping it out of the prompt saves tokens, makes the
// mapping unit-testable, and means tuning one TPG's threshold doesn't
// destabilize the others.
//
// Sources for the mappings:
//   PSA: psacard.com/gradingstandards (lowest-sub-grade-wins aggregation)
//   CGC: cgccards.com/grading/grading-scale (Pristine 10 = perfect under
//        magnification on all sub-grades; Gem Mint 10 ≈ PSA 10)
//   BGS: beckett.com/grading (proprietary formula; we use the widely-cited
//        approximation: lowest sub-grade is the floor; overall ≤ lowest + 0.5;
//        all-10s = Pristine Black Label)
//   TAG: taggrading.com (sub-scores 1–1000 mapped to 1–10 grade band)

export type SubGrades = {
  centering: number;
  corners: number;
  edges: number;
  surface: number;
};

export type Quality = "High" | "Medium" | "Low";

export type GateValue = "PASS" | "FAIL" | "CANNOT_ASSESS" | "NOT_PROVIDED";

export type HardPassGate = Partial<Record<
  | "frontCentering"
  | "backCentering"
  | "frontCorners"
  | "backCorners"
  | "frontEdges"
  | "backEdges"
  | "frontSurface"
  | "backSurface"
  | "printQuality",
  GateValue
>>;

// ---------------------------------------------------------------------------
// PSA: integer 1–10, lowest sub-grade wins, no averaging.
// ---------------------------------------------------------------------------

const PSA_LABELS: Record<number, string> = {
  10: "Gem Mint",
  9: "Mint",
  8: "NM-MT",
  7: "NM",
  6: "EX-MT",
  5: "EX",
  4: "VG-EX",
  3: "VG",
  2: "Good",
  1: "Poor",
};

export function predictPsa(sub: SubGrades): { grade: number; label: string } {
  const grade = Math.max(1, Math.min(10, Math.floor(Math.min(
    sub.centering, sub.corners, sub.edges, sub.surface,
  ))));
  return { grade, label: PSA_LABELS[grade] ?? "Poor" };
}

// ---------------------------------------------------------------------------
// CGC: 0.5 increments. Tracks PSA closely but recognizes Pristine 10 (every
// sub-grade is a 10 with no qualifiers — the rare "perfect" tier above Gem
// Mint). Slightly more lenient on borderline 10s than PSA in practice.
// ---------------------------------------------------------------------------

function cgcLabel(grade: number, pristine: boolean): string {
  if (pristine) return "Pristine 10";
  if (grade >= 10) return "Gem Mint 10";
  if (grade >= 9.5) return "Mint+";
  if (grade >= 9) return "Mint";
  if (grade >= 8.5) return "NM-MT+";
  if (grade >= 8) return "NM-MT";
  if (grade >= 7) return "NM";
  if (grade >= 6) return "EX-NM";
  if (grade >= 5) return "EX";
  if (grade >= 4) return "VG-EX";
  if (grade >= 3) return "VG";
  if (grade >= 2) return "Good";
  if (grade >= 1.5) return "Fair";
  return "Poor";
}

export function predictCgc(
  sub: SubGrades,
  opts: { obscuredRegions: number; confidence: Quality },
): { grade: number; label: string; pristineCandidate: boolean } {
  const minSub = Math.min(sub.centering, sub.corners, sub.edges, sub.surface);
  // CGC uses 0.5 increments and floors at the lowest sub-grade.
  const grade = Math.max(1, Math.min(10, Math.floor(minSub * 2) / 2));
  // Pristine 10 requires every sub-grade to be a 10 AND no obscured regions
  // AND high confidence — a phone-photo-derived "Pristine" is otherwise a
  // false promise. CGC graders use 10x magnification we don't have.
  const allTens = sub.centering >= 10 && sub.corners >= 10 && sub.edges >= 10 && sub.surface >= 10;
  const pristineCandidate = allTens && opts.obscuredRegions === 0 && opts.confidence === "High";
  return { grade, label: cgcLabel(grade, pristineCandidate), pristineCandidate };
}

// ---------------------------------------------------------------------------
// BGS: sub-grades 1–10 in 0.5 increments. Uses a proprietary formula, but the
// widely-cited approximation is: overall is at most lowest_sub + 0.5, and the
// remaining sub-grades pull the overall up via a weighted average. We reverse
// the formula's direction here — start from a weighted blend, then floor by
// the lowest-sub + 0.5 rule. Black Label = all four sub-grades are exactly 10.
// ---------------------------------------------------------------------------

function bgsLabel(grade: number, blackLabel: boolean): string {
  if (blackLabel) return "Pristine Black Label";
  if (grade >= 10) return "Pristine 10";
  if (grade >= 9.5) return "Gem Mint 9.5";
  if (grade >= 9) return "Mint 9";
  if (grade >= 8.5) return "NM-MT+ 8.5";
  if (grade >= 8) return "NM-MT 8";
  if (grade >= 7) return "NM 7";
  if (grade >= 6) return "EX-MT 6";
  if (grade >= 5) return "EX 5";
  if (grade >= 4) return "VG-EX 4";
  if (grade >= 3) return "VG 3";
  if (grade >= 2) return "Good 2";
  if (grade >= 1.5) return "Fair 1.5";
  return "Poor 1";
}

export function predictBgs(sub: SubGrades): {
  overall: number;
  label: string;
  blackLabel: boolean;
  subGrades: SubGrades;
} {
  // BGS sub-grades use 0.5 increments — round our internal sub-grades to that.
  const round05 = (n: number) => Math.max(1, Math.min(10, Math.round(n * 2) / 2));
  const subGrades: SubGrades = {
    centering: round05(sub.centering),
    corners: round05(sub.corners),
    edges: round05(sub.edges),
    surface: round05(sub.surface),
  };

  const minSub = Math.min(subGrades.centering, subGrades.corners, subGrades.edges, subGrades.surface);
  // BGS weighs all four roughly equally; centering is slightly more forgiving
  // historically. Use a flat average for the blend.
  const blend = (subGrades.centering + subGrades.corners + subGrades.edges + subGrades.surface) / 4;
  // Floor by lowest + 0.5 rule (Beckett's well-documented cap).
  const ceiling = Math.min(10, minSub + 0.5);
  // Floor to half-step.
  const overall = Math.max(1, Math.min(ceiling, Math.floor(blend * 2) / 2));

  const blackLabel = subGrades.centering >= 10
    && subGrades.corners >= 10
    && subGrades.edges >= 10
    && subGrades.surface >= 10;

  return { overall, label: bgsLabel(overall, blackLabel), blackLabel, subGrades };
}

// ---------------------------------------------------------------------------
// TAG: 1–1000 sub-scores per attribute, mapped to a 0–10 grade band.
// TAG's published mapping (TAG 10 ≈ 950+ on every attribute, TAG 9 ≈ 800–949,
// TAG 8 ≈ 650–799, then ~150-point bands stepping down). We invert: scale
// each 1–10 sub-grade × 100 to land in the 100–1000 range, then map the
// minimum sub-score to a grade band.
// ---------------------------------------------------------------------------

function tagBandFromMinSub(min1to1000: number): number {
  // Mapping derived from TAG's public sample reports.
  if (min1to1000 >= 950) return 10;
  if (min1to1000 >= 900) return 9.5;
  if (min1to1000 >= 800) return 9;
  if (min1to1000 >= 700) return 8.5;
  if (min1to1000 >= 650) return 8;
  if (min1to1000 >= 550) return 7;
  if (min1to1000 >= 450) return 6;
  if (min1to1000 >= 350) return 5;
  if (min1to1000 >= 250) return 4;
  if (min1to1000 >= 150) return 3;
  if (min1to1000 >= 100) return 2;
  return 1;
}

export function predictTag(sub: SubGrades): {
  grade: number;
  subScores: { centering: number; corners: number; edges: number; surface: number };
  composite: number;
} {
  // Sub-grade 10 → 1000, 9.5 → 950, 9 → 900, etc. Linear scaling preserves
  // relative ordering. Real TAG sub-scores are noisier per attribute but on
  // average track linearly with PSA's 4 pillars.
  const scale = (s: number) => Math.max(1, Math.min(1000, Math.round(s * 100)));
  const subScores = {
    centering: scale(sub.centering),
    corners: scale(sub.corners),
    edges: scale(sub.edges),
    surface: scale(sub.surface),
  };
  const minScore = Math.min(subScores.centering, subScores.corners, subScores.edges, subScores.surface);
  const composite = Math.round(
    (subScores.centering + subScores.corners + subScores.edges + subScores.surface) / 4,
  );
  const grade = tagBandFromMinSub(minScore);
  return { grade, subScores, composite };
}

// ---------------------------------------------------------------------------
// All-graders combined.
// ---------------------------------------------------------------------------

export function predictAllGraders(
  sub: SubGrades,
  opts: { obscuredRegions: number; confidence: Quality },
) {
  return {
    PSA: predictPsa(sub),
    CGC: predictCgc(sub, opts),
    BGS: predictBgs(sub),
    TAG: predictTag(sub),
  };
}

// ---------------------------------------------------------------------------
// Retake decision: derived from the same observation-quality signals the
// prompt already returns. We do NOT ask the model to decide directly because
// "should I ask for another photo?" is a UX policy decision, not a grading
// decision — and policy belongs in code where we can A/B it.
//
// Retake when:
//   - photoQuality is Low (model literally couldn't see well)
//   - 3+ obscured regions (too much of the card hidden by glare/blur/framing)
//   - centering can't be measured (ratio strings === "N/A") — almost always
//     a perspective or framing problem
//   - 2+ hard-pass gate items came back CANNOT_ASSESS on the front (any one
//     CANNOT_ASSESS is a degraded confidence; two means we're guessing)
//
// We do NOT force retake just because back is missing. Single-photo grading
// is a legitimate flow — we degrade confidence and surface a soft tip
// instead of blocking the user.
// ---------------------------------------------------------------------------

export type CenteringDetail = {
  leftRight?: string;
  topBottom?: string;
  passesThreshold?: boolean;
  backLeftRight?: string;
  backTopBottom?: string;
};

export function decideRetake(input: {
  photoQuality: Quality;
  obscuredRegions: string[];
  centeringDetail: CenteringDetail;
  hardPassGate: HardPassGate;
}): { needsRetake: boolean; retakeReasons: string[] } {
  const reasons: string[] = [];

  if (input.photoQuality === "Low") {
    reasons.push("Photo is too low-quality to grade reliably (blur, glare, or low resolution).");
  }

  if (input.obscuredRegions.length >= 3) {
    reasons.push(
      `${input.obscuredRegions.length} regions are obscured by glare, blur, or framing — re-shoot in flat, even light.`,
    );
  }

  const lr = input.centeringDetail.leftRight;
  const tb = input.centeringDetail.topBottom;
  if ((lr && /n\/a/i.test(lr)) || (tb && /n\/a/i.test(tb))) {
    reasons.push("Centering can't be measured — hold the camera parallel to the card and re-shoot.");
  }

  const frontCannotAssess = (
    ["frontCentering", "frontCorners", "frontEdges", "frontSurface"] as const
  ).filter((k) => input.hardPassGate[k] === "CANNOT_ASSESS").length;
  if (frontCannotAssess >= 2) {
    reasons.push(
      `${frontCannotAssess} of 4 front-side pillars couldn't be assessed — the photo isn't sharp enough on the card itself.`,
    );
  }

  return { needsRetake: reasons.length > 0, retakeReasons: reasons };
}
