import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "./supabase";
import { GradeResult } from "./types";

// All grading goes through the Supabase Edge Function at /functions/v1/grade.
// The Anthropic key lives ONLY there — never bundled into the app.
// See supabase/functions/grade/index.ts and SECURITY.md for deploy steps.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const GRADE_ENDPOINT = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/grade` : "";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function getBase64(imageUri: string): Promise<string> {
  try {
    let localUri = imageUri;
    // Remote URLs must be downloaded to a local temp file before ImageManipulator can process them
    if (imageUri.startsWith("http") && process.env.EXPO_OS !== "web") {
      const tempUri = `${FileSystem.cacheDirectory}temp_card_${Date.now()}.jpg`;
      await FileSystem.downloadAsync(imageUri, tempUri);
      localUri = tempUri;
    }
    // 1568px long-edge matches Claude Sonnet 4.6's native vision resolution — anything
    // larger gets server-side downscaled, anything smaller throws away surface detail
    // (print lines, micro-whitening, holo scratches) that determines 9 vs 10. JPEG q0.9
    // because heavy compression destroys exactly those fine high-frequency features.
    // SDK 55+ chainable API — resize() returns a new context, must be chained.
    const ref = await ImageManipulator.manipulate(localUri)
      .resize({ width: 1568 })
      .renderAsync();
    const result = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
    // Read the saved file as base64
    if (process.env.EXPO_OS !== "web" && result.uri) {
      return await FileSystem.readAsStringAsync(result.uri, { encoding: "base64" });
    }
    // Web fallback
    const res = await fetch(result.uri);
    const blob = await res.blob();
    return blobToBase64(blob);
  } catch (e) {
    console.warn("[getBase64] ImageManipulator failed, using fallback:", e);
    const res = await fetch(imageUri);
    const blob = await res.blob();
    return blobToBase64(blob);
  }
}

export async function analyzeCard(imageUri: string, backImageUri?: string): Promise<GradeResult> {
  if (!GRADE_ENDPOINT || !supabase) throw new Error("Grading service not configured");

  const base64 = await getBase64(imageUri);
  const backBase64 = backImageUri ? await getBase64(backImageUri) : undefined;

  // Get the current user's JWT — the edge function requires it.
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) throw new Error("Please sign in to grade a card");

  const controller = new AbortController();
  // Vision call w/ Sonnet on a 1568px image regularly takes 35-55s. Edge function aborts at
  // 55s and returns 504; client gives it ~20s of head-room before giving up itself, so the
  // user sees the cleaner edge-side error rather than a generic AbortError.
  const timeout = setTimeout(() => controller.abort(), 75_000);
  let res: Response;
  try {
    res = await fetch(GRADE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ imageBase64: base64, mimeType: "image/jpeg", backImageBase64: backBase64 }),
      signal: controller.signal,
    });
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error("Grading timed out. Please try again.");
    throw e;
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) {
    if (res.status === 429) throw new Error("Daily grade limit reached. Try again later.");
    if (res.status === 401) throw new Error("Please sign in to grade a card");
    throw new Error("Grading service is unavailable. Please try again.");
  }
  return res.json();
}

