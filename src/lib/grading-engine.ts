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

  // WiFi-vs-cellular reliability: home WiFi uplinks are often 5–15 Mbps which
  // means a 2–4 MB JSON body takes 3–8 s to push, plus 5–15 s for Claude
  // analysis. The old 30 s ceiling hit before the request finished. Bumped to
  // 90 s, with one auto-retry on network errors so a single transient TCP hiccup
  // doesn't kill a scan. `Connection: close` avoids stale keep-alive sockets
  // that some consumer routers hold past their NAT idle timeout.
  const body = JSON.stringify({ imageBase64: base64, mimeType: "image/jpeg", backImageBase64: backBase64 });
  const doFetch = async (): Promise<Response> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);
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
    res = await doFetch();
  } catch (e: any) {
    // Retry once on network / abort errors. HTTP error statuses (4xx/5xx) don't
    // throw — they come back as res.ok=false and are handled below.
    if (e?.name === "AbortError" || e?.message?.toLowerCase()?.includes("network")) {
      try {
        res = await doFetch();
      } catch (retryErr: any) {
        if (retryErr?.name === "AbortError") throw new Error("Grading timed out. Try again on a different network.");
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

