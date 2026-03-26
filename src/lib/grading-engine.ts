import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import Constants from "expo-constants";
import { GradeResult } from "./types";
import { gradeCardDirect } from "./grade-client";

function getApiBaseUrl(): string {
  // Web: relative URL works fine
  if (process.env.EXPO_OS === "web") return "";
  // Production: use the deployed server URL
  if (!__DEV__) {
    return process.env.EXPO_PUBLIC_API_BASE_URL ?? "";
  }
  // Native dev: use the full Expo dev server hostUri (includes host:port)
  const hostUri = Constants.expoConfig?.hostUri ?? "localhost:8081";
  return `http://${hostUri}`;
}

// NOTE: Keep this prompt in sync with src/app/api/grade+api.ts GRADE_PROMPT
// The server-side API route handles the actual grading; this prompt is only used
// as a reference and is NOT sent directly — the API route's prompt is authoritative.

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
    // SDK 55+ chainable API — resize() returns a new context, must be chained
    const ref = await ImageManipulator.manipulate(localUri)
      .resize({ width: 600 })
      .renderAsync();
    const result = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
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
  const base64 = await getBase64(imageUri);
  const backBase64 = backImageUri ? await getBase64(backImageUri) : undefined;

  // Native production: no server available — call Anthropic directly
  if (process.env.EXPO_OS !== "web" && !__DEV__) {
    return gradeCardDirect(base64, "image/jpeg", backBase64);
  }

  // Dev + web: use the Expo API route
  const base = getApiBaseUrl();
  const url = `${base}/api/grade`;
  console.log("[analyzeCard] POST", url, "hasBack =", !!backBase64);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    const errBody = await res.text().catch(() => `status ${res.status}`);
    throw new Error(`Grade API error: ${errBody}`);
  }
  return res.json();
}

