import https from "node:https";

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

PSA grading criteria to evaluate:
- Centering: PSA 10 requires 60/40 or better on all sides. PSA 9 requires 65/35. Estimate the border ratio visually.
- Corners: Look for whitening, dings, rounding, or fraying at all 4 corners.
- Edges: Check all 4 edges for whitening, chipping, or roughness.
- Surface: Check for scratches, holo scratches, print lines, indentations, or staining.

Confidence levels:
- High: Image is sharp, card fills the frame, good even lighting
- Medium: Some image quality issues but card is assessable
- Low: Poor lighting, blurry, or card partially out of frame

Set overallGrade as the weighted average of sub-grades, rounded to the nearest integer, heavily influenced by the lowest sub-grade.`;

function callAnthropic(body: string, apiKey: string): Promise<{ status: number; text: string }> {
  // Support ANTHROPIC_BASE_URL proxy (e.g. local dev proxy)
  const rawBase = (process.env.GRADE_PROXY_BASE_URL || process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "");
  const targetUrl = new URL(`${rawBase}/v1/messages`);
  const isHttps = targetUrl.protocol === "https:";
  const transport = isHttps ? https : require("node:http");

  return new Promise((resolve, reject) => {
    const bodyBuffer = Buffer.from(body, "utf-8");
    const req = transport.request(
      {
        hostname: targetUrl.hostname,
        port: targetUrl.port || (isHttps ? 443 : 80),
        path: targetUrl.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Length": bodyBuffer.length,
        },
      },
      (res: any) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 500,
            text: Buffer.concat(chunks).toString("utf-8"),
          })
        );
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.write(bodyBuffer);
    req.end();
  });
}

export async function POST(request: Request) {
  try {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  console.log("Grade API: apiKey present =", !!apiKey, "baseUrl =", process.env.ANTHROPIC_BASE_URL);
  if (!apiKey) {
    return Response.json({ error: "API key not configured" }, { status: 500 });
  }

  const { imageBase64, mimeType } = await request.json();
  console.log("Grade API: imageBase64 length =", imageBase64?.length);

  const requestBody = JSON.stringify({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType ?? "image/jpeg",
              data: imageBase64,
            },
          },
          { type: "text", text: GRADE_PROMPT },
        ],
      },
    ],
  });

  const { status, text } = await callAnthropic(requestBody, apiKey);

  if (status !== 200) {
    console.error("Anthropic proxy error", status, text.slice(0, 300));
    return Response.json({ error: text }, { status });
  }

  const data = JSON.parse(text);
  const content: string =
    data.content?.[0]?.type === "text" ? data.content[0].text : "";

  const clean = content
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();

  try {
    const result = JSON.parse(clean);
    result.overallGrade = Math.min(
      10,
      Math.max(1, Math.round(result.overallGrade))
    );
    return Response.json(result);
  } catch {
    return Response.json(
      { error: "Failed to parse AI response", raw: clean },
      { status: 500 }
    );
  }
  } catch (e: any) {
    console.error("Grade API crash:", e);
    return Response.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
