// Minty design system. No third-party IP — original mint signature palette.
// Old red/* keys are kept as mint aliases so any legacy import keeps working.

export const C = {
  // Backgrounds — deep neutral with subtle warmth
  bg: "#0B0D0E",
  bgElevated: "#13161A",
  bgRaised: "#13161A",
  bgDeep: "#06080A",

  // Surfaces
  surface: "#181C20",
  surfaceHover: "#20252B",
  surfaceLow: "#0F1214",
  surfaceGlass: "rgba(24,28,32,0.85)",

  // Borders
  border: "rgba(255,255,255,0.07)",
  borderStrong: "rgba(255,255,255,0.12)",
  borderSubtle: "rgba(255,255,255,0.04)",
  borderGlow: "rgba(72,229,176,0.25)",

  // PRIMARY — electric mint (replaces old red)
  mint: "#48E5B0",
  mintLight: "#6FF0C2",
  mintDark: "#2BAE82",
  mintFaint: "rgba(72,229,176,0.12)",
  mintGlow: "rgba(72,229,176,0.35)",

  // GOLD — Gem Mint tier only
  gold: "#F5C95A",
  goldLight: "#FFD877",
  goldDark: "#C99E2D",
  goldFaint: "rgba(245,201,90,0.12)",
  goldGlow: "rgba(245,201,90,0.40)",

  // Grade scale (no bright red)
  g10: "#F5C95A",
  g9: "#48E5B0",
  g78: "#7AAEF0",
  g56: "#E5B05A",
  g14: "#D87560",

  // Functional
  success: "#48E5B0",
  warn: "#E5B05A",
  danger: "#D87560",
  info: "#7AAEF0",
  blue: "#7AAEF0",
  orange: "#E5B05A",

  // Text
  text: "#F4F5F6",
  textSecondary: "#A2A6AD",
  textTertiary: "#6A6E76",
  textDisabled: "#3D4047",

  // ⚠️ DEPRECATED — kept as mint aliases for backward compat. Prefer C.mint.
  red: "#48E5B0",
  redLight: "#6FF0C2",
  redDark: "#2BAE82",
  redFaint: "rgba(72,229,176,0.12)",
  redGlow: "rgba(72,229,176,0.35)",

  // Utility
  white04: "rgba(255,255,255,0.04)",
  white06: "rgba(255,255,255,0.06)",
  white10: "rgba(255,255,255,0.10)",
  black55: "rgba(0,0,0,0.55)",

  // On-mint contrast text (used inside buttons with mint bg)
  onMint: "#0A1410",
} as const;

export const SHADOW = {
  card: "0px 1px 4px rgba(0,0,0,0.4), 0px 8px 28px rgba(0,0,0,0.5)",
  sheet: "0px -8px 40px rgba(0,0,0,0.6)",
  elevated: "0px 12px 40px rgba(0,0,0,0.7)",
  hero: "0px 30px 60px rgba(0,0,0,0.7), 0px 8px 20px rgba(0,0,0,0.5)",
  glow: "0px 0px 40px rgba(72,229,176,0.35), 0px 8px 24px rgba(72,229,176,0.20)",
  goldGlow: "0px 0px 40px rgba(245,201,90,0.40), 0px 8px 24px rgba(245,201,90,0.25)",
} as const;

export const RADIUS = { sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, pill: 100 } as const;

// Font family names — match the keys passed into useFonts() in _layout.tsx
export const FONT = {
  ui: "Inter_500Medium",
  uiBold: "Inter_700Bold",
  uiHeavy: "Inter_800ExtraBold",
  display: "InstrumentSerif_400Regular",
  displayItalic: "InstrumentSerif_400Regular_Italic",
  mono: "JetBrainsMono_500Medium",
  monoBold: "JetBrainsMono_700Bold",
} as const;

export const FONT_SIZE = {
  hero: 80,
  display: 44,
  h1: 36,
  h2: 30,
  h3: 24,
  body: 14,
  bodySm: 13,
  caption: 12,
  micro: 11,
  tiny: 10,
  nano: 9,
} as const;
