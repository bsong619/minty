import { View, Text } from "react-native";
import { getGradeColor } from "@/lib/grade-colors";
import { C } from "@/lib/theme";

export default function SubGradeBar({
  label,
  score,
  detail,
}: {
  label: string;
  score: number;
  detail?: string;
}) {
  const color = getGradeColor(Math.round(score));
  const percentage = (score / 10) * 100;

  return (
    <View style={{ gap: 4 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: "600", color: C.text }}>
          {label}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
          {detail && (
            <Text
              style={{
                fontSize: 11,
                color: C.textTertiary,
              }}
            >
              {detail}
            </Text>
          )}
          <Text
            style={{
              fontSize: 17,
              fontWeight: "700",
              color,
              fontVariant: ["tabular-nums"],
            }}
          >
            {score.toFixed(1)}
          </Text>
        </View>
      </View>
      <View
        style={{
          height: 5,
          borderRadius: 3,
          backgroundColor: C.white06,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            height: "100%",
            width: `${percentage}%`,
            borderRadius: 3,
            backgroundColor: color,
          }}
        />
      </View>
    </View>
  );
}
