import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../.env") });

const key = String(process.env.GEMINI_API_KEY || "").trim();
const model = String(process.env.GEMINI_CHAT_MODEL || "gemini-3.1-flash-lite").trim();

if (!key) {
  console.error("GEMINI_KEY_MISSING");
  process.exit(1);
}

const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

try {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: "Reply with exactly: ATELIER AI OK" }]
        }
      ],
      generationConfig: { temperature: 0, maxOutputTokens: 20 }
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error(`GEMINI_HTTP_${response.status}`);
    console.error(payload?.error?.message || "Unknown Gemini API error");
    process.exit(2);
  }

  const reply = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text || "")
    .join("")
    .trim();

  console.log(`GEMINI_MODEL=${model}`);
  console.log(`GEMINI_API=OK`);
  console.log(`GEMINI_REPLY=${reply || "<empty>"}`);
} catch (error) {
  console.error("GEMINI_NETWORK_ERROR");
  console.error(error?.message || String(error));
  process.exit(3);
}
