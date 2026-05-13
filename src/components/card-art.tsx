import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { View, Text } from "react-native";
import { C, FONT } from "@/lib/theme";

// Stylized card placeholder used for sample/empty states. Each "kind" gets a
// stable gradient + abstract glyph so cards in the home/vault/results screens
// look distinct without using any real card artwork.
const PALETTES: Record<string, [string, string]> = {
  charizard: ["#C0392B", "#E67E22"],
  pikachu:   ["#F1C40F", "#E6A700"],
  drake:     ["#5B4D8C", "#3E2C66"],
  champion:  ["#7C4F2A", "#A66E3D"],
  witch:     ["#3E2C66", "#5B3D8C"],
  fish:      ["#2E5F8C", "#1F4666"],
  knight:    ["#7C2E2E", "#A03E3E"],
  sage:      ["#2E7C5F", "#3E8C70"],
  athlete:   ["#7C4F2A", "#A66E3D"],
  default:   ["#2A2A30", "#1A1A1E"],
};

export function CardArt({
  kind = "default",
  imageUri,
  width = 140,
  height,
}: {
  kind?: string;
  imageUri?: string | null;
  width?: number;
  height?: number;
}) {
  const h = height ?? Math.round(width / 0.72);
  const [c1, c2] = PALETTES[kind] ?? PALETTES.default;

  if (imageUri) {
    return (
      <Image
        source={{ uri: imageUri }}
        style={{ width, height: h, borderRadius: 10 }}
        contentFit="cover"
        transition={200}
      />
    );
  }

  return (
    <View style={{ width, height: h, borderRadius: 10, overflow: "hidden", position: "relative" }}>
      <LinearGradient
        colors={[c1, c2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1, padding: 8 }}
      >
        <View style={{
          flex: 1, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
          padding: 8, justifyContent: "space-between",
        }}>
          <Text style={{
            fontSize: 8, color: "rgba(255,255,255,0.7)", fontFamily: FONT.mono,
            letterSpacing: 1.2, textTransform: "uppercase",
          }}>{kind.toUpperCase()}</Text>
          <View style={{
            flex: 1, marginVertical: 6, borderRadius: 6, backgroundColor: "rgba(0,0,0,0.25)",
            borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
            justifyContent: "center", alignItems: "center",
          }}>
            <Text style={{ fontSize: width * 0.28, color: "rgba(255,255,255,0.5)", fontFamily: FONT.display }}>
              {kind[0]?.toUpperCase()}
            </Text>
          </View>
          <Text style={{
            fontSize: 7, color: "rgba(255,255,255,0.55)", fontFamily: FONT.mono,
            textAlign: "center", letterSpacing: 0.5,
          }}>SAMPLE · NOT GRADED</Text>
        </View>
      </LinearGradient>
    </View>
  );
}

// Pick a deterministic art kind from a card name so the same card always looks the same.
export function artKindFor(name: string): string {
  const kinds = Object.keys(PALETTES).filter(k => k !== "default");
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return kinds[Math.abs(hash) % kinds.length];
}
