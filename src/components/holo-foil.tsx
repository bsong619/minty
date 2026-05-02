import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

// Holographic foil overlay used on Gem cards (grade ≥ 9.5).
// Approximates a 105° gradient via start/end coordinates — RN's LinearGradient
// doesn't take an angle directly. Rotated diagonally so the band reads as a foil shimmer.
export function HoloFoil({ intensity = 0.4 }: { intensity?: number }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        start={{ x: 0, y: 0.1 }}
        end={{ x: 1, y: 0.4 }}
        colors={[
          "transparent",
          `rgba(245,201,90,${intensity * 0.6})`,
          `rgba(72,229,176,${intensity * 0.7})`,
          `rgba(122,174,240,${intensity * 0.5})`,
          "transparent",
        ]}
        locations={[0.3, 0.45, 0.55, 0.65, 0.85]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
