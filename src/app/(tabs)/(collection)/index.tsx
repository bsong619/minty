import { useCallback, useState, useMemo } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Image } from "expo-image";
import { getCards } from "@/lib/storage";
import { getScannedCards, refreshCardImageUrls } from "@/lib/card-service";
import { useAuth } from "@/components/auth-provider";
import { GradedCard } from "@/lib/types";
import { CardArt, artKindFor } from "@/components/card-art";
import { HoloFoil } from "@/components/holo-foil";
import { Icon } from "@/components/icon";
import { C, FONT } from "@/lib/theme";
import { getGradeColor } from "@/lib/grade-colors";

const PADDING = 20;
const GAP = 8;
const COLUMNS = 3;
const MAX_CONTENT_WIDTH = 640;

const FILTERS = ["All", "Favorites"] as const;
type Filter = typeof FILTERS[number];

export default function VaultScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const effectiveWidth = Math.min(screenWidth, MAX_CONTENT_WIDTH);
  const cardWidth = (effectiveWidth - PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS;
  const cardHeight = Math.round(cardWidth / 0.72);
  const insets = useSafeAreaInsets();
  const [cards, setCards] = useState<GradedCard[]>([]);
  const [filter, setFilter] = useState<Filter>("All");
  const [refreshing, setRefreshing] = useState(false);

  const loadCards = useCallback(async () => {
    try {
      if (userId) {
        let loaded = await getScannedCards(userId);
        loaded = await refreshCardImageUrls(loaded);
        setCards(loaded);
      } else {
        setCards(await getCards());
      }
    } catch {}
  }, [userId]);

  useFocusEffect(useCallback(() => { loadCards(); }, [loadCards]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCards();
    setRefreshing(false);
  }, [loadCards]);

  const filtered = useMemo(() => {
    switch (filter) {
      case "Favorites": return cards.filter((c) => c.favorite);
      default:          return cards;
    }
  }, [cards, filter]);

  // Per-card estimated value comes from `card.estimatedValue` (avg of last 5
  // sold listings from eBay, cached at scan time). Cards scanned before the
  // pricing service was wired up will be missing this field — they contribute 0.
  const totalValue = cards.reduce((sum, c) => sum + ((c as any).estimatedValue ?? 0), 0);
  const pricedCount = cards.filter((c) => (c as any).estimatedValue != null).length;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ paddingBottom: 24, paddingTop: 6, alignItems: "center" }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.mint} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ width: "100%", maxWidth: MAX_CONTENT_WIDTH }}>
      {/* Header */}
      <View style={{ paddingHorizontal: PADDING, paddingTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flexShrink: 1 }}>
          <Text style={{ fontFamily: FONT.display, fontSize: 30, color: C.text, lineHeight: 34, letterSpacing: -0.5 }}>The Vault</Text>
          <Text style={{ fontSize: 12, color: C.textSecondary, marginTop: 4 }}>
            {cards.length} card{cards.length === 1 ? "" : "s"}
          </Text>
        </View>
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, justifyContent: "center", alignItems: "center" }}>
          <Icon name="filter" size={16} color={C.text} />
        </View>
      </View>

      {/* Vault value card */}
      {cards.length > 0 && (
        <View style={{ marginHorizontal: PADDING, marginTop: 14, padding: 16, borderRadius: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border }}>
          <Text style={{ fontFamily: FONT.monoBold, fontSize: 10, color: C.textTertiary, letterSpacing: 1.5 }}>ESTIMATED VALUE</Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 6 }}>
            <Text style={{ fontFamily: FONT.display, fontSize: 32, color: C.mint, lineHeight: 36 }}>
              {pricedCount > 0 ? `$${totalValue.toLocaleString()}` : "—"}
            </Text>
            {pricedCount > 0 && pricedCount < cards.length && (
              <Text style={{ fontSize: 11, color: C.textTertiary }}>
                ({pricedCount} of {cards.length} priced)
              </Text>
            )}
          </View>
          <Text style={{ fontSize: 11, color: C.textTertiary, marginTop: 4 }}>
            {pricedCount > 0
              ? "Based on avg. of last 5 sold listings"
              : "Market values coming soon"}
          </Text>
        </View>
      )}

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingHorizontal: PADDING, paddingTop: 14 }}
      >
        {FILTERS.map((f) => {
          const active = filter === f;
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={({ pressed }) => ({
                paddingVertical: 6, paddingHorizontal: 12, borderRadius: 100,
                backgroundColor: active ? C.mint : C.surface,
                borderWidth: active ? 0 : 1, borderColor: C.border,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontSize: 12, fontFamily: FONT.uiBold, color: active ? C.onMint : C.textSecondary, paddingHorizontal: 2 }}>{f}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <View style={{ paddingHorizontal: PADDING, paddingTop: 60, alignItems: "center", gap: 16 }}>
          <View style={{ width: 80, height: 80, borderRadius: 22, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, justifyContent: "center", alignItems: "center" }}>
            <Icon name="stack" size={32} color={C.mint} strokeWidth={1.5} />
          </View>
          <Text style={{ fontSize: 17, fontFamily: FONT.uiBold, color: C.textSecondary, textAlign: "center", alignSelf: "stretch", paddingHorizontal: 4 }}>
            {filter === "All" || cards.length === 0 ? "No scans yet" : "Nothing favorited yet"}
          </Text>
          <Text style={{ fontSize: 13, color: C.textTertiary, textAlign: "center", lineHeight: 20, maxWidth: 280 }}>
            {filter === "All" || cards.length === 0
              ? "Scan your first card to start collecting!"
              : "Tap the heart on any card in your vault to favorite it."}
          </Text>
          <Pressable
            onPress={() => router.push("/(tabs)/(scan)" as any)}
            style={({ pressed }) => ({
              marginTop: 8, paddingVertical: 12, paddingHorizontal: 22, borderRadius: 12,
              backgroundColor: C.mint, opacity: pressed ? 0.85 : 1,
              flexDirection: "row", alignItems: "center", gap: 8,
            })}
          >
            <Icon name="camera" size={15} color={C.onMint} strokeWidth={2.5} />
            <Text style={{ fontFamily: FONT.uiBold, color: C.onMint, fontSize: 14, paddingRight: 4 }}>Scan a card</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ paddingHorizontal: PADDING, paddingTop: 16, flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
          {filtered.map((card) => {
            const grade = card.result.overallGrade;
            const color = getGradeColor(grade);
            return (
              <Pressable
                key={card.id}
                onPress={() => router.push({ pathname: "/(tabs)/(collection)/details", params: { cardId: card.id } } as any)}
                style={({ pressed }) => ({ width: cardWidth, opacity: pressed ? 0.85 : 1 })}
              >
                <View style={{ borderRadius: 10, overflow: "hidden", position: "relative" }}>
                  {card.imageUri ? (
                    <Image source={{ uri: card.imageUri }} style={{ width: cardWidth, height: cardHeight, borderRadius: 10 }} contentFit="cover" />
                  ) : (
                    <CardArt kind={artKindFor(card.result.cardName)} width={cardWidth} height={cardHeight} />
                  )}
                  {grade >= 9.5 && <HoloFoil intensity={0.35} />}
                  <View style={{
                    position: "absolute", top: 5, right: 5,
                    minWidth: 30, height: 30, paddingHorizontal: 7, borderRadius: 15,
                    backgroundColor: color,
                    justifyContent: "center", alignItems: "center",
                  }}>
                    <Text style={{ fontFamily: FONT.uiHeavy, fontSize: 13, color: "#0A0A0C", textAlign: "center", includeFontPadding: false }}>{grade}</Text>
                  </View>
                  {card.favorite && (
                    <View style={{
                      position: "absolute", top: 5, left: 5,
                      width: 22, height: 22, borderRadius: 11,
                      backgroundColor: "rgba(11,13,14,0.85)",
                      justifyContent: "center", alignItems: "center",
                    }}>
                      <Icon name="heart" size={12} color={C.mint} fill={C.mint} strokeWidth={2} />
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
      </View>
    </ScrollView>
  );
}
