export const C = {
  // Backgrounds — true black like a card sleeve
  bg: "#0A0A0C",
  bgElevated: "#141416",

  // Surfaces — dark charcoal
  surface: "#1A1A1E",
  surfaceHover: "#222226",
  surfaceGlass: "rgba(26,26,30,0.9)",

  // Borders — steel gray
  border: "#2A2A30",
  borderSubtle: "#1F1F24",
  borderGlow: "rgba(255,68,68,0.25)",

  // Primary — Pokéball red
  red: "#FF4444",
  redLight: "#FF6666",
  redDark: "#CC2222",
  redFaint: "rgba(255,68,68,0.10)",
  redGlow: "rgba(255,68,68,0.25)",

  // Gold — PSA 10 / Gem Mint
  gold: "#FFD700",
  goldLight: "#FFE44D",
  goldDark: "#D4A800",
  goldFaint: "rgba(255,215,0,0.10)",
  goldGlow: "rgba(255,215,0,0.25)",

  // Kept for grade colors
  mint: "#3DD68C",
  blue: "#5B9CF5",
  orange: "#F5A623",

  // Text — clean whites
  text: "#F5F5F7",
  textSecondary: "#8E8E93",
  textTertiary: "#555560",
  textDisabled: "#3A3A40",

  // Utility
  white04: "rgba(255,255,255,0.04)",
  white06: "rgba(255,255,255,0.06)",
  white10: "rgba(255,255,255,0.10)",
  black55: "rgba(0,0,0,0.55)",
} as const;

export const SHADOW = {
  card: "0px 4px 24px rgba(0,0,0,0.6), 0px 1px 4px rgba(0,0,0,0.4)",
  elevated: "0px 12px 40px rgba(0,0,0,0.7)",
  glow: "0px 4px 20px rgba(255,68,68,0.3), 0px 0px 40px rgba(255,68,68,0.12)",
  goldGlow: "0px 4px 20px rgba(255,215,0,0.3), 0px 0px 40px rgba(255,215,0,0.12)",
  hero: "0px 20px 60px rgba(0,0,0,0.8), 0px 4px 16px rgba(0,0,0,0.5)",
} as const;

export const RADIUS = { sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, pill: 100 } as const;
