import { View, Text, Pressable } from "react-native";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Icon } from "@/components/icon";
import { C, FONT, SHADOW } from "@/lib/theme";
import { getQuota, FREE_DAILY_LIMIT } from "@/lib/scan-quota";

// Modal shown when a free user tries to scan a 6th card in 24h.
// Push it from any scan trigger via router.push("/scan-limit").

export default function ScanLimitScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [used, setUsed] = useState(FREE_DAILY_LIMIT);

  useEffect(() => {
    getQuota().then((q) => setUsed(q.used));
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <LinearGradient
        colors={[`${C.mint}30`, "transparent"]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 360 }}
      />

      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Icon name="close" size={20} color={C.text} />
        </Pressable>
        <View style={{ width: 20 }} />
      </View>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, paddingBottom: insets.bottom + 24 }}>
        {/* Glow icon */}
        <View style={{ marginBottom: 24, alignItems: "center", justifyContent: "center" }}>
          <View style={{
            position: "absolute", width: 140, height: 140, borderRadius: 70,
            backgroundColor: C.mint, opacity: 0.18,
            ...({ filter: "blur(30px)" } as any),
          }} />
          <View style={{
            width: 80, height: 80, borderRadius: 24,
            backgroundColor: C.mintFaint, borderWidth: 1, borderColor: C.mint,
            justifyContent: "center", alignItems: "center",
          }}>
            <Icon name="sparkles" size={36} color={C.mint} strokeWidth={1.8} />
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 100, backgroundColor: C.surface, borderWidth: 1, borderColor: C.mintFaint, marginBottom: 16 }}>
          <Text style={{ fontFamily: FONT.monoBold, fontSize: 10, color: C.mint, letterSpacing: 1 }}>FREE LIMIT REACHED</Text>
        </View>

        <Text style={{ fontFamily: FONT.display, fontSize: 36, color: C.text, lineHeight: 42, textAlign: "center", marginBottom: 12, paddingHorizontal: 12 }}>
          You&apos;ve used your{"\n"}{FREE_DAILY_LIMIT} daily scans
        </Text>
        <Text style={{ fontSize: 14, color: C.textSecondary, lineHeight: 20, textAlign: "center", maxWidth: 300, marginBottom: 28 }}>
          Come back tomorrow for another {FREE_DAILY_LIMIT} free scans. Your collection stays here while you wait.
        </Text>

        {/* Quota dots */}
        <View style={{ flexDirection: "row", gap: 6, marginBottom: 28 }}>
          {Array.from({ length: FREE_DAILY_LIMIT }).map((_, i) => (
            <View key={i} style={{
              width: 8, height: 8, borderRadius: 4,
              backgroundColor: i < used ? C.mint : C.surface,
              borderWidth: 1, borderColor: i < used ? C.mint : C.border,
            }} />
          ))}
        </View>

        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => ({
            width: "100%", maxWidth: 320, paddingVertical: 16, borderRadius: 14,
            backgroundColor: C.mint, alignItems: "center",
            opacity: pressed ? 0.85 : 1,
            ...({ boxShadow: SHADOW.glow } as any),
          })}
        >
          <Text style={{ fontFamily: FONT.uiBold, fontSize: 15, color: C.onMint }}>Got it</Text>
        </Pressable>
      </View>
    </View>
  );
}
