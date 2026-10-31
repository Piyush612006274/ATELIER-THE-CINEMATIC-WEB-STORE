import { activeAIProvider, generateImageWithProvider } from "./aiProviders.js";

const DEFAULT_BASE_URL = "https://aihorde.net/api/v2";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

type HordeResponse = Record<string, any>;

export type GeneratedImage = {
  buffer: Buffer;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
  seed?: number;
  model?: string;
  provider: ImageGenerationProvider;
};

export type ImageGenerationProvider = "ai_horde" | "gemini" | "openai_compatible" | "openai" | "anthropic" | "groq" | "openrouter" | "deepseek" | "mistral" | "custom_openai" | "custom_json";

type GeneratedHordeImage = Omit<GeneratedImage, "provider">;

function providerConfig() {
  const apiKey = String(process.env.AI_HORDE_API_KEY || "").trim();
  const baseUrl = String(process.env.AI_HORDE_BASE_URL || DEFAULT_BASE_URL).trim().replace(/\/$/, "");
  if (!apiKey || /^(PASTE|REPLACE|YOUR_)/i.test(apiKey)) throw new Error("AI_HORDE_NOT_CONFIGURED");
  let parsed: URL;
  try { parsed = new URL(baseUrl); } catch { throw new Error("AI_HORDE_BASE_URL_INVALID"); }
  if (parsed.protocol !== "https:") throw new Error("AI_HORDE_BASE_URL_INVALID");
  const clientAgent = String(process.env.AI_HORDE_CLIENT_AGENT || `ATELIER:1.0.0:${process.env.CONTACT_EMAIL || "contact@example.com"}`).trim();
  if (clientAgent.split(":").length < 3) throw new Error("AI_HORDE_CLIENT_AGENT_INVALID");
  return { apiKey, baseUrl, clientAgent };
}

async function hordeRequest(path: string, init: RequestInit = {}): Promise<HordeResponse> {
  const { apiKey, baseUrl, clientAgent } = providerConfig();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        apikey: apiKey,
        "Client-Agent": clientAgent,
        "Content-Type": "application/json",
        ...(init.headers || {})
      },
      signal: AbortSignal.timeout(30_000)
    });
  } catch {
    throw new Error("AI_HORDE_NETWORK_ERROR");
  }
  const body: HordeResponse = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error("AI_HORDE_AUTH_FAILED");
    if (response.status === 429) throw new Error("AI_HORDE_RATE_LIMITED");
    throw new Error(`AI_HORDE_HTTP_${response.status}`);
  }
  return body;
}

function inferImage(buffer: Buffer): Pick<GeneratedHordeImage, "contentType" | "extension"> {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { contentType: "image/png", extension: "png" };
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return { contentType: "image/webp", extension: "webp" };
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { contentType: "image/jpeg", extension: "jpg" };
  throw new Error("AI_HORDE_INVALID_IMAGE");
}

async function getImageBuffer(value: string): Promise<Buffer> {
  let buffer: Buffer;
  if (/^https:\/\//i.test(value)) {
    let response: Response;
    try { response = await fetch(value, { redirect: "error", signal: AbortSignal.timeout(30_000) }); }
    catch { throw new Error("AI_HORDE_IMAGE_DOWNLOAD_FAILED"); }
    if (!response.ok) throw new Error("AI_HORDE_IMAGE_DOWNLOAD_FAILED");
    const type = (response.headers.get("content-type") || "").split(";")[0].toLowerCase();
    if (!/^image\/(jpeg|png|webp)$/.test(type)) throw new Error("AI_HORDE_INVALID_IMAGE");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error("AI_HORDE_IMAGE_TOO_LARGE");
    buffer = bytes;
  } else {
    const encoded = value.replace(/^data:image\/(?:jpeg|jpg|png|webp);base64,/i, "").trim();
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error("AI_HORDE_INVALID_IMAGE");
    buffer = Buffer.from(encoded, "base64");
    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new Error("AI_HORDE_IMAGE_TOO_LARGE");
  }
  return buffer;
}

