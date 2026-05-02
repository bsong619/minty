import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop, Circle } from "react-native-svg";
import { Image } from "expo-image";
import { useAuth } from "@/components/auth-provider";
import { getScannedCards } from "@/lib/card-service";
import { getCards } from "@/lib/storage";
import { GradedCard } from "@/lib/types";
import { CardArt, artKindFor } from "@/components/card-art";
import { C, FONT } from "@/lib/theme";

const HORIZ = 20;
const PERIODS = ["1W", "1M", "3M", "1Y", "ALL"] as const;

export default function TrendsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userId } = useAuth();
  const [cards, setCards] = useState<GradedCard[]>([]);
  const [period, setPeriod] = useState<typeof PERIODS[number]>("1M");

  useEffect(() => {
    (async () => {
      try {
        if (userId) setCards(await getScannedCards(userId));
        else setCards(await getCards());
      } catch {}
    })();
  }, [userId]);

  // Placeholder portfolio math — replace with real market data once integrated.
  const totalValue = cards.reduce((sum, c) => sum + estValueFor(c), 0);
  const monthChange = Math.round(totalValue * 0.066);
  const monthPct = totalValue > 0 ? 6.6 : 0;
  const topMovers = cards.slice(0, 3);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 100, paddingTop: 6 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={{ paddingHorizontal: HORIZ, paddingTop: 12 }}>
        <Text style={{ fontFamily: FONT.display, fontSize: 30, color: C.text, lineHeight: 30, letterSpacing: -0.5 }}>Trends</Text>
        <Text style={{ fontSize: 12, color: C.textSecondary, marginTop: 4 }}>Track your portfolio · climb the board</Text>
      </View>

      {/* Portfolio card */}
      <View style={{ paddingHorizontal: HORIZ, paddingTop: 16 }}>
        <View style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16, overflow: "hidden" }}>
          <Text style={{ fontFamily: FONT.monoBold, fontSize: 9, color: C.textTertiary, letterSpacing: 1 }}>PORTFOLIO VALUE</Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 4 }}>
            <Text style={{ fontFamily: FONT.display, fontSize: 36, color: C.text, lineHeight: 36, letterSpacing: -1 }}>${totalValue.toLocaleString()}</Text>
            {monthChange > 0 && (
              <Text style={{ fontSize: 13, color: C.mint, fontFamily: FONT.uiBold }}>↑ +${monthChange.toLocaleString()}</Text>
            )}
          </View>
          {totalValue > 0 ? (
            <Text style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>+{monthPct.toFixed(1)}% this month</Text>
          ) : (
            <Text style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>Scan cards to start tracking value</Text>
          )}

          {/* Mini chart */}
          <View style={{ marginTop: 12, height: 80 }}>
            <Svg width="100%" height={80} viewBox="0 0 320 80" preserveAspectRatio="none">
              <Defs>
                <SvgLinearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={C.mint} stopOpacity={0.4} />
                  <Stop offset="100%" stopColor={C.mint} stopOpacity={0} />
                </SvgLinearGradient>
              </Defs>
              <Path d="M0,60 L25,55 L50,58 L75,48 L100,52 L125,42 L150,46 L175,38 L200,42 L225,32 L250,28 L275,24 L300,18 L320,12 L320,80 L0,80 Z" fill="url(#chart-fill)" />
              <Path d="M0,60 L25,55 L50,58 L75,48 L100,52 L125,42 L150,46 L175,38 L200,42 L225,32 L250,28 L275,24 L300,18 L320,12" stroke={C.mint} strokeWidth={2} fill="none" />
              <Circle cx={320} cy={12} r={4} fill={C.mint} />
              <Circle cx={320} cy={12} r={8} fill={C.mint} opacity={0.3} />
            </Svg>
          </View>

          <View style={{ flexDirection: "row", gap: 4, marginTop: 8 }}>
            {PERIODS.map((p) => {
              const active = period === p;
              return (
                <Pressable
                  key={p}
                  onPress={() => setPeriod(p)}
                  style={({ pressed }) => ({
                    flex: 1, paddingVertical: 6, alignItems: "center", borderRadius: 8,
                    backgroundColor: active ? C.mintFaint : "transparent",
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{ fontFamily: FONT.monoBold, fontSize: 11, color: active ? C.mint : C.textSecondary }}>{p}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {/* Friend leaderboard */}
      <View style={{ paddingHorizontal: HORIZ, paddingTop: 16 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <Text style={{ fontSize: 14, fontFamily: FONT.uiBold, color: C.text }}>Friends · this month</Text>
          {cards.length > 0 && (
            <Text style={{ fontFamily: FONT.monoBold, fontSize: 9, color: C.gold, letterSpacing: 1 }}>★ TOP 12%</Text>
          )}
        </View>
        <View style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, overflow: "hidden" }}>
          {cards.length === 0 ? (
            <View style={{ padding: 24, alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 13, color: C.textSecondary, textAlign: "center" }}>Add friends to compare your collection</Text>
              <Text style={{ fontSize: 11, color: C.textTertiary, textAlign: "center" }}>Coming soon</Text>
            </View>
          ) : (
            sampleLeaderboard().map((p, i, arr) => (
              <View key={p.rank} style={{
                flexDirection: "row", alignItems: "center", gap: 10,
                paddingVertical: 12, paddingHorizontal: 14,
                borderBottomWidth: i === arr.length - 1 ? 0 : 1, borderBottomColor: C.borderSubtle,
                backgroundColor: p.you ? C.mintFaint : "transparent",
              }}>
                <Text style={{ width: 22, textAlign: "center", fontFamily: FONT.display, fontSize: 18, color: p.rank === 1 ? C.gold : p.you ? C.mint : C.textSecondary }}>{p.rank}</Text>
                <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.bgRaised, borderWidth: 1, borderColor: C.border, justifyContent: "center", alignItems: "center" }}>
                  <Text style={{ fontSize: 11, fontFamily: FONT.uiBold, color: C.textSecondary }}>{p.name[0]}</Text>
                </View>
                <Text style={{ flex: 1, fontSize: 13, fontFamily: p.you ? FONT.uiBold : "Inter_600SemiBold", color: C.text }}>{p.name}</Text>
                <Text style={{ fontFamily: FONT.mono, fontSize: 10, color: C.textTertiary, letterSpacing: 0.3 }}>★ {p.gems}</Text>
                <Text style={{ fontFamily: FONT.display, fontSize: 18, color: C.text, width: 30, textAlign: "right", lineHeight: 18 }}>{p.grade}</Text>
              </View>
            ))
          )}
        </View>
      </View>

      {/* Top movers */}
      {topMovers.length > 0 && (
        <View style={{ paddingHorizontal: HORIZ, paddingTop: 16 }}>
          <Text style={{ fontSize: 14, fontFamily: FONT.uiBold, color: C.text, marginBottom: 10 }}>Top movers in your vault</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {topMovers.map((c, i) => {
              const change = i === 2 ? "↓ -3.2%" : i === 0 ? "↑ +18%" : "↑ +12%";
              const changeColor = i === 2 ? C.danger : C.mint;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => router.push({ pathname: "/(tabs)/(collection)/details", params: { cardId: c.id } } as any)}
                  style={{ flex: 1, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 10 }}
                >
                  <View style={{ borderRadius: 6, overflow: "hidden", marginBottom: 8 }}>
                    {c.imageUri ? (
                      <Image source={{ uri: c.imageUri }} style={{ width: "100%", height: 70, borderRadius: 6 }} contentFit="cover" />
                    ) : (
                      <CardArt kind={artKindFor(c.result.cardName)} width={96} height={70} />
                    )}
                  </View>
                  <Text numberOfLines={1} style={{ fontSize: 10, color: C.textSecondary }}>{c.result.cardName}</Text>
                  <Text style={{ fontFamily: FONT.monoBold, fontSize: 11, color: changeColor, marginTop: 2 }}>{change}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function sampleLeaderboard() {
  return [
    { rank: 1, name: "Marcus T.", grade: "9.4", gems: 7, you: false },
    { rank: 2, name: "You",       grade: "9.2", gems: 4, you: true  },
    { rank: 3, name: "Aisha K.",  grade: "9.0", gems: 3, you: false },
    { rank: 4, name: "Devin P.",  grade: "8.8", gems: 2, you: false },
  ];
}

function estValueFor(c: GradedCard): number {
  // Rough placeholder: $400 for 10s, $150 for 9s, $50 for 8s, $20 otherwise.
  const g = c.result.overallGrade;
  if (g >= 9.5) return 400;
  if (g >= 9)   return 150;
  if (g >= 8)   return 50;
  return 20;
}
