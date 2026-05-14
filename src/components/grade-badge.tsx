import { View, Text } from "react-native";
import { getGradeColor } from "@/lib/grade-colors";
import { FONT } from "@/lib/theme";

// Circular grade badge used on Results and Pack Reveal. Display-serif numeric.
export default function GradeBadge({
  grade,
  size = "large",
}: {
  grade: number;
  size?: "small" | "medium" | "large";
}) {
  const color = getGradeColor(grade);
  const dim = size === "large" ? 128 : size === "medium" ? 72 : 40;
  const outer = dim + 8;
  const fontSize = size === "large" ? 64 : size === "medium" ? 36 : 18;
  const labelSize = size === "large" ? 10 : size === "medium" ? 9 : 0;
  const borderWidth = size === "large" ? 4 : size === "medium" ? 3 : 2;

  // Round to a max of 1 decimal — 9.5 stays "9.5", 10 stays "10".
  const display = Number.isInteger(grade) ? `${grade}` : `${Math.round(grade * 2) / 2}`;

  return (
    <View style={{
      width: outer, height: outer, borderRadius: outer / 2,
      borderWidth: 1.5, borderColor: `${color}25`,
      justifyContent: "center", alignItems: "center",
    }}>
      <View style={{
        width: dim, height: dim, borderRadius: dim / 2,
        borderWidth, borderColor: color,
        backgroundColor: `${color}18`,
        justifyContent: "center", alignItems: "center",
        ...({ boxShadow: `0px 0px 28px ${color}50` } as any),
      }}>
        {labelSize > 0 && (
          <Text style={{
            position: "absolute", top: dim * 0.18,
            fontSize: labelSize, fontFamily: FONT.monoBold, color,
            letterSpacing: 2,
          }}>GRADE</Text>
        )}
        <Text style={{
          fontSize, fontFamily: FONT.display, color,
          letterSpacing: -2, lineHeight: fontSize,
          textAlign: "center", includeFontPadding: false,
        }}>
          {display}
        </Text>
      </View>
    </View>
  );
}