export async function generateAiHordeImage(prompt: string): Promise<GeneratedHordeImage> {
  const cleanPrompt = prompt.trim();
  if (cleanPrompt.length < 5 || cleanPrompt.length > 1200) throw new Error("AI_IMAGE_PROMPT_INVALID");
  const started = await hordeRequest("/generate/async", {
    method: "POST",
    body: JSON.stringify({
      prompt: cleanPrompt,
      params: {
        width: 512,
        height: 768,
        steps: 25,
        n: 1,
        cfg_scale: 7,
        sampler_name: "k_euler_a"
      },
      nsfw: false,
      censor_nsfw: true,
      trusted_workers: false,
      r2: false,
      shared: false
    })
  });
  const id = String(started.id || "").trim();
  if (!id) throw new Error("AI_HORDE_JOB_NOT_CREATED");

  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 2500));
    const status = await hordeRequest(`/generate/check/${encodeURIComponent(id)}`, { method: "GET", headers: { "Content-Type": "application/json" } });
    if (status.faulted === true) throw new Error("AI_HORDE_GENERATION_FAILED");
    if (status.done !== true && Number(status.finished || 0) < 1) continue;

    const completed = await hordeRequest(`/generate/status/${encodeURIComponent(id)}`, { method: "GET", headers: { "Content-Type": "application/json" } });
    const generation = Array.isArray(completed.generations) ? completed.generations[0] : null;
    const image = typeof generation?.img === "string" ? generation.img : "";
    if (!image) throw new Error("AI_HORDE_IMAGE_MISSING");
    const buffer = await getImageBuffer(image);
    const detected = inferImage(buffer);
    const seedValue = Number(generation.seed);
    return {
      buffer,
      ...detected,
      ...(Number.isFinite(seedValue) ? { seed: seedValue } : {}),
      ...(typeof generation.model === "string" ? { model: generation.model } : {})
    };
  }
  throw new Error("AI_HORDE_TIMEOUT");
}


const IMAGE_PROVIDER_DEFAULT: ImageGenerationProvider = "ai_horde";
const DEFAULT_GEMINI_IMAGE_MODEL = "gemini-3.1-flash-lite-image";
const MAX_PROVIDER_RESPONSE_BYTES = 8 * 1024 * 1024;

export function getImageGenerationProvider(): ImageGenerationProvider {
  const raw = String(process.env.IMAGE_GENERATION_PROVIDER || IMAGE_PROVIDER_DEFAULT).trim().toLowerCase();
  if (raw === "ai_horde" || raw === "gemini" || raw === "openai_compatible") return raw;
  throw new Error("IMAGE_GENERATION_PROVIDER_INVALID");
}

function hasUsableKey(value: unknown): boolean {
  const key = String(value || "").trim();
  return Boolean(key && !/^(PASTE|REPLACE|YOUR_|CHANGE_ME)/i.test(key));
}

export function isImageGenerationConfigured(): boolean {
  try {
    const provider = getImageGenerationProvider();
    if (provider === "ai_horde") return hasUsableKey(process.env.AI_HORDE_API_KEY);
    if (provider === "gemini") return hasUsableKey(process.env.GEMINI_API_KEY);
    return hasUsableKey(process.env.IMAGE_API_KEY)
      && Boolean(String(process.env.IMAGE_API_MODEL || "").trim())
      && Boolean(String(process.env.IMAGE_API_BASE_URL || "").trim());
  } catch {
    return false;
  }
}

function fromBase64Image(encoded: string, mimeValue: string, provider: ImageGenerationProvider): GeneratedImage {
  const mime = String(mimeValue || "image/png").split(";")[0].trim().toLowerCase();
  const mimeToExtension: Record<string, "jpg" | "png" | "webp"> = {
    "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp"
  };
  const extension = mimeToExtension[mime];
  if (!extension) throw new Error("IMAGE_GENERATION_INVALID_IMAGE_TYPE");
  const clean = String(encoded || "").replace(/^data:image\/(?:jpeg|jpg|png|webp);base64,/i, "").trim();
  if (!clean || !/^[A-Za-z0-9+/]+={0,2}$/.test(clean)) throw new Error("IMAGE_GENERATION_INVALID_IMAGE");
  const buffer = Buffer.from(clean, "base64");
  if (!buffer.length || buffer.length > MAX_PROVIDER_RESPONSE_BYTES) throw new Error("IMAGE_GENERATION_IMAGE_TOO_LARGE");
  // Validate actual bytes instead of trusting the response MIME type.
  const detected = inferImage(buffer);
  if (detected.contentType !== (mime === "image/jpg" ? "image/jpeg" : mime)) throw new Error("IMAGE_GENERATION_INVALID_IMAGE_TYPE");
  return { buffer, ...detected, provider };
}

