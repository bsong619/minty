## Principles

- Target iOS, Android, web.
- Install dependencies with `bunx expo add <package>`
- Use `expo-image` for images and icons.
- Routes go in `src/app/`, components go in `src/components/`
- Use kebab-case for file names (e.g., `user-card.tsx`)

## Design Preferences

- All colors from `src/lib/theme.ts` — import `{ C, SHADOW }` from "@/lib/theme"
- Never hardcode hex colors; always use the C object
- Pokéball palette: red (#FF4444) + black (#0A0A0C) + white (#F5F5F7)
- Primary: C.red (#FF4444) — brand, CTAs, links, active states, Pokéball accents
- Premium: C.gold (#FFD700) — PSA 10, paywall CTA, tips numbers, analyzing scanner
- Background: C.bg (#0A0A0C) — true black
- Surfaces: C.surface (#1A1A1E) — dark charcoal cards
- Grade colors: 10=gold, 9=green, 7-8=blue, 5-6=orange, 1-4=red
- Checkmarks and success states use green (#3DD68C) — not red

## Components

- `src/components/grade-badge.tsx` — Grade circle with glow
- `src/components/sub-grade-bar.tsx` — Progress bar for sub-grades
- `src/components/scan-button.tsx` — Card-style action button
- `src/components/collection-card.tsx` — Card thumbnail in grid
- `src/components/auth-provider.tsx` — Auth context
- `src/components/theme-provider.tsx` — Forces dark theme
