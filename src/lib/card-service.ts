import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";
import { supabase } from "./supabase";
import { GradeResult, GradedCard } from "./types";
import type { ScannedCard, ScanLimitResult } from "./database.types";

function generateUUID(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

const FREE_DAILY_LIMIT = 3;

// --- Image Upload ---

async function imageToArrayBuffer(imageUri: string): Promise<ArrayBuffer> {
  // Remote URLs (http/https) must be fetched — readAsStringAsync only works on local files
  if (imageUri.startsWith("http")) {
    const response = await fetch(imageUri);
    return response.arrayBuffer();
  }
  if (process.env.EXPO_OS !== "web") {
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: "base64",
    });
    return decode(base64);
  }
  const response = await fetch(imageUri);
  return response.arrayBuffer();
}

export async function uploadCardImage(
  userId: string,
  cardId: string,
  imageUri: string,
  side: "front" | "back"
): Promise<string> {
  const arrayBuffer = await imageToArrayBuffer(imageUri);
  const path = `${userId}/${cardId}_${side}.jpg`;

  const { error } = await supabase.storage
    .from("card-images")
    .upload(path, arrayBuffer, {
      contentType: "image/jpeg",
      upsert: true,
    });
  if (error) throw error;

  // Use signed URL — works even if bucket isn't public
  const { data: signed, error: signError } = await supabase.storage
    .from("card-images")
    .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 year
  if (signed?.signedUrl) return signed.signedUrl;

  // Fallback to public URL
  const { data } = supabase.storage.from("card-images").getPublicUrl(path);
  return data.publicUrl;
}

// --- Save a complete scan ---

export async function saveCompleteScan({
  userId,
  frontImageUri,
  backImageUri,
  aiResult,
}: {
  userId: string;
  frontImageUri: string;
  backImageUri?: string;
  aiResult: GradeResult;
}): Promise<GradedCard> {
  const cardId = generateUUID();

  const frontUrl = await uploadCardImage(userId, cardId, frontImageUri, "front");
  let backUrl: string | null = null;
  if (backImageUri) {
    backUrl = await uploadCardImage(userId, cardId, backImageUri, "back");
  }

  const row: Record<string, any> = {
    id: cardId,
    user_id: userId,
    card_name: aiResult.cardName ?? "Unknown",
    card_set: aiResult.cardSet ?? "Unknown",
    card_number: aiResult.cardNumber ?? "",
    card_year: aiResult.cardYear ?? "",
    front_image_url: frontUrl,
    back_image_url: backUrl,
    predicted_grade: aiResult.overallGrade,
    confidence: (aiResult.confidence ?? "Medium").toLowerCase(),
    centering_score: aiResult.subGrades?.centering ?? 5,
    corners_score: aiResult.subGrades?.corners ?? 5,
    edges_score: aiResult.subGrades?.edges ?? 5,
    surface_score: aiResult.subGrades?.surface ?? 5,
    centering_details: aiResult.centeringDetail ?? null,
    corners_details: null,
    edges_details: null,
    surface_details: null,
    grade_up_tips: aiResult.tips ?? [],
    is_favorite: false,
  };
  // Persist TCG image URL if Claude returned one (requires tcg_image_url column in DB)
  if (aiResult.tcgImageUrl) {
    row.tcg_image_url = aiResult.tcgImageUrl;
  }

  const { data, error } = await supabase
    .from("scanned_cards")
    .insert(row)
    .select()
    .single();
  if (error) throw error;

  await incrementScanCount(userId);

  return toGradedCard(data as ScannedCard);
}

// --- Refresh broken image URLs with signed URLs ---

export async function refreshCardImageUrls(cards: GradedCard[]): Promise<GradedCard[]> {
  let updated = false;
  const refreshed = await Promise.all(
    cards.map(async (card) => {
      // Skip cards that already have working URLs or no Supabase URL
      if (!card.imageUri || !card.imageUri.includes("supabase")) return card;
      try {
        // Extract the storage path from the public URL
        const match = card.imageUri.match(/card-images\/(.+?)(\?|$)/);
        if (!match) return card;
        const path = decodeURIComponent(match[1]);
        const { data } = await supabase.storage
          .from("card-images")
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        if (data?.signedUrl) {
          updated = true;
          return { ...card, imageUri: data.signedUrl };
        }
      } catch {}
      return card;
    })
  );
  return refreshed;
}

// --- Query cards ---

export async function getScannedCards(
  userId: string,
  opts: { limit?: number; offset?: number; favoritesOnly?: boolean } = {}
): Promise<GradedCard[]> {
  let query = supabase
    .from("scanned_cards")
    .select("*")
    .eq("user_id", userId)
    .order("scanned_at", { ascending: false });

  if (opts.favoritesOnly) query = query.eq("is_favorite", true);
  if (opts.limit) query = query.limit(opts.limit);
  if (opts.offset) query = query.range(opts.offset, opts.offset + (opts.limit ?? 50) - 1);

  const { data, error } = await query;
  if (error) throw error;
  return (data as ScannedCard[]).map(toGradedCard);
}

export async function getScannedCardById(
  cardId: string
): Promise<GradedCard | null> {
  const { data, error } = await supabase
    .from("scanned_cards")
    .select("*")
    .eq("id", cardId)
    .single();
  if (error) return null;
  return toGradedCard(data as ScannedCard);
}

// --- Favorites ---

export async function toggleFavorite(
  cardId: string,
  isFavorite: boolean
): Promise<void> {
  const { error } = await supabase
    .from("scanned_cards")
    .update({ is_favorite: isFavorite })
    .eq("id", cardId);
  if (error) throw error;
}

// --- Delete ---

