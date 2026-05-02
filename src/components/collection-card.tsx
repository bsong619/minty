import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import { GradedCard } from "@/lib/types";
import { getGradeColor } from "@/lib/grade-colors";
import { C, SHADOW } from "@/lib/theme";

// Generic accent color rotation based on card name hash — no franchise references.
function getCardTheme(name: string): { color: string } {
  const colors = ["#F7C948", "#E8622A", "#4FC3F7", "#5DBF5D", "#9B78E8", "#7EC8E3", "#E04040", "#E0B0E8", "#707080", "#D88060"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return { color: colors[hash % colors.length] };
}

function CardPlaceholder({ name, width }: { name: string; width: number }) {
  const height = width / 0.72;
  const { color } = getCardTheme(name);
  const initials = name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();

  return (
    <View style={{ width, height, backgroundColor: C.bgElevated, justifyContent: "center", alignItems: "center", gap: 8 }}>
      <Text style={{ fontSize: 32, color: C.textTertiary }}>🃏</Text>
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
        <View style={{ position: "absolute", top: 8, right: 8, minWidth: 30, height: 30, borderRadius: 15, backgroundColor: C.black55, borderWidth: 2, borderColor: gradeColor, justifyContent: "center", alignItems: "center", paddingHorizontal: 5, ...({ backdropFilter: "blur(8px)" } as any) }}>
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
