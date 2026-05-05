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

const FILTERS = ["All", "Gems", "Mint+", "Favorites"] as const;
type Filter = typeof FILTERS[number];

export default function VaultScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = (screenWidth - PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS;
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
      case "Gems":      return cards.filter((c) => c.result.overallGrade >= 9.5);
      case "Mint+":     return cards.filter((c) => c.result.overallGrade >= 9);
      case "Favorites": return cards.filter((c) => c.favorite);
      default:          return cards;
    }
  }, [cards, filter]);

  const totalValue = cards.length * 65; // placeholder estimate until real market data

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: insets.top + 6 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.mint} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={{ paddingHorizontal: PADDING, paddingTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View>
          <Text style={{ fontFamily: FONT.display, fontSize: 30, color: C.text, lineHeight: 30, letterSpacing: -0.5 }}>The Vault</Text>
          <Text style={{ fontSize: 12, color: C.textSecondary, marginTop: 4 }}>
            {cards.length} card{cards.length === 1 ? "" : "s"}{cards.length > 0 ? ` · est. value $${totalValue.toLocaleString()}` : ""}
          </Text>
        </View>
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, justifyContent: "center", alignItems: "center" }}>
          <Icon name="filter" size={16} color={C.text} />
        </View>
      </View>

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
              <Text style={{ fontSize: 12, fontFamily: FONT.uiBold, color: active ? C.onMint : C.textSecondary }}>{f}</Text>
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
          <Text style={{ fontSize: 17, fontFamily: FONT.uiBold, color: C.textSecondary, textAlign: "center" }}>
            {filter === "All" ? "Your vault is empty" : `No ${filter.toLowerCase()} yet`}
          </Text>
          <Text style={{ fontSize: 13, color: C.textTertiary, textAlign: "center", lineHeight: 20, maxWidth: 280 }}>
            {filter === "All"
              ? "Scan your first card to start collecting."
              : "Keep scanning — your best pulls will land here."}
          </Text>
          {filter === "All" && (
            <Pressable
              onPress={() => router.push("/(tabs)/(scan)" as any)}
              style={({ pressed }) => ({
                marginTop: 8, paddingVertical: 12, paddingHorizontal: 22, borderRadius: 12,
                backgroundColor: C.mint, opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontFamily: FONT.uiBold, color: C.onMint, fontSize: 14 }}>Scan a card</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <>
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
                      width: 28, height: 28, borderRadius: 14,
                      backgroundColor: "rgba(11,13,14,0.85)",
                      borderWidth: 1, borderColor: `${color}80`,
                      justifyContent: "center", alignItems: "center",
                    }}>
                      <Text style={{ fontFamily: FONT.display, fontSize: 14, color, lineHeight: 14 }}>{grade}</Text>
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
          {filter === "All" && cards.length > 0 && cards.length < 6 && (
            <View style={{ paddingHorizontal: PADDING, marginTop: 32 }}>
              <View style={{
                borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface,
                padding: 18, alignItems: "center", gap: 10,
              }}>
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.mintFaint, justifyContent: "center", alignItems: "center" }}>
                  <Icon name="sparkles" size={20} color={C.mint} strokeWidth={1.8} />
                </View>
                <Text style={{ fontSize: 15, fontFamily: FONT.uiBold, color: C.text, textAlign: "center" }}>Keep building your vault</Text>
                <Text style={{ fontSize: 12, color: C.textSecondary, textAlign: "center", lineHeight: 18, maxWidth: 280 }}>
                  Scan more cards to unlock Mint+ filters and gem highlights.
                </Text>
                <Pressable
                  onPress={() => router.push("/(tabs)/(scan)" as any)}
                  style={({ pressed }) => ({
                    marginTop: 4, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10,
                    borderWidth: 1, borderColor: C.mint, backgroundColor: "transparent",
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{ fontFamily: FONT.uiBold, fontSize: 13, color: C.mint }}>Scan a card</Text>
                </Pressable>
              </View>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}
