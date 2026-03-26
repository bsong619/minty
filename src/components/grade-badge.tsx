import { View, Text } from "react-native";
import { getGradeColor } from "@/lib/grade-colors";

export default function GradeBadge({
  grade,
  size = "large",
}: {
  grade: number;
  size?: "small" | "medium" | "large";
}) {
  const color = getGradeColor(grade);
  const dimensions = size === "large" ? 128 : size === "medium" ? 72 : 40;
  const outerDimensions = dimensions + 8;
  const fontSize = size === "large" ? 52 : size === "medium" ? 28 : 16;
  const labelSize = size === "large" ? 11 : size === "medium" ? 9 : 0;
  const borderWidth = size === "large" ? 4 : size === "medium" ? 3 : 2;

  return (
    <View
      style={{
        width: outerDimensions,
        height: outerDimensions,
        borderRadius: outerDimensions / 2,
        borderWidth: 1.5,
        borderColor: `${color}15`,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <View
        style={{
          width: dimensions,
          height: dimensions,
          borderRadius: dimensions / 2,
          borderWidth,
          borderColor: color,
          backgroundColor: `${color}18`,
          justifyContent: "center",
          alignItems: "center",
          boxShadow: `0px 0px 28px ${color}35`,
        } as any}
      >
        {labelSize > 0 && (
          <Text
            style={{
              fontSize: labelSize,
              fontWeight: "700",
              color,
              letterSpacing: 2,
              marginBottom: -2,
            }}
          >
            PSA
          </Text>
        )}
        <Text
          style={{
            fontSize,
            fontWeight: "900",
            color,
            fontVariant: ["tabular-nums"],
          }}
        >
          {grade}
        </Text>
      </View>
    </View>
  );
}
