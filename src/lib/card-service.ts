import "react-native-get-random-values";
import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";
import { supabase } from "./supabase";
import { GradeResult, GradedCard, Bucket } from "./types";
import type { ScannedCard } from "./database.types";

// Map a 0-1 PSA-10 likelihood into the user-facing bucket label.
export function bucketFor(likelihood: number | null | undefined): Bucket {
  if (likelihood == null) return "Below 9";
  if (likelihood >= 0.85) return "Lock 10";
  if (likelihood >= 0.65) return "Strong 10 candidate";
  if (likelihood >= 0.40) return "Coin-flip 9/10";
  if (likelihood >= 0.20) return "Likely 9";
  return "Below 9";
}

function generateUUID(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

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
    corners_details: aiResult.cornersDetail ?? null,
    edges_details: aiResult.edgesDetail ?? null,
    surface_details: aiResult.surfaceDetail ?? null,
    grade_up_tips: aiResult.tips ?? [],
    is_favorite: false,
  };
  // Optional v2 columns. We attempt to write them, but if the DB hasn't been
  // migrated yet we'll retry without them rather than fail the whole save.
  // See SECURITY.md for the migration SQL.
  if (aiResult.psa10Likelihood != null)  row.psa10_likelihood = aiResult.psa10Likelihood;
  if (aiResult.photoQuality)             row.photo_quality = aiResult.photoQuality;
  if (aiResult.hardPassGate)             row.hard_pass_gate = aiResult.hardPassGate;
  if (aiResult.disqualifyingFlaws?.length) row.disqualifying_flaws = aiResult.disqualifyingFlaws;
  if (aiResult.obscuredRegions?.length)  row.obscured_regions = aiResult.obscuredRegions;
  if (aiResult.tcgImageUrl)              row.tcg_image_url = aiResult.tcgImageUrl;

  let data: any;
  let { data: ok, error } = await supabase
    .from("scanned_cards")
    .insert(row)
    .select()
    .single();
  data = ok;

  // If the DB hasn't been migrated for the v2 columns yet, the insert will
  // fail with "column ... does not exist". Strip optional columns and retry.
  if (error && /column .* does not exist/i.test(error.message)) {
    const fallback = { ...row };
    for (const k of ["psa10_likelihood", "photo_quality", "hard_pass_gate", "disqualifying_flaws", "obscured_regions", "tcg_image_url"]) {
      delete fallback[k];
    }
    const retry = await supabase.from("scanned_cards").insert(fallback).select().single();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw error;
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

export async function deleteAllScannedCards(userId: string): Promise<void> {
  try {
    const { data: files } = await supabase.storage.from("card-images").list(userId);
    if (files?.length) {
      await supabase.storage.from("card-images").remove(files.map((f: { name: string }) => `${userId}/${f.name}`));
    }
  } catch (e) {
    console.warn("Storage cleanup failed (non-blocking):", e);
  }

  const { error } = await supabase
    .from("scanned_cards")
    .delete()
    .eq("user_id", userId);
  if (error) throw error;
}

// --- Demo / seed data ---

// Demo seeding removed — collection starts empty. Kept as a no-op so existing
// callers keep working without churn.
export async function seedDemoCards(_userId: string): Promise<void> {
  return;
}

// --- Conversion helper ---

function toGradedCard(card: ScannedCard): GradedCard {
  const confidence = (card.confidence ?? "medium").toLowerCase();
  const mapped: "High" | "Medium" | "Low" =
    confidence === "high" ? "High" : confidence === "low" ? "Low" : "Medium";

  const tcgImageUrl = (card as any).tcg_image_url ?? undefined;
  const psa10Likelihood = (card as any).psa10_likelihood ?? null;
  const photoQuality = ((card as any).photo_quality as "High" | "Medium" | "Low" | null) ?? mapped;

  return {
    id: card.id,
    imageUri: card.front_image_url,
    tcgImageUrl,
    favorite: card.is_favorite,
    timestamp: new Date(card.scanned_at).getTime(),
    result: {
      overallGrade: card.predicted_grade,
      psa10Likelihood,
      bucket: bucketFor(psa10Likelihood),
      photoQuality,
      confidence: mapped,
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
      cornersDetail: (card as any).corners_details ?? undefined,
      edgesDetail: (card as any).edges_details ?? undefined,
      surfaceDetail: (card as any).surface_details ?? undefined,
      hardPassGate: (card as any).hard_pass_gate ?? undefined,
      disqualifyingFlaws: (card as any).disqualifying_flaws ?? undefined,
      obscuredRegions: (card as any).obscured_regions ?? undefined,
      tips: card.grade_up_tips ?? [],
      cardName: card.card_name,
      cardSet: card.card_set,
      cardYear: card.card_year,
      cardNumber: card.card_number,
    },
  };
}
