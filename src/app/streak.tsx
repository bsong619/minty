import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Icon } from "@/components/icon";
import { C, FONT, SHADOW } from "@/lib/theme";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"] as const;

export default function StreakScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Placeholder data — wire to user_streaks table later.
  const currentStreak = 0;
  const todayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
  const daysToReward = Math.max(30 - currentStreak, 0);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <LinearGradient
        colors={[`${C.gold}30`, "transparent"]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 320 }}
      />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32, paddingHorizontal: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Icon name="close" size={20} color={C.text} />
          </Pressable>
          <Text style={{ fontFamily: FONT.mono, fontSize: 11, color: C.textSecondary, letterSpacing: 1 }}>STREAK</Text>
          <View style={{ width: 20 }} />
        </View>

        {/* Big flame */}
        <View style={{ alignItems: "center" }}>
          <View style={{ position: "relative" }}>
            <View style={{
              position: "absolute", left: -40, right: -40, top: -20, bottom: -20,
              borderRadius: 200,
              backgroundColor: `${C.gold}1F`,
            }} />
            <Text style={{ fontSize: 100 }}>🔥</Text>
          </View>
          <Text style={{ fontFamily: FONT.display, fontSize: 80, color: C.gold, lineHeight: 80, letterSpacing: -3, marginTop: 4 }}>{currentStreak}</Text>
          <Text style={{ fontSize: 16, color: C.text, fontFamily: FONT.uiBold, marginTop: 4 }}>day streak</Text>
          <Text style={{ fontSize: 13, color: C.textSecondary, textAlign: "center", marginTop: 8, lineHeight: 19, maxWidth: 280 }}>
            {currentStreak === 0
              ? "Scan a card today to start your streak. Keep it going for rewards."
              : `You've scanned at least one card every day for ${spell(currentStreak)}. Keep it going!`}
          </Text>
        </View>

        {/* 7-day grid */}
        <View style={{ flexDirection: "row", gap: 6, marginTop: 28, justifyContent: "center" }}>
          {DAYS.map((d, i) => {
            const done = i < todayIndex && currentStreak > i;
            const today = i === todayIndex;
            return (
              <View key={i} style={{ alignItems: "center", gap: 6 }}>
                <View style={{
                  width: 38, height: 38, borderRadius: 12,
                  backgroundColor: done ? C.mint : today ? "transparent" : C.surface,
                  borderWidth: today ? 2 : 1,
                  borderColor: today ? C.mint : C.border,
                  borderStyle: today ? "dashed" : "solid",
                  justifyContent: "center", alignItems: "center",
                }}>
                  {done && <Icon name="check" size={18} color={C.onMint} strokeWidth={3} />}
                  {today && <Text style={{ fontSize: 16 }}>🔥</Text>}
                </View>
                <Text style={{ fontSize: 10, color: done || today ? C.text : C.textTertiary, fontFamily: FONT.monoBold }}>{d}</Text>
              </View>
            );
          })}
        </View>

        {/* Reward */}
        <View style={{
          marginTop: 28, padding: 16, borderRadius: 14,
          backgroundColor: C.surface, borderWidth: 1, borderColor: `${C.gold}55`,
          flexDirection: "row", alignItems: "center", gap: 12,
        }}>
          <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: C.goldFaint, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ fontSize: 24 }}>🎁</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontFamily: FONT.uiBold, color: C.text }}>Reward at 30 days</Text>
            <Text style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>1 free Pro market scan</Text>
          </View>
          <Text style={{ fontFamily: FONT.monoBold, fontSize: 11, color: C.gold }}>{daysToReward}d</Text>
        </View>

        <Pressable
          onPress={() => router.dismissTo("/(tabs)/(scan)" as any)}
          style={({ pressed }) => ({
            marginTop: 16, paddingVertical: 14, borderRadius: 12,
            backgroundColor: C.mint, alignItems: "center",
            opacity: pressed ? 0.85 : 1,
            ...({ boxShadow: SHADOW.glow } as any),
          })}
        >
          <Text style={{ fontFamily: FONT.uiBold, fontSize: 14, color: C.onMint }}>Scan today&apos;s card</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function spell(n: number): string {
  if (n <= 1) return "1 day";
  if (n < 7) return `${n} days`;
  if (n < 14) return "a week";
  if (n < 30) return `${Math.round(n / 7)} weeks`;
  return `${Math.round(n / 30)} months`;
}
