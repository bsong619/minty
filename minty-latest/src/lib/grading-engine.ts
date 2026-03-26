import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as FileSystem from "expo-file-system";
import Constants from "expo-constants";
import { GradeResult } from "./types";

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

const GRADE_PROMPT = `You are an expert PSA card grader with 20+ years of experience grading Pokemon cards. Analyze this Pokemon card image and provide a detailed PSA grade prediction.

Return ONLY valid JSON in this exact format, with no markdown fences, no explanation, nothing else:
{
  "overallGrade": <integer 1-10>,
  "confidence": "<High|Medium|Low>",
  "subGrades": {
    "centering": <number 1-10, .5 increments ok>,
    "corners": <number 1-10, .5 increments ok>,
    "edges": <number 1-10, .5 increments ok>,
    "surface": <number 1-10, .5 increments ok>
  },
  "centeringDetail": {
    "leftRight": "<e.g. 52/48>",
    "topBottom": "<e.g. 51/49>",
    "passesThreshold": <true if within PSA 10 60/40 threshold on both axes>
  },
  "tips": [<1-3 specific, actionable tips to improve the grade>],
  "cardName": "<Pokemon name on card>",
  "cardSet": "<Set name, e.g. Base Set, Jungle, Evolving Skies>",
  "cardYear": "<4-digit year>",
  "cardNumber": "<card number e.g. 4/102>"
}

PSA grading criteria:
- Centering: PSA 10 requires 60/40 or better. PSA 9 requires 65/35.
- Corners: Look for whitening, dings, rounding, or fraying.
- Edges: Check all 4 edges for whitening, chipping, or roughness.
- Surface: Check for scratches, holo scratches, print lines, indentations, or staining.
Confidence: High=sharp image fills frame, Medium=some quality issues, Low=blurry/partial.
Set overallGrade as weighted average heavily influenced by the lowest sub-grade.`;

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
    // SDK 55+ chainable API
    const image = ImageManipulator.manipulate(imageUri);
    image.resize({ width: 600 });
    const ref = await image.renderAsync();
    const result = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
    // Read the saved file as base64
    if (process.env.EXPO_OS !== "web" && result.uri) {
      return await FileSystem.readAsStringAsync(result.uri, { encoding: FileSystem.EncodingType.Base64 });
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

export async function analyzeCard(imageUri: string): Promise<GradeResult> {
  const base64 = await getBase64(imageUri);

  // All platforms: call the Expo API route (server holds the key securely)
  const base = getApiBaseUrl();
  const url = `${base}/api/grade`;
  console.log("[analyzeCard] POST", url);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64: base64, mimeType: "image/jpeg" }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => `status ${res.status}`);
    throw new Error(`Grade API error: ${errBody}`);
  }
  return res.json();
}