async function providerFetch(url: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(120_000) });
  } catch (error: any) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") throw new Error("IMAGE_GENERATION_TIMEOUT");
    throw new Error("IMAGE_GENERATION_NETWORK_ERROR");
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error("IMAGE_GENERATION_AUTH_FAILED");
    if (response.status === 429) throw new Error("IMAGE_GENERATION_RATE_LIMITED");
    throw new Error(`IMAGE_GENERATION_PROVIDER_HTTP_${response.status}`);
  }
  return response;
}

async function generateGeminiImage(prompt: string, referenceImage?: string): Promise<GeneratedImage> {
  const key = String(process.env.GEMINI_API_KEY || "").trim();
  if (!hasUsableKey(key)) throw new Error("IMAGE_GENERATION_NOT_CONFIGURED");
  const model = String(process.env.GEMINI_IMAGE_MODEL || DEFAULT_GEMINI_IMAGE_MODEL).trim();
  if (!/^[A-Za-z0-9._-]+$/.test(model)) throw new Error("IMAGE_GENERATION_MODEL_INVALID");
  const response = await providerFetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }, ...(referenceImage ? [{ inlineData: { mimeType: referenceImage.slice(5, referenceImage.indexOf(";")), data: referenceImage.split(",")[1] } }] : [])] }],
        generationConfig: { responseModalities: ["IMAGE"] }
      })
    }
  );
  const payload: any = await response.json().catch(() => ({}));
  const parts = payload?.candidates?.[0]?.content?.parts;
  const output = Array.isArray(parts) ? parts.find((part: any) => part?.inlineData?.data || part?.inline_data?.data) : null;
  const data = output?.inlineData?.data || output?.inline_data?.data;
  const mime = output?.inlineData?.mimeType || output?.inline_data?.mime_type || "image/png";
  if (!data) throw new Error("IMAGE_GENERATION_NO_IMAGE");
  return { ...fromBase64Image(String(data), String(mime), "gemini"), model };
}

async function downloadProviderImage(urlValue: string, provider: ImageGenerationProvider): Promise<GeneratedImage> {
  let url: URL;
  try { url = new URL(urlValue); } catch { throw new Error("IMAGE_GENERATION_INVALID_IMAGE_URL"); }
  if (url.protocol !== "https:") throw new Error("IMAGE_GENERATION_INVALID_IMAGE_URL");
  let response: Response;
  try { response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(30_000) }); }
  catch { throw new Error("IMAGE_GENERATION_IMAGE_DOWNLOAD_FAILED"); }
  if (!response.ok) throw new Error("IMAGE_GENERATION_IMAGE_DOWNLOAD_FAILED");
  const type = (response.headers.get("content-type") || "").split(";")[0].toLowerCase();
  if (!/^image\/(jpeg|png|webp)$/.test(type)) throw new Error("IMAGE_GENERATION_INVALID_IMAGE_TYPE");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_PROVIDER_RESPONSE_BYTES) throw new Error("IMAGE_GENERATION_IMAGE_TOO_LARGE");
  const detected = inferImage(buffer);
  return { buffer, ...detected, provider };
}

function openAICompatibleUrl(): string {
  const raw = String(process.env.IMAGE_API_BASE_URL || "").trim().replace(/\/+$/, "");
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("IMAGE_API_BASE_URL_INVALID"); }
  const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.protocol !== "https:" && !localHttp) throw new Error("IMAGE_API_BASE_URL_INVALID");
  if (url.pathname.endsWith("/images/generations")) return url.toString();
  return `${raw}/images/generations`;
}

