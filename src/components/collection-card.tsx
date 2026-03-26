import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import { GradedCard } from "@/lib/types";
import { getGradeColor } from "@/lib/grade-colors";
import { C, SHADOW } from "@/lib/theme";

// Assign a consistent Pokémon type color + emoji based on card name hash
function getCardTheme(name: string): { emoji: string; color: string } {
  const themes = [
    { emoji: "⚡", color: "#F7C948" }, // Electric
    { emoji: "🔥", color: "#E8622A" }, // Fire
    { emoji: "💧", color: "#4FC3F7" }, // Water
    { emoji: "🌿", color: "#5DBF5D" }, // Grass
    { emoji: "🌙", color: "#9B78E8" }, // Psychic
    { emoji: "❄️", color: "#7EC8E3" }, // Ice
    { emoji: "🐉", color: "#E04040" }, // Dragon
    { emoji: "✨", color: "#E0B0E8" }, // Fairy
    { emoji: "⚫", color: "#707080" }, // Dark
    { emoji: "🥊", color: "#D88060" }, // Fighting
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return themes[hash % themes.length];
}

function CardPlaceholder({ name, width }: { name: string; width: number }) {
  const height = width / 0.72;
  const { emoji, color } = getCardTheme(name);
  const initials = name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();

  return (
    <View style={{ width, height, backgroundColor: C.bgElevated, justifyContent: "center", alignItems: "center", gap: 8 }}>
      {/* Pokeball watermark */}
      <View style={{ position: "absolute", opacity: 0.06 }}>
        <View style={{ width: width * 1.2, height: width * 1.2, borderRadius: width * 0.6, borderWidth: 20, borderColor: "#fff", marginLeft: -width * 0.1 }} />
        <View style={{ position: "absolute", top: width * 0.6 - 8, left: -width * 0.1, width: width * 1.2, height: 16, backgroundColor: "#fff" }} />
      </View>
      <Text style={{ fontSize: 36 }}>{emoji}</Text>
      <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: `${color}22`, borderWidth: 1, borderColor: `${color}44` }}>
        <Text style={{ fontSize: 13, fontWeight: "800", color, letterSpacing: 1 }}>{initials}</Text>
      </View>
    </View>
  );
}

export default function CollectionCard({ card, onPress, width }: { card: GradedCard; onPress: () => void; width: number }) {
  const [imageFailed, setImageFailed] = useState(false);
  const gradeColor = getGradeColor(card.result.overallGrade);
  const showImage = !!card.imageUri && !imageFailed;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ width, opacity: pressed ? 0.82 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}
    >
      <View style={{ borderRadius: 16, borderCurve: "continuous", backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, overflow: "hidden", boxShadow: SHADOW.card }}>
        {showImage ? (
          <Image
            source={{ uri: card.imageUri }}
            style={{ width: "100%", aspectRatio: 0.72 }}
            contentFit="cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <CardPlaceholder name={card.result.cardName} width={width - 2} />
        )}
        {/* Grade overlay badge */}
        <View style={{ position: "absolute", top: 8, right: 8, minWidth: 30, height: 30, borderRadius: 15, backgroundColor: C.black55, borderWidth: 2, borderColor: gradeColor, justifyContent: "center", alignItems: "center", paddingHorizontal: 5, backdropFilter: "blur(8px)" }}>
          <Text style={{ fontSize: 13, fontWeight: "900", color: gradeColor, fontVariant: ["tabular-nums"] }}>
            {card.result.overallGrade}
          </Text>
        </View>
        {card.favorite && (
          <View style={{ position: "absolute", top: 8, left: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: C.black55, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ fontSize: 12 }}>❤️</Text>
          </View>
        )}
        <View style={{ padding: 12, gap: 3 }}>
          <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "700", color: C.text }}>{card.result.cardName}</Text>
          <Text numberOfLines={1} style={{ fontSize: 12, color: C.textSecondary }}>{card.result.cardSet}</Text>
        </View>
      </View>
    </Pressable>
  );
}
