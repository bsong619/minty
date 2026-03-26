import { Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { C, SHADOW } from "@/lib/theme";

// Pokemon-themed emoji icons by key
const ICONS: Record<string, string> = {
  "camera.fill": "📸",
  "photo.on.rectangle": "🖼️",
  "checkmark.seal.fill": "✨",
  "viewfinder": "🎯",
};

export default function ScanButton({
  icon,
  label,
  subtitle,
  onPress,
}: {
  icon: string;
  label: string;
  subtitle: string;
  onPress: () => void;
}) {
  const emoji = ICONS[icon] ?? "🃏";

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        padding: 16,
        borderRadius: 18,
        borderCurve: "continuous",
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: pressed ? C.red : C.border,
        transform: [{ scale: pressed ? 0.985 : 1 }],
        boxShadow: SHADOW.card,
      })}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          borderCurve: "continuous",
          backgroundColor: C.redFaint,
          borderWidth: 1,
          borderColor: C.borderGlow,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 24 }}>{emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: C.text, letterSpacing: -0.2 }}>
          {label}
        </Text>
        <Text style={{ fontSize: 13, color: C.textSecondary, marginTop: 2, lineHeight: 18 }}>
          {subtitle}
        </Text>
      </View>
      <Text style={{ fontSize: 18, color: C.textDisabled }}>›</Text>
    </Pressable>
  );
}
