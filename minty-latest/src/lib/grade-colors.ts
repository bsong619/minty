export function getGradeColor(grade: number): string {
  if (grade === 10) return "#FFD700"; // Gold — Gem Mint
  if (grade === 9)  return "#3DD68C"; // Green — Mint
  if (grade >= 7)   return "#5B9CF5"; // Blue — solid
  if (grade >= 5)   return "#F5A623"; // Orange — decent
  return "#FF4444";                    // Red — needs work
}

export function getConfidenceColor(
  confidence: "High" | "Medium" | "Low"
): string {
  switch (confidence) {
    case "High":   return "#3DD68C";
    case "Medium": return "#F5A623";
    case "Low":    return "#FF4444";
  }
}
