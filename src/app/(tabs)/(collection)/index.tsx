import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import CollectionCard from "@/components/collection-card";
import { getCards } from "@/lib/storage";
import { getScannedCards } from "@/lib/card-service";
import { useAuth } from "@/components/auth-provider";
import { refreshCardImageUrls } from "@/lib/card-service";
import { GradedCard } from "@/lib/types";
import { C } from "@/lib/theme";

const COLUMNS = 2;
const PADDING = 16;
const GAP = 10;

export default function CollectionScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = (screenWidth - PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS;
  const insets = useSafeAreaInsets();
  const [cards, setCards] = useState<GradedCard[]>([]);
  const [filter, setFilter] = useState<"all" | "favorites">("all");
  const [refreshing, setRefreshing] = useState(false);

  const loadCards = useCallback(async () => {
    if (userId) {
      let loaded = await getScannedCards(userId);
      // Refresh broken Supabase image URLs with signed URLs
      loaded = await refreshCardImageUrls(loaded);
      setCards(loaded);

    } else {
      setCards(await getCards());
    }
  }, [userId]);

  useFocusEffect(useCallback(() => { loadCards(); }, [loadCards]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCards();
    setRefreshing(false);
  }, [loadCards]);

  const filteredCards = filter === "favorites" ? cards.filter((c) => c.favorite) : cards;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ padding: PADDING, gap: 14, paddingBottom: insets.bottom + 90, flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.red} />}
    >
      {/* Filter pills */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {(["all", "favorites"] as const).map((f) => (
          <Pressable
            key={f} onPress={() => setFilter(f)}
            style={({ pressed }) => ({
              paddingHorizontal: 20, paddingVertical: 8, borderRadius: 100,
              backgroundColor: filter === f ? C.red : C.surface,
              borderWidth: 1, borderColor: filter === f ? C.red : C.border,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={{ fontSize: 13, fontWeight: "600", color: filter === f ? "white" : C.textSecondary }}>
              {f === "all" ? `All  ${cards.length}` : `Favorites  ${cards.filter(c => c.favorite).length}`}
            </Text>
          </Pressable>
        ))}
      </View>

      {filteredCards.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16 }}>
          <View style={{ width: 80, height: 80, borderRadius: 22, borderCurve: "continuous", backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ fontSize: 32 }}>✨</Text>
          </View>
          <Text style={{ fontSize: 17, fontWeight: "600", color: C.textSecondary, textAlign: "center" }}>
            {filter === "favorites" ? "No Favorites Yet" : "Your Collection Is Empty"}
          </Text>
          <Text style={{ fontSize: 14, color: C.textTertiary, textAlign: "center", lineHeight: 20 }}>
            {filter === "favorites" ? "Save a graded card to see it here." : "Scan your first card and start collecting!"}
          </Text>
        </View>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
          {filteredCards.map((card) => (
            <CollectionCard
              key={card.id}
              card={card}
              width={cardWidth}
              onPress={() => router.push({ pathname: "/(tabs)/(collection)/details", params: { cardId: card.id } })}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}
