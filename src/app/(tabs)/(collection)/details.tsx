import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import GradeBadge from "@/components/grade-badge";
import SubGradeBar from "@/components/sub-grade-bar";
import { getGradeColor, getConfidenceColor } from "@/lib/grade-colors";
import { getCards, toggleFavorite as localToggleFavorite, deleteCard as localDeleteCard } from "@/lib/storage";
import { getScannedCardById, toggleFavorite as sbToggleFavorite, deleteScannedCard } from "@/lib/card-service";
import { useAuth } from "@/components/auth-provider";
import { GradedCard } from "@/lib/types";
import { C, SHADOW } from "@/lib/theme";

const GRADE_LABELS: Record<number, string> = { 10: "Gem Mint ✨", 9: "Mint", 8: "Near Mint-Mint", 7: "Near Mint", 6: "Excellent-Mint", 5: "Excellent", 4: "Very Good-Excellent", 3: "Very Good", 2: "Good", 1: "Poor" };

export default function DetailsScreen() {
  const { cardId } = useLocalSearchParams<{ cardId: string }>();
  const router = useRouter();
  const { userId } = useAuth();
  const insets = useSafeAreaInsets();
  const [card, setCard] = useState<GradedCard | null>(null);
  const [heroUrl, setHeroUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (userId) getScannedCardById(cardId).then((c) => { if (c) { setCard(c); setHeroUrl(c.imageUri); } });
    else getCards().then((cards) => { const found = cards.find((c) => c.id === cardId); if (found) { setCard(found); setHeroUrl(found.imageUri); } });
  }, [cardId, userId]);

  const handleDelete = () => {
    Alert.alert("Delete Card", "Remove this card from your collection?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          if (userId) await deleteScannedCard(userId, card!.id);
          else await localDeleteCard(card!.id);
          router.replace("/(tabs)/(collection)" as any);
        } catch (e: any) {
          console.error("Delete failed:", e);
          Alert.alert("Delete Failed", e?.message ?? "Could not delete card. Please try again.");
        }
      }},
    ]);
  };

  if (!card) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: C.textSecondary }}>Loading…</Text>
      </View>
    );
  }

  const { result } = card;
  const gradeColor = getGradeColor(result.overallGrade);
  const confidenceColor = getConfidenceColor(result.confidence);
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: insets.bottom + 24 }}
    >
      {/* Hero */}
      <View style={{ alignItems: "center", gap: 16, paddingVertical: 8 }}>
        <View style={{ borderRadius: 16, borderCurve: "continuous", overflow: "hidden", boxShadow: SHADOW.hero }}>
          <Image
            source={{ uri: heroUrl }}
            style={{ width: 200, height: 280, borderRadius: 16 }}
            contentFit="cover"
            onError={() => {}}
          />
        </View>
        <GradeBadge grade={result.overallGrade} size="large" />
        <View style={{ alignItems: "center", gap: 6 }}>
          <Text style={{ fontSize: 26, fontWeight: "800", color: gradeColor, letterSpacing: -0.5 }}>
            Grade {result.overallGrade} — {GRADE_LABELS[result.overallGrade] ?? ""}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 100, backgroundColor: "transparent", borderWidth: 1, borderColor: confidenceColor }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: confidenceColor }} />
            <Text style={{ fontSize: 13, color: confidenceColor, fontWeight: "600" }}>{result.confidence} Confidence</Text>
          </View>
        </View>
      </View>

      {/* Card Info */}
      <View style={{ borderRadius: 20, borderCurve: "continuous", backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, padding: 18, gap: 6 }}>
        <Text selectable style={{ fontSize: 20, fontWeight: "700", color: C.text, letterSpacing: -0.3 }}>{result.cardName}</Text>
        <Text selectable style={{ fontSize: 14, color: C.textSecondary }}>{result.cardSet} ({result.cardYear}) · #{result.cardNumber}</Text>
        <Text style={{ fontSize: 13, color: C.textTertiary, marginTop: 2 }}>
          Scanned {new Date(card.timestamp).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </Text>
      </View>

      {/* Sub-grades */}
      <View style={{ borderRadius: 20, borderCurve: "continuous", backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, padding: 18, gap: 14 }}>
        <Text style={{ fontSize: 11, fontWeight: "600", color: C.textTertiary, textTransform: "uppercase", letterSpacing: 0.8 }}>Sub-Grade Breakdown</Text>
        <SubGradeBar label="Centering" score={result.subGrades.centering} detail={`${result.centeringDetail.leftRight} LR · ${result.centeringDetail.topBottom} TB`} />
        <SubGradeBar label="Corners" score={result.subGrades.corners} />
        <SubGradeBar label="Edges" score={result.subGrades.edges} />
        <SubGradeBar label="Surface" score={result.subGrades.surface} />
      </View>

      {/* Tips */}
      {result.tips.length > 0 && (
        <View style={{ borderRadius: 20, borderCurve: "continuous", backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, padding: 18, gap: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: "600", color: C.textTertiary, textTransform: "uppercase", letterSpacing: 0.8 }}>Grade-Up Tips</Text>
          {result.tips.map((tip, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.goldFaint, justifyContent: "center", alignItems: "center", marginTop: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: C.gold }}>{i + 1}</Text>
              </View>
              <Text selectable style={{ fontSize: 14, color: C.textSecondary, lineHeight: 20, flex: 1 }}>{tip}</Text>
            </View>
          ))}
        </View>
      )}

      <Text selectable style={{ fontSize: 11, color: C.textTertiary, textAlign: "center", lineHeight: 16, paddingHorizontal: 8 }}>
        AI estimate only — not an official grade. Results may differ from professional grading services. Do not rely on this for purchase or sale decisions.
      </Text>

      {/* Actions */}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable
          onPress={async () => {
            const newVal = !card.favorite;
            if (userId) await sbToggleFavorite(card.id, newVal);
            else await localToggleFavorite(card.id);
            setCard({ ...card, favorite: newVal });
          }}
          style={({ pressed }) => ({
            flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
            padding: 15, borderRadius: 16, borderCurve: "continuous",
            backgroundColor: card.favorite ? "rgba(255,59,48,0.12)" : C.surface,
            borderWidth: 1, borderColor: card.favorite ? "rgba(255,59,48,0.4)" : C.border,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text style={{ fontSize: 18 }}>{card.favorite ? "❤️" : "🤍"}</Text>
          <Text style={{ fontSize: 15, fontWeight: "600", color: card.favorite ? "#FF3B30" : C.textSecondary }}>{card.favorite ? "Saved" : "Save"}</Text>
        </Pressable>
        <Pressable
          onPress={handleDelete}
          style={({ pressed }) => ({
            flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
            padding: 15, borderRadius: 16, borderCurve: "continuous",
            backgroundColor: "rgba(255,107,107,0.08)", borderWidth: 1, borderColor: "rgba(255,107,107,0.2)",
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text style={{ fontSize: 18 }}>🗑️</Text>
          <Text style={{ fontSize: 15, fontWeight: "600", color: "#FF3B30" }}>Delete</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