async function generateOpenAICompatibleImage(prompt: string, referenceImage?: string): Promise<GeneratedImage> {
  const apiKey = String(process.env.IMAGE_API_KEY || "").trim();
  const model = String(process.env.IMAGE_API_MODEL || "").trim();
  if (!hasUsableKey(apiKey) || !model || !String(process.env.IMAGE_API_BASE_URL || "").trim()) {
    throw new Error("IMAGE_GENERATION_NOT_CONFIGURED");
  }
  const form = referenceImage ? new FormData() : null;
  if (form && referenceImage) {
    const bytes = Buffer.from(referenceImage.split(",")[1], "base64");
    const image = inferImage(bytes);
    form.set("model", model); form.set("prompt", prompt); form.set("size", "1024x1024");
    form.set("image", new Blob([new Uint8Array(bytes)], { type: image.contentType }), `reference.${image.extension}`);
  }
  const response = await providerFetch(form ? openAICompatibleUrl().replace(/\/images\/generations\/?$/, "/images/edits") : openAICompatibleUrl(), {
    method: "POST",
    headers: { ...(form ? {} : { "Content-Type": "application/json" }), Authorization: `Bearer ${apiKey}` },
    body: form || JSON.stringify({ model, prompt, n: 1, size: "1024x1024" })
  });
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (contentType.startsWith("image/")) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > MAX_PROVIDER_RESPONSE_BYTES) throw new Error("IMAGE_GENERATION_IMAGE_TOO_LARGE");
    return { buffer, ...inferImage(buffer), provider: "openai_compatible", model };
  }
  const payload: any = await response.json().catch(() => ({}));
  const item = payload?.data?.[0] || payload?.images?.[0] || payload?.output?.[0];
  const encoded = item?.b64_json || item?.base64 || item?.image_base64 || item?.data;
  if (typeof encoded === "string") {
    const mime = item?.mime_type || item?.mimeType || payload?.mime_type || "image/png";
    return { ...fromBase64Image(encoded, String(mime), "openai_compatible"), model };
  }
  const imageUrl = item?.url || item?.image_url || payload?.url;
  if (typeof imageUrl === "string") return { ...(await downloadProviderImage(imageUrl, "openai_compatible")), model };
  throw new Error("IMAGE_GENERATION_NO_IMAGE");
}

/** Check the admin-configured image provider first, then fall back to backend/.env. */
export async function hasConfiguredImageGenerator(): Promise<boolean> {
  try {
    if (await activeAIProvider("image")) return true;
  } catch (error: any) {
    if (String(error?.message || "").startsWith("AI_PROVIDER_REGISTRY")) throw error;
  }
  return isImageGenerationConfigured();
}

/** Uses the active Admin AI API when configured, otherwise the environment provider. */
export async function generateConfiguredImage(prompt: string, referenceImage?: string): Promise<GeneratedImage> {
  const cleanPrompt = String(prompt || "").trim();
  if (cleanPrompt.length < 5 || cleanPrompt.length > 1200) throw new Error("AI_IMAGE_PROMPT_INVALID");
  if (referenceImage) {
    if (!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(referenceImage)) throw new Error("IMAGE_GENERATION_INVALID_REFERENCE");
    const buffer = Buffer.from(referenceImage.split(",")[1], "base64");
    if (buffer.length > 8 * 1024 * 1024) throw new Error("IMAGE_GENERATION_INVALID_REFERENCE");
    inferImage(buffer);
  }
  const adminProvider = await activeAIProvider("image");
  if (adminProvider) {
    const generated = await generateImageWithProvider(adminProvider, cleanPrompt, referenceImage);
    return { ...generated, provider: adminProvider.preset as ImageGenerationProvider };
  }
  const provider = getImageGenerationProvider();
  if (!isImageGenerationConfigured()) throw new Error("IMAGE_GENERATION_NOT_CONFIGURED");
  if (provider === "ai_horde") { if (referenceImage) throw new Error("IMAGE_GENERATION_REFERENCE_UNSUPPORTED"); return { ...(await generateAiHordeImage(cleanPrompt)), provider }; }
  if (provider === "gemini") return generateGeminiImage(cleanPrompt, referenceImage);
  return generateOpenAICompatibleImage(cleanPrompt, referenceImage);
}
