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

async function getBase64(imageUri: string, opts?: { maxWidth?: number; quality?: number }): Promise<string> {
  const maxWidth = opts?.maxWidth ?? 1568;
  const quality = opts?.quality ?? 0.85;
  try {
    let localUri = imageUri;
    // Remote URLs must be downloaded to a local temp file before ImageManipulator can process them
    if (imageUri.startsWith("http") && process.env.EXPO_OS !== "web") {
      const tempUri = `${FileSystem.cacheDirectory}temp_card_${Date.now()}.jpg`;
      await FileSystem.downloadAsync(imageUri, tempUri);
      localUri = tempUri;
    }
    // 1568px long-edge matches Claude Sonnet 4.6's native vision resolution.
    // On retry we downsize to 1024px to slash the upload payload on slow WiFi.
    const ref = await ImageManipulator.manipulate(localUri)
      .resize({ width: maxWidth })
      .renderAsync();
    const result = await ref.saveAsync({ format: SaveFormat.JPEG, compress: quality });
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

  // Get the current user's JWT — the edge function requires it.
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) throw new Error("Please sign in to grade a card");

  // Adaptive payload: first attempt is full quality (1568px @ q0.85, ~2 MB
  // JSON). If that times out, the network is probably slow — retry with a
  // 1024px @ q0.75 payload (~0.7 MB, ~3x faster upload). Claude still ID's
  // the card fine at 1024px; only fine surface detail degrades, which is
  // an acceptable tradeoff over a failed scan.
  const doAttempt = async (small: boolean): Promise<Response> => {
    const opts = small ? { maxWidth: 1024, quality: 0.75 } : undefined;
    const base64 = await getBase64(imageUri, opts);
    const backBase64 = backImageUri ? await getBase64(backImageUri, opts) : undefined;
    const body = JSON.stringify({ imageBase64: base64, mimeType: "image/jpeg", backImageBase64: backBase64 });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 150_000);
    try {
      return await fetch(GRADE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          Connection: "close",
        },
        body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  };

  let res: Response;
  try {
    res = await doAttempt(false);
  } catch (e: any) {
    if (e?.name === "AbortError" || e?.message?.toLowerCase()?.includes("network")) {
      // Retry smaller — gives slow networks a real shot at finishing
      try {
        res = await doAttempt(true);
      } catch (retryErr: any) {
        if (retryErr?.name === "AbortError") throw new Error("Grading timed out. Try a faster network and scan again.");
        throw retryErr;
      }
    } else {
      throw e;
    }
  }
  if (!res.ok) {
    if (res.status === 429) throw new Error("Daily grade limit reached. Try again later.");
    if (res.status === 401) throw new Error("Please sign in to grade a card");
    throw new Error("Grading service is unavailable. Please try again.");
  }
  return res.json();
}

