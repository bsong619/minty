import * as FileSystem from "expo-file-system";
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
  if (process.env.EXPO_OS !== "web") {
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
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

  const row = {
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

  const { data, error } = await supabase
    .from("scanned_cards")
    .insert(row)
    .select()
    .single();
  if (error) throw error;

  await incrementScanCount(userId);

  return toGradedCard(data as ScannedCard);
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
  await supabase.storage.from("card-images").remove(paths);

  const { error } = await supabase
    .from("scanned_cards")
    .delete()
    .eq("id", cardId);
  if (error) throw error;
}

// --- Scan limits ---

export async function checkScanLimit(
  userId: string
): Promise<ScanLimitResult> {
  const { data, error } = await supabase
    .from("profiles")
    .select("scan_count_today, last_scan_date, is_pro")
    .eq("id", userId)
    .single();

  if (error || !data) return { canScan: true, scansRemaining: FREE_DAILY_LIMIT };

  if (data.is_pro) return { canScan: true, scansRemaining: Infinity };

  const today = new Date().toISOString().split("T")[0];
  const count = data.last_scan_date === today ? data.scan_count_today : 0;
  const remaining = Math.max(0, FREE_DAILY_LIMIT - count);

  return { canScan: remaining > 0, scansRemaining: remaining };
}

export async function incrementScanCount(userId: string): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  const { data } = await supabase
    .from("profiles")
    .select("scan_count_today, last_scan_date")
    .eq("id", userId)
    .single();

  const count =
    data && data.last_scan_date === today ? data.scan_count_today + 1 : 1;

  await supabase
    .from("profiles")
    .update({ scan_count_today: count, last_scan_date: today })
    .eq("id", userId);
}

// --- Conversion helper ---

function toGradedCard(card: ScannedCard): GradedCard {
  const confidence = (card.confidence ?? "medium").toLowerCase();
  const mapped =
    confidence === "high" ? "High" : confidence === "low" ? "Low" : "Medium";

  return {
    id: card.id,
    imageUri: card.front_image_url,
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
