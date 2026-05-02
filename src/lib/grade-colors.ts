import { C } from "./theme";

// New mint-based grade scale. No bright red. Gem 10 = gold, 9 = mint signature,
// 7-8 = blue, 5-6 = amber, 1-4 = muted brick.
export function getGradeColor(grade: number): string {
  if (grade >= 9.5) return C.gold;
  if (grade >= 9)   return C.mint;
  if (grade >= 7)   return C.g78;
  if (grade >= 5)   return C.g56;
  return C.g14;
}

export function getConfidenceColor(confidence: "High" | "Medium" | "Low"): string {
  switch (confidence) {
    case "High":   return C.mint;
    case "Medium": return C.g56;
    case "Low":    return C.g14;
  }
}
