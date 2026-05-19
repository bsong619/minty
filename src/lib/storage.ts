import AsyncStorage from "@react-native-async-storage/async-storage";
import { GradedCard } from "./types";

const CARDS_KEY = "minty_history";
// Onboarding + AI consent are namespaced per Supabase user (or "anon" pre-auth)
// so that signing in as a different user on the same device re-prompts.
// Apple Guideline 5.1.2 expects each user's first-time AI sharing to be
// explicitly authorized, not silently inherited from a previous account on
// the device. The legacy un-namespaced keys are deliberately ignored.
const ONBOARDING_KEY_PREFIX = "minty_onboarding_seen_";
const AI_CONSENT_KEY_PREFIX = "minty_ai_consent_v1_";

function consentSubject(userId: string | null | undefined): string {
  return userId && userId.length > 0 ? userId : "anon";
}

export async function getCards(): Promise<GradedCard[]> {
  const raw = await AsyncStorage.getItem(CARDS_KEY);
  if (!raw) return [];
  return JSON.parse(raw);
}

export async function saveCard(card: GradedCard): Promise<void> {
  const cards = await getCards();
  cards.unshift(card);
  await AsyncStorage.setItem(CARDS_KEY, JSON.stringify(cards));
}

export async function deleteCard(id: string): Promise<void> {
  const cards = await getCards();
  const filtered = cards.filter((c) => c.id !== id);
  await AsyncStorage.setItem(CARDS_KEY, JSON.stringify(filtered));
}

export async function toggleFavorite(id: string): Promise<void> {
  const cards = await getCards();
  const card = cards.find((c) => c.id === id);
  if (card) {
    card.favorite = !card.favorite;
    await AsyncStorage.setItem(CARDS_KEY, JSON.stringify(cards));
  }
}

export async function hasSeenOnboarding(userId: string | null | undefined): Promise<boolean> {
  const val = await AsyncStorage.getItem(ONBOARDING_KEY_PREFIX + consentSubject(userId));
  return val === "true";
}

export async function markOnboardingSeen(userId: string | null | undefined): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_KEY_PREFIX + consentSubject(userId), "true");
}

export async function hasAcceptedAiConsent(userId: string | null | undefined): Promise<boolean> {
  const val = await AsyncStorage.getItem(AI_CONSENT_KEY_PREFIX + consentSubject(userId));
  return val === "true";
}

export async function markAiConsentAccepted(userId: string | null | undefined): Promise<void> {
  await AsyncStorage.setItem(AI_CONSENT_KEY_PREFIX + consentSubject(userId), "true");
}

/** Clear onboarding + consent flags for the given user. Used when the user
 *  taps "How to get the best grade" to re-watch the tour. */
export async function resetOnboardingForUser(userId: string | null | undefined): Promise<void> {
  await AsyncStorage.multiRemove([
    ONBOARDING_KEY_PREFIX + consentSubject(userId),
    AI_CONSENT_KEY_PREFIX + consentSubject(userId),
  ]);
}