export async function deleteScannedCard(
  userId: string,
  cardId: string
): Promise<void> {
  const paths = [
    `${userId}/${cardId}_front.jpg`,
    `${userId}/${cardId}_back.jpg`,
  ];
  // Non-blocking: storage cleanup failure (e.g. files don't exist) shouldn't block DB delete
  try {
    await supabase.storage.from("card-images").remove(paths);
  } catch (e) {
    console.warn("Storage cleanup failed (non-blocking):", e);
  }

  const { error } = await supabase
    .from("scanned_cards")
    .delete()
    .eq("id", cardId);
  if (error) throw error;
}

// --- Scan limits (removed — app is free with unlimited scans) ---

export async function checkScanLimit(
  _userId: string
): Promise<ScanLimitResult> {
  return { canScan: true, scansRemaining: Infinity };
}

export async function incrementScanCount(_userId: string): Promise<void> {
  // no-op — unlimited scans
}

// --- Demo / seed data ---

// Stable IDs so we can check existence without duplicating
const DEMO_CARDS = [
  {
    id: "00000000-demo-0000-0000-charizard001",
    card_name: "Charizard",
    card_set: "XY Evolutions",
    card_number: "11/108",
    card_year: "2016",
    front_image_url: "https://images.pokemontcg.io/xy12/11_hires.png",
    tcg_image_url: "https://images.pokemontcg.io/xy12/11_hires.png",
    predicted_grade: 8,
    confidence: "high",
    centering_score: 8,
    corners_score: 8,
    edges_score: 9,
    surface_score: 7,
    centering_details: { leftRight: "55/45", topBottom: "54/46", passesThreshold: false },
    grade_up_tips: [
      "Light surface scratches on the holo are reducing your grade — store in a sleeve.",
      "Centering is slightly off on the left border — be mindful when handling.",
    ],
  },
  {
    id: "00000000-demo-0000-0000-blastoise002",
    card_name: "Blastoise",
    card_set: "Base Set",
    card_number: "2/102",
    card_year: "1999",
    front_image_url: "https://images.pokemontcg.io/base1/2_hires.png",
    tcg_image_url: "https://images.pokemontcg.io/base1/2_hires.png",
    predicted_grade: 6,
    confidence: "medium",
    centering_score: 6,
    corners_score: 6,
    edges_score: 7,
    surface_score: 5,
    centering_details: { leftRight: "60/40", topBottom: "58/42", passesThreshold: false },
    grade_up_tips: [
      "Corner wear is visible — consider grading sooner to lock in current condition.",
      "Surface shows light play marks from handling without a sleeve.",
    ],
  },
  {
    id: "00000000-demo-0000-0000-pikachu00003",
    card_name: "Pikachu",
    card_set: "Base Set",
    card_number: "58/102",
    card_year: "1999",
    front_image_url: "https://images.pokemontcg.io/base1/58_hires.png",
    tcg_image_url: "https://images.pokemontcg.io/base1/58_hires.png",
    predicted_grade: 9,
    confidence: "high",
    centering_score: 9,
    corners_score: 9,
    edges_score: 9,
    surface_score: 9,
    centering_details: { leftRight: "52/48", topBottom: "53/47", passesThreshold: true },
    grade_up_tips: [
      "Excellent condition — submit to PSA soon to maximize value.",
    ],
  },
  {
    id: "00000000-demo-0000-0000-mewtwo00004",
    card_name: "Mewtwo",
    card_set: "Base Set",
    card_number: "10/102",
    card_year: "1999",
    front_image_url: "https://images.pokemontcg.io/base1/10_hires.png",
    tcg_image_url: "https://images.pokemontcg.io/base1/10_hires.png",
    predicted_grade: 7,
    confidence: "medium",
    centering_score: 7,
    corners_score: 7,
    edges_score: 8,
    surface_score: 6,
    centering_details: { leftRight: "57/43", topBottom: "55/45", passesThreshold: false },
    grade_up_tips: [
      "Holo surface has light scratches — store face-up in a rigid case.",
      "Centering is slightly off; borderline for PSA 8.",
    ],
  },
];

export async function seedDemoCards(userId: string): Promise<void> {
  for (const demo of DEMO_CARDS) {
    const { data } = await supabase
      .from("scanned_cards")
      .select("id")
      .eq("id", demo.id)
      .maybeSingle();
    if (data) continue; // Already seeded

    await supabase.from("scanned_cards").insert({
      ...demo,
      user_id: userId,
      is_favorite: false,
    });
  }
}

// --- Conversion helper ---

function toGradedCard(card: ScannedCard): GradedCard {
  const confidence = (card.confidence ?? "medium").toLowerCase();
  const mapped =
    confidence === "high" ? "High" : confidence === "low" ? "Low" : "Medium";

  // Prefer the persisted TCG image URL; fall back to front_image_url if it's already TCG art
  const tcgImageUrl =
    (card as any).tcg_image_url ??
    (card.front_image_url?.includes("pokemontcg.io") ? card.front_image_url : undefined);

  return {
    id: card.id,
    imageUri: card.front_image_url,
    tcgImageUrl,
    favorite: card.is_favorite,
    timestamp: new Date(card.scanned_at).getTime(),
    result: {
      overallGrade: card.predicted_grade,
      confidence: mapped as "High" | "Medium" | "Low",
      subGrades: {
        centering: card.centering_score,
        corners: card.corners_score,
        edges: card.edges_score,
        surface: card.surface_score,
      },
      centeringDetail: card.centering_details ?? {
        leftRight: "N/A",
        topBottom: "N/A",
        passesThreshold: false,
      },
      tips: card.grade_up_tips ?? [],
      cardName: card.card_name,
      cardSet: card.card_set,
      cardYear: card.card_year,
      cardNumber: card.card_number,
    },
  };
}
