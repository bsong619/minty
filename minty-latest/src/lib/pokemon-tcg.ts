const BASE = "https://api.pokemontcg.io/v2/cards";

/** 3-second timeout wrapper */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/**
 * Fetch the official Pokemon TCG card art URL.
 * Tries name + number first, then name-only. Times out after 3s.
 */
export async function fetchTcgImageUrl(
  cardName: string,
  cardNumber?: string
): Promise<string | null> {
  if (!cardName || cardName === "Unknown Card") return null;

  const name = cardName.trim();
  const num = cardNumber?.split("/")?.[0]?.trim();

  const queries = [
    ...(num ? [`name:"${name}" number:${num}`] : []),
    `name:"${name}"`,
  ];

  for (const q of queries) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(
        `${BASE}?q=${encodeURIComponent(q)}&pageSize=5&select=id,name,number,images`,
        { signal: controller.signal }
      );
      clearTimeout(timer);
      if (!res.ok) continue;
      const json = await res.json();
      const cards: any[] = json.data ?? [];
      if (cards.length === 0) continue;
      const exact = cards.find((c) => c.name.toLowerCase() === name.toLowerCase());
      const card = exact ?? cards[0];
      const imageUrl = card?.images?.large ?? card?.images?.small ?? null;
      if (imageUrl) return imageUrl;
    } catch {
      // timeout or network error — try next query
    }
  }

  return null;
}

/** Convenience wrapper that never throws and never blocks longer than 3s */
export function fetchTcgImageUrlSafe(
  cardName: string,
  cardNumber?: string
): Promise<string | null> {
  return withTimeout(fetchTcgImageUrl(cardName, cardNumber), 3000).catch(() => null);
}
