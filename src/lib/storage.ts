import AsyncStorage from "@react-native-async-storage/async-storage";
import { GradedCard } from "./types";

const CARDS_KEY = "minty_history";
const ONBOARDING_KEY = "minty_onboarding_seen";

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

export async function hasSeenOnboarding(): Promise<boolean> {
  const val = await AsyncStorage.getItem(ONBOARDING_KEY);
  return val === "true";
}

export async function markOnboardingSeen(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_KEY, "true");
}
