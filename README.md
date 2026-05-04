# Minty

AI-powered card grading. Snap a card, get an estimated 1–10 grade in seconds with sub-grades for centering, corners, edges, and surface.

## Stack

- **App**: Expo SDK 55 + React Native 0.83 + Expo Router (iOS, Android, web)
- **Backend**: Supabase (Postgres + Auth + Storage)
- **Grading**: Anthropic Claude (sonnet-4-6) via a Supabase Edge Function
- **Auth**: email/password, Sign in with Apple, Google OAuth, anonymous guests

## Quick start

```bash
bun install
bunx expo
```

Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`.

## Architecture

```
client (Expo)
  ├─ supabase JS client     → Supabase auth, scans table, image storage
  └─ analyzeCard()          → POSTs to Edge Function with user JWT
                                  ↓
                           Supabase Edge Function (supabase/functions/grade)
                              validates JWT, rate-limits, calls Claude
                                  ↓
                           Anthropic Claude API
```

The Anthropic API key lives only as a Supabase function secret — never bundled
into the app. See [`SECURITY.md`](./SECURITY.md) for the deploy procedure and
account-deletion (Apple 5.1.1(v)) requirements.

## Layout

```
src/
  app/                      Expo Router screens
    (tabs)/                  (scan) / (collection) / (profile)
    auth/                    OAuth callback
    login.tsx, terms.tsx, privacy.tsx, paywall.tsx, ...
  components/               Shared UI (grade-badge, scan-button, ...)
  lib/                      Logic (grading-engine, card-service, supabase, theme)
  assets/                   Icon, splash, sample artwork
supabase/functions/
  grade/                    Edge function (Claude proxy)
  comps/                    eBay listing comps
  delete-account/           Apple SIWA revocation + data purge
design-preview/             HTML mockup of redesigned screens
```

## Build

```bash
bunx eas build --platform ios --profile production
bunx eas submit --platform ios --profile production
```

`eas.json` `production.autoIncrement: true` bumps `buildNumber` on every build.

## Conventions

- Colors come from `src/lib/theme.ts` (`C` and `SHADOW`). Never hardcode hex.
- Files use kebab-case (`user-card.tsx`).
- Routes in `src/app/`, components in `src/components/`.
- Install deps with `bunx expo add <package>` to keep versions Expo-compatible.
