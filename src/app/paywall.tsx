import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Icon, type IconName } from "@/components/icon";
import { C, FONT, SHADOW } from "@/lib/theme";

// Design-only paywall. The app is currently free (no IAP wired). When you're
// ready to monetize, install react-native-purchases (RevenueCat), add product
// IDs in App Store Connect, and replace `handleSubscribe` with the SDK call.
const FEATURES: { i: IconName; t: string; d: string }[] = [
  { i: "infinity",  t: "Unlimited scans",      d: "Free tier: 5 / day" },
  { i: "trend",     t: "Live market values",   d: "Real-time prices + 30-day trends" },
  { i: "stack",     t: "Pro vault analytics",  d: "Portfolio insights & alerts" },
  { i: "share",     t: "HD share cards",       d: "Watermark-free for socials" },
  { i: "sparkles",  t: "Priority AI",          d: "Faster, more confident grades" },
];

export default function PaywallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [plan, setPlan] = useState<"annual" | "monthly">("annual");

  const handleSubscribe = () => {
    // No IAP wired yet — the app is fully free at the moment.
    Alert.alert("Pro is coming soon", "Minty is free while we finalize Pro features. Thanks for your patience!", [{ text: "OK" }]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <LinearGradient
        colors={[`${C.mint}30`, "transparent"]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 360 }}
      />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Icon name="close" size={20} color={C.text} />
          </Pressable>
          <Pressable hitSlop={8} onPress={handleSubscribe}>
            <Text style={{ fontSize: 12, color: C.mint, fontFamily: FONT.uiBold }}>Restore</Text>
          </Pressable>
        </View>

        {/* Hero */}
        <View style={{ alignItems: "center", marginTop: 18 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 5, paddingHorizontal: 12, borderRadius: 100, backgroundColor: C.surface, borderWidth: 1, borderColor: C.mintFaint }}>
            <Text style={{ fontSize: 12 }}>✦</Text>
            <Text style={{ fontFamily: FONT.monoBold, fontSize: 10, color: C.mint, letterSpacing: 1 }}>MINTY PRO</Text>
          </View>
          <Text style={{ fontFamily: FONT.display, fontSize: 44, color: C.text, lineHeight: 44, letterSpacing: -1.5, marginTop: 14, textAlign: "center" }}>
            Grade like a{"\n"}
            <Text style={{ color: C.mint, fontFamily: FONT.displayItalic }}>pro</Text>
          </Text>
          <Text style={{ fontSize: 13, color: C.textSecondary, marginTop: 8, lineHeight: 19, textAlign: "center", maxWidth: 280 }}>
            Unlimited scans, live market data, and the tools serious collectors use.
          </Text>
        </View>

        {/* Features */}
        <View style={{ marginTop: 24, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 16, overflow: "hidden" }}>
          {FEATURES.map((f, i) => (
            <View key={f.t} style={{
              flexDirection: "row", alignItems: "center", gap: 14, padding: 14,
              borderBottomWidth: i === FEATURES.length - 1 ? 0 : 1, borderBottomColor: C.borderSubtle,
            }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.mintFaint, justifyContent: "center", alignItems: "center" }}>
                <Icon name={f.i} size={16} color={C.mint} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontFamily: FONT.uiBold, color: C.text }}>{f.t}</Text>
                <Text style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>{f.d}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Plan picker */}
        <View style={{ marginTop: 16, gap: 8 }}>
          <Pressable
            onPress={() => setPlan("annual")}
            style={{
              position: "relative", padding: 16, borderRadius: 14,
              backgroundColor: plan === "annual" ? C.mintFaint : C.surface,
              borderWidth: plan === "annual" ? 2 : 1,
              borderColor: plan === "annual" ? C.mint : C.border,
            }}
          >
            <View style={{ position: "absolute", top: -10, right: 14, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 100, backgroundColor: C.gold }}>
              <Text style={{ fontFamily: FONT.monoBold, fontSize: 9, color: C.onMint, letterSpacing: 1 }}>BEST VALUE</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <Text style={{ fontSize: 14, fontFamily: FONT.uiBold, color: C.text }}>Annual</Text>
                <Text style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>$3.33/mo · billed yearly</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontFamily: FONT.display, fontSize: 24, color: plan === "annual" ? C.mint : C.text, lineHeight: 24 }}>$39.99</Text>
                <Text style={{ fontSize: 10, color: C.textTertiary, marginTop: 2, textDecorationLine: "line-through" }}>$95.88</Text>
              </View>
            </View>
          </Pressable>
          <Pressable
            onPress={() => setPlan("monthly")}
            style={{
              padding: 14, borderRadius: 14,
              backgroundColor: plan === "monthly" ? C.mintFaint : C.surface,
              borderWidth: plan === "monthly" ? 2 : 1,
              borderColor: plan === "monthly" ? C.mint : C.border,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <Text style={{ fontSize: 14, fontFamily: FONT.uiBold, color: C.text }}>Monthly</Text>
                <Text style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>Cancel anytime</Text>
              </View>
              <Text style={{ fontFamily: FONT.display, fontSize: 22, color: plan === "monthly" ? C.mint : C.text, lineHeight: 22 }}>$7.99</Text>
            </View>
          </Pressable>
        </View>

        <Pressable
          onPress={handleSubscribe}
          style={({ pressed }) => ({
            marginTop: 14, paddingVertical: 16, borderRadius: 14,
            backgroundColor: C.mint, alignItems: "center",
            opacity: pressed ? 0.85 : 1,
            ...({ boxShadow: SHADOW.glow } as any),
          })}
        >
          <Text style={{ fontFamily: FONT.uiBold, fontSize: 15, color: C.onMint }}>Start 7-day free trial</Text>
        </Pressable>
        <Text style={{ textAlign: "center", marginTop: 10, fontSize: 10, color: C.textTertiary, lineHeight: 14 }}>
          Then $39.99/year. Auto-renews until canceled.
        </Text>
      </ScrollView>
    </View>
  );
}
