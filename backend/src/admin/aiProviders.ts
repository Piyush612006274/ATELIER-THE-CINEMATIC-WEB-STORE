import crypto from "node:crypto";
import { prisma } from "../database/prisma.js";
import { readProviderStream } from "../lib/provider-stream.js";

export type AIProviderPreset = "openai" | "gemini" | "anthropic" | "groq" | "openrouter" | "deepseek" | "mistral" | "custom_openai" | "custom_json";
export type AIProviderMode = "url" | "json";
export type AIProviderCapability = "chat" | "image" | "tryon";

export type AIProviderConfig = {
  id: string;
  name: string;
  preset: AIProviderPreset;
  mode: AIProviderMode;
  apiKey: string;
  endpoint: string;
  imageEndpoint: string;
  model: string;
  imageModel: string;
  tryOnModel: string;
  enabled: boolean;
  supportsChat: boolean;
  supportsImage: boolean;
  supportsTryOn: boolean;
  defaultChat: boolean;
  defaultImage: boolean;
  defaultTryOn: boolean;
  chatHeadersJson: string;
  chatBodyTemplate: string;
  chatResponsePath: string;
  imageHeadersJson: string;
  imageBodyTemplate: string;
  imageResponsePath: string;
  tryOnMode: AIProviderMode;
  tryOnEndpoint: string;
  tryOnHeadersJson: string;
  tryOnBodyTemplate: string;
  tryOnResponsePath: string;
};

type PublicAIProvider = Omit<AIProviderConfig, "apiKey"> & { apiKey: ""; apiKeyConfigured: boolean; apiKeyHint: string };
type ChatMedia = { name: string; mimeType: string; dataBase64: string };
type ChatRequest = { system: string; message: string; history: Array<{ role: "user" | "assistant"; content: string }>; developmentMode?: boolean; media?: ChatMedia[]; onDelta?: (text: string) => void; signal?: AbortSignal };
type ImageResult = { buffer: Buffer; contentType: "image/jpeg" | "image/png" | "image/webp"; extension: "jpg" | "png" | "webp"; model: string; provider: string };

const SETTING_KEY = "__atelier_ai_provider_registry_v1";
const REGISTRY_VERSION = 1;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const SAFE_PRESETS = new Set<AIProviderPreset>(["openai", "gemini", "anthropic", "groq", "openrouter", "deepseek", "mistral", "custom_openai", "custom_json"]);

function encryptionKey(): Buffer {
  const secret = String(process.env.AI_PROVIDER_ENCRYPTION_KEY || "").trim();
  if (secret.length < 64 || /^(replace|change_me|your_)/i.test(secret)) throw new Error("AI_PROVIDER_ENCRYPTION_KEY_UNAVAILABLE");
  return crypto.createHash("sha256").update(`ATELIER-AI-PROVIDERS-V1:${secret}`).digest();
}
function seal(value: unknown): Record<string, string | number> {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return { version: REGISTRY_VERSION, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: encrypted.toString("base64") };
}
function unseal(value: unknown): AIProviderConfig[] {
  if (!value || typeof value !== "object") return [];
  const wrapped = value as Record<string, unknown>;
  if (Number(wrapped.version) !== REGISTRY_VERSION || typeof wrapped.iv !== "string" || typeof wrapped.tag !== "string" || typeof wrapped.data !== "string") return [];
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(wrapped.iv, "base64"));
    decipher.setAuthTag(Buffer.from(wrapped.tag, "base64"));
    const raw = Buffer.concat([decipher.update(Buffer.from(wrapped.data, "base64")), decipher.final()]).toString("utf8");
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.filter((x: any) => x && typeof x.id === "string" && SAFE_PRESETS.has(x.preset)).map((x: any) => ({
      ...x,
      supportsTryOn: Boolean(x.supportsTryOn),
      defaultTryOn: Boolean(x.defaultTryOn),
      tryOnMode: x.tryOnMode === "url" ? "url" : "json",
      tryOnModel: String(x.tryOnModel || x.imageModel || x.model || ""),
      tryOnEndpoint: String(x.tryOnEndpoint || ""),
      tryOnHeadersJson: String(x.tryOnHeadersJson || '{"Authorization":"Bearer {{apiKey}}","Content-Type":"application/json"}'),
      tryOnBodyTemplate: String(x.tryOnBodyTemplate || '{"model":"{{model}}","person_image":"{{photoDataUrl}}","garment_image":"{{clothingImageUrl}}","prompt":"{{clothingPrompt}}","seed":{{seed}}}'),
      tryOnResponsePath: String(x.tryOnResponsePath || "image_url")
    }));
  } catch (error: any) {
    if (String(error?.message || "").includes("AI_PROVIDER_ENCRYPTION_KEY_UNAVAILABLE")) throw error;
    console.error("AI provider registry could not be decrypted. Check whether AI_PROVIDER_ENCRYPTION_KEY changed or was lost.");
    throw new Error("AI_PROVIDER_REGISTRY_DECRYPT_FAILED");
  }
}
async function readRegistry(): Promise<AIProviderConfig[]> {
  const row = await prisma.siteSetting.findUnique({ where: { key: SETTING_KEY } });
  return row ? unseal(row.value) : [];
}
async function writeRegistry(providers: AIProviderConfig[]): Promise<void> {
  const value = seal(providers);
  await prisma.siteSetting.upsert({ where: { key: SETTING_KEY }, update: { value: value as any }, create: { key: SETTING_KEY, value: value as any } });
}

function safeHeaderJson(raw: string): string {
  try {
    const headers = JSON.parse(raw || "{}");
    if (!headers || typeof headers !== "object" || Array.isArray(headers)) throw new Error();
    for (const [key, value] of Object.entries(headers)) {
      if (typeof value !== "string") throw new Error(`Header ${key} must be a string.`);
    }
    return JSON.stringify(headers, null, 2);
  } catch (error: any) {
    if (String(error?.message || "").startsWith("Header ")) throw error;
    throw new Error("AI_PROVIDER_HEADERS_JSON_INVALID");
  }
}
function safeTemplate(raw: string, fallback: string, limit = 30000): string {
  const result = String(raw || fallback).trim();
  if (result.length > limit) throw new Error("AI_PROVIDER_TEMPLATE_TOO_LARGE");
  if (result) {
    // Validate JSON templates before runtime substitution. Scalar placeholders are
    // normally quoted; history/messages may be inserted as raw JSON objects/arrays.
    const validation = result
      .replace(/"\{\{\s*[A-Za-z0-9_]+\s*\}\}"/g, '"placeholder"')
      .replace(/\{\{\s*(?:history|messages)\s*\}\}/g, "[]")
      .replace(/\{\{\s*[A-Za-z0-9_]+\s*\}\}/g, '"placeholder"');
    try { JSON.parse(validation); } catch { throw new Error("AI_PROVIDER_BODY_JSON_INVALID"); }
  }
  return result;
}
function safeEndpoint(raw: string, allowEmpty = false): string {
  const value = String(raw || "").trim();
  if (!value && allowEmpty) return "";
  if (!value || value.length > 1600 || /[\s<>"']/.test(value)) throw new Error("AI_PROVIDER_ENDPOINT_INVALID");
  let url: URL;
  try { url = new URL(value.replace(/\{\{(?:model|apiKey)\}\}/g, "placeholder")); } catch { throw new Error("AI_PROVIDER_ENDPOINT_INVALID"); }
  const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !localHttp) throw new Error("AI_PROVIDER_ENDPOINT_MUST_USE_HTTPS");
  return value;
}
function redactLiteralSecret(value: string, apiKey: string): string {
  let output = String(value || "");
  if (apiKey && apiKey.length >= 4) output = output.split(apiKey).join("{{apiKey}}");
  // Also hide common inline secret fields if somebody pasted them into a template.
  output = output.replace(/("(?:api[_-]?key|access[_-]?token|token|secret|authorization)"\s*:\s*")[^"\r\n]*(")/gi, '$1{{apiKey}}$2');
  output = output.replace(/([?&](?:api[_-]?key|apikey|access[_-]?token|token|secret|authorization)=)[^&#]*/gi, "$1{{apiKey}}");
  return output;
}
function maskedHeaderJson(raw: string, apiKey = ""): string {
  try {
    const headers = JSON.parse(redactLiteralSecret(raw || "{}", apiKey));
    for (const [key, value] of Object.entries(headers)) {
      if (/^(authorization|x-api-key|api-key|x-goog-api-key|anthropic-api-key)$/i.test(key) && typeof value === "string" && !value.includes("{{apiKey}}")) {
        headers[key] = /bearer\s/i.test(value) ? "Bearer {{apiKey}}" : "{{apiKey}}";
      }
    }
    return JSON.stringify(headers, null, 2);
  } catch { return "{}"; }
}
function hasKey(p: AIProviderConfig): boolean { return Boolean(String(p.apiKey || "").trim()); }
function publicItem(p: AIProviderConfig): PublicAIProvider {
  const { apiKey, ...safe } = p;
  return {
    ...safe,
    endpoint: redactLiteralSecret(p.endpoint, apiKey),
    imageEndpoint: redactLiteralSecret(p.imageEndpoint, apiKey),
    tryOnEndpoint: redactLiteralSecret(p.tryOnEndpoint || "", apiKey),
    chatBodyTemplate: redactLiteralSecret(p.chatBodyTemplate, apiKey),
    imageBodyTemplate: redactLiteralSecret(p.imageBodyTemplate, apiKey),
    chatHeadersJson: maskedHeaderJson(p.chatHeadersJson, apiKey),
    imageHeadersJson: maskedHeaderJson(p.imageHeadersJson, apiKey),
    tryOnHeadersJson: maskedHeaderJson(p.tryOnHeadersJson || "{}", apiKey),
    tryOnBodyTemplate: redactLiteralSecret(p.tryOnBodyTemplate || "", apiKey),
    apiKey: "",
    apiKeyConfigured: hasKey(p),
    apiKeyHint: apiKey ? `••••${apiKey.slice(-4)}` : "Not set"
  };
}
export async function listAIProviders(): Promise<PublicAIProvider[]> { return (await readRegistry()).map(publicItem); }
export async function activeAIProvider(capability: AIProviderCapability): Promise<AIProviderConfig | null> {
  const list = await readRegistry();
  const provider = list.find(p => p.enabled && (capability === "chat" ? p.defaultChat && p.supportsChat : capability === "tryon" ? p.defaultTryOn && p.supportsTryOn : p.defaultImage && p.supportsImage));
  return provider || null;
}

export async function saveAIProvider(input: any): Promise<PublicAIProvider[]> {
  const preset = String(input.preset || "custom_json") as AIProviderPreset;
  if (!SAFE_PRESETS.has(preset)) throw new Error("AI_PROVIDER_PRESET_INVALID");
  const id = String(input.id || crypto.randomUUID());
  const providers = await readRegistry();
  const old = providers.find(p => p.id === id);
  const apiKeyInput = String(input.apiKey || "").trim();
  let apiKey = old?.apiKey || "";
  if (input.clearApiKey === true) apiKey = "";
  if (apiKeyInput) apiKey = apiKeyInput;
  const mode = String(input.mode || "url") === "json" ? "json" : "url";
  const supportsChat = Boolean(input.supportsChat);
  const supportsImage = Boolean(input.supportsImage);
  const supportsTryOn = Boolean(input.supportsTryOn ?? old?.supportsTryOn ?? false);
  let endpoint = safeEndpoint(String(input.endpoint || ""), !supportsChat);
  let imageEndpoint = safeEndpoint(String(input.imageEndpoint || ""), !supportsImage);
  let tryOnEndpoint = safeEndpoint(String(input.tryOnEndpoint ?? old?.tryOnEndpoint ?? ""), !supportsTryOn);
  const model = String(input.model || old?.model || "").trim().slice(0, 200);
  const imageModel = String(input.imageModel || old?.imageModel || input.model || "").trim().slice(0, 200);
  const tryOnModel = String(input.tryOnModel || old?.tryOnModel || imageModel || model || "").trim().slice(0, 200);
  if (mode === "url" && supportsChat && !endpoint) throw new Error("AI_PROVIDER_CHAT_ENDPOINT_REQUIRED");
  if (mode === "url" && supportsImage && !imageEndpoint) throw new Error("AI_PROVIDER_IMAGE_ENDPOINT_REQUIRED");
  if (mode === "url" && supportsChat && !model) throw new Error("AI_PROVIDER_CHAT_MODEL_REQUIRED");
  if (mode === "url" && supportsImage && !imageModel) throw new Error("AI_PROVIDER_IMAGE_MODEL_REQUIRED");
  if (mode === "json" && supportsChat && !endpoint) throw new Error("AI_PROVIDER_CHAT_ENDPOINT_REQUIRED");
  if (mode === "json" && supportsImage && !imageEndpoint) throw new Error("AI_PROVIDER_IMAGE_ENDPOINT_REQUIRED");
  const tryOnMode = String(input.tryOnMode ?? old?.tryOnMode ?? "json") === "url" ? "url" : "json";
  if (supportsTryOn && !tryOnEndpoint) throw new Error("AI_PROVIDER_TRYON_ENDPOINT_REQUIRED");
  const normalized: AIProviderConfig = {
    id,
    name: String(input.name || preset).trim().slice(0, 80) || preset,
    preset,
    mode,
    apiKey,
    endpoint,
    imageEndpoint,
    model,
    imageModel,
    tryOnModel,
    enabled: input.enabled !== false,
    supportsChat,
    supportsImage,
    supportsTryOn,
    defaultChat: Boolean(input.defaultChat && supportsChat && input.enabled !== false),
    defaultImage: Boolean(input.defaultImage && supportsImage && input.enabled !== false),
    defaultTryOn: Boolean(input.defaultTryOn && supportsTryOn && input.enabled !== false),
    chatHeadersJson: safeHeaderJson(String(input.chatHeadersJson || "{}")),
    chatBodyTemplate: safeTemplate(String(input.chatBodyTemplate || ""), '{"model":"{{model}}","messages":{{messages}},"temperature":0.5,"max_tokens":700}'),
    chatResponsePath: String(input.chatResponsePath || "choices.0.message.content").trim().slice(0, 200),
    imageHeadersJson: safeHeaderJson(String(input.imageHeadersJson || "{}")),
    imageBodyTemplate: safeTemplate(String(input.imageBodyTemplate || old?.imageBodyTemplate || ""), '{"model":"{{model}}","prompt":"{{prompt}}","n":1,"size":"1024x1024"}'),
    imageResponsePath: String(input.imageResponsePath || old?.imageResponsePath || "data.0.b64_json").trim().slice(0, 200),
    tryOnMode,
    tryOnEndpoint,
    tryOnHeadersJson: safeHeaderJson(String(input.tryOnHeadersJson ?? old?.tryOnHeadersJson ?? '{"Authorization":"Bearer {{apiKey}}","Content-Type":"application/json"}')),
    tryOnBodyTemplate: safeTemplate(String(input.tryOnBodyTemplate ?? old?.tryOnBodyTemplate ?? '{"model":"{{model}}","person_image":"{{photoDataUrl}}","garment_image":"{{clothingImageUrl}}","prompt":"{{clothingPrompt}}","seed":{{seed}}}'), '{"model":"{{model}}","person_image":"{{photoDataUrl}}","garment_image":"{{clothingImageUrl}}","prompt":"{{clothingPrompt}}","seed":{{seed}}}'),
    tryOnResponsePath: String(input.tryOnResponsePath ?? old?.tryOnResponsePath ?? "image_url").trim().slice(0, 200)
  };
  if (!normalized.supportsChat && !normalized.supportsImage && !normalized.supportsTryOn) throw new Error("AI_PROVIDER_SELECT_CAPABILITY");
  const merged = providers.filter(p => p.id !== id).map(p => ({ ...p, defaultChat: normalized.defaultChat ? false : p.defaultChat, defaultImage: normalized.defaultImage ? false : p.defaultImage, defaultTryOn: normalized.defaultTryOn ? false : Boolean((p as any).defaultTryOn) }));
  merged.push(normalized);
  await writeRegistry(merged);
  return merged.map(publicItem);
}
export async function deleteAIProvider(id: string): Promise<PublicAIProvider[]> {
  const providers = await readRegistry();
  await writeRegistry(providers.filter(p => p.id !== id));
  return (await readRegistry()).map(publicItem);
}

function getPath(value: any, path: string): any {
  const parts = String(path || "").trim().split(".").filter(Boolean);
  let current = value;
  for (const part of parts) current = current == null ? undefined : current[part];
  return current;
}
function templateReplace(template: string, values: Record<string, any>): string {
  return String(template).replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_all, key: string, offset: number, full: string) => {
    const value = values[key];
    if (value === undefined) return "";
    if (value && typeof value === "object") {
      // Object/array placeholders must not be wrapped in quotes in a JSON template.
      const before = full[offset - 1]; const after = full[offset + _all.length];
      if (before === '"' && after === '"') return JSON.stringify(JSON.stringify(value)).slice(1, -1);
      return JSON.stringify(value);
    }
    const text = String(value);
    return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "\\r").replace(/\n/g, "\\n");
  });
}
function renderObject(raw: string, vars: Record<string, any>): Record<string, string> {
  const parsed = JSON.parse(raw || "{}");
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) if (typeof value === "string") out[key] = templateReplace(value, vars);
  return out;
}
function completionEndpoint(endpoint: string): string {
  const raw = templateReplace(endpoint, { model: "{{model}}" }).replace(/\{\{model\}\}/g, "{model}").replace(/\/$/, "");
  if (/\/chat\/completions$/i.test(raw)) return raw;
  if (/\/v\d+(?:beta)?$/i.test(raw)) return `${raw}/chat/completions`;
  return `${raw}/v1/chat/completions`;
}
function imageGenerationEndpoint(endpoint: string): string {
  const raw = endpoint.replace(/\/$/, "");
  if (/\/images\/generations$/i.test(raw)) return raw;
  if (/\/v\d+$/i.test(raw)) return `${raw}/images/generations`;
  return `${raw}/v1/images/generations`;
}
function urlWithModel(endpoint: string, model: string, apiKey = ""): string { return endpoint.replace(/\{\{\s*model\s*\}\}/g, encodeURIComponent(model)).replace(/\{\{\s*apiKey\s*\}\}/g, encodeURIComponent(apiKey)); }
async function fetchWithTimeout(url: string, init: RequestInit, timeout = 60_000): Promise<Response> {
  try { return await fetch(url, { ...init, signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout) }); }
  catch (error: any) { if (error?.name === "TimeoutError" || error?.name === "AbortError") throw new Error("AI_PROVIDER_TIMEOUT"); throw new Error("AI_PROVIDER_NETWORK_ERROR"); }
}
function parseProviderError(_payload: any, status: number): never {
  if (status === 401 || status === 403) throw new Error("AI_PROVIDER_AUTH_FAILED");
  if (status === 429) throw new Error("AI_PROVIDER_RATE_LIMITED");
  throw new Error(`AI_PROVIDER_HTTP_${status}`);
}
function asStringContent(value: any): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map((x: any) => typeof x === "string" ? x : String(x?.text || "")).filter(Boolean).join("\n").trim();
  return "";
}
function providerHeaders(provider: AIProviderConfig, capability: AIProviderCapability): Record<string, string> {
  const raw = capability === "chat" ? provider.chatHeadersJson : capability === "tryon" ? (provider.tryOnHeadersJson || "{}") : provider.imageHeadersJson;
  const custom = renderObject(raw, { apiKey: provider.apiKey, model: capability === "chat" ? provider.model : capability === "tryon" ? provider.tryOnModel : provider.imageModel });
  const headers: Record<string, string> = { "Content-Type": "application/json", ...custom };
  const hasAuth = Object.keys(headers).some(key => /^(authorization|x-api-key|api-key|x-goog-api-key|anthropic-api-key)$/i.test(key));
  if (!hasAuth && provider.apiKey) {
    if (provider.preset === "gemini") headers["x-goog-api-key"] = provider.apiKey;
    else if (provider.preset === "anthropic") headers["x-api-key"] = provider.apiKey;
    else headers.Authorization = `Bearer ${provider.apiKey}`;
  }
  if (provider.preset === "anthropic" && provider.mode === "url" && capability === "chat") headers["anthropic-version"] = headers["anthropic-version"] || "2023-06-01";
  return headers;
}
function parseChatPayload(payload: any, provider: AIProviderConfig): string {
  let text: any;
  if (provider.mode === "json") text = getPath(payload, provider.chatResponsePath);
  else if (provider.preset === "gemini") text = payload?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || "").join("\n");
  else if (provider.preset === "anthropic") text = payload?.content?.map((part: any) => part?.text || "").join("\n");
  else text = payload?.choices?.[0]?.message?.content ?? payload?.output_text;
  const content = asStringContent(text);
  if (!content) throw new Error("AI_PROVIDER_EMPTY_RESPONSE");
  return content;
}
export async function generateChatWithProvider(provider: AIProviderConfig, input: ChatRequest): Promise<string> {
  if (!provider.apiKey) throw new Error("AI_PROVIDER_API_KEY_MISSING");
  const media = input.media || [];
  if (media.some(item => item.mimeType.startsWith("video/")) && provider.preset !== "gemini") throw new Error("CHAT_VIDEO_REQUIRES_GEMINI");
  if (provider.mode === "json" && media.length) throw new Error("CHAT_ATTACHMENT_PROVIDER_UNSUPPORTED");
  const history = input.history.slice(input.developmentMode ? -24 : -10).map(item => ({ role: item.role, content: item.content.slice(0, input.developmentMode ? 12000 : 4000) }));
  const mediaContent = [{ type: "text", text: input.message }, ...media.filter(item => item.mimeType.startsWith("image/")).map(item => ({ type: "image_url", image_url: { url: `data:${item.mimeType};base64,${item.dataBase64}` } }))];
  const messages = [{ role: "system", content: input.system }, ...history, { role: "user", content: media.length ? mediaContent : input.message }];
  let endpoint = provider.endpoint;
  let body: any;
  let headers = providerHeaders(provider, "chat");
  if (provider.mode === "json") {
    endpoint = urlWithModel(endpoint, provider.model, provider.apiKey);
    const template = templateReplace(provider.chatBodyTemplate, { model: provider.model, message: input.message, prompt: input.message, userMessage: input.message, question: input.message, system: input.system, systemPrompt: input.system, fullPrompt: `${input.system}\n\n${input.message}`, history, messages, apiKey: provider.apiKey, cart: [], catalogue: [] });
    try { body = JSON.parse(template); } catch { throw new Error("AI_PROVIDER_BODY_JSON_INVALID"); }
  } else if (provider.preset === "gemini") {
    endpoint = urlWithModel(endpoint, provider.model, provider.apiKey);
    const cleanEndpoint = endpoint.includes(":generateContent") ? endpoint : `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(provider.model)}:generateContent`;
    endpoint = cleanEndpoint;
    body = { systemInstruction: { parts: [{ text: input.system }] }, contents: [...history.map(item => ({ role: item.role === "assistant" ? "model" : "user", parts: [{ text: item.content }] })), { role: "user", parts: [{ text: input.message }, ...media.map(item => ({ inline_data: { mime_type: item.mimeType, data: item.dataBase64 } }))] }], generationConfig: { temperature: 0.55, maxOutputTokens: 700 } };
  } else if (provider.preset === "anthropic") {
    endpoint = endpoint || "https://api.anthropic.com/v1/messages";
    const content = media.length ? [{ type: "text", text: input.message }, ...media.filter(item => item.mimeType.startsWith("image/")).map(item => ({ type: "image", source: { type: "base64", media_type: item.mimeType, data: item.dataBase64 } }))] : input.message;
    body = { model: provider.model, system: input.system, messages: [...history, { role: "user", content }], max_tokens: 700, temperature: 0.55 };
  } else {
    endpoint = completionEndpoint(urlWithModel(endpoint, provider.model, provider.apiKey));
    body = { model: provider.model, messages, temperature: 0.55, max_tokens: 700 };
  }
  if (provider.mode === "json") headers = providerHeaders(provider, "chat");
  const streaming = Boolean(input.onDelta && provider.mode !== "json");
  if (streaming) {
    if (provider.preset === "gemini") {
      const url = new URL(endpoint.replace(":generateContent", ":streamGenerateContent"));
      url.searchParams.set("alt", "sse"); endpoint = url.toString();
    } else body.stream = true;
  }
  const response = await fetchWithTimeout(endpoint, { method: "POST", headers, body: JSON.stringify(body), signal: input.signal }, 45_000);
  if (streaming && response.ok && response.headers.get("content-type")?.includes("text/event-stream")) return readProviderStream(response, provider.preset, input.onDelta!);
  const payload: any = await response.json().catch(() => ({}));
  if (!response.ok) parseProviderError(payload, response.status);
  const reply = parseChatPayload(payload, provider);
  input.onDelta?.(reply);
  return reply;
}

function detectImage(buffer: Buffer): { contentType: ImageResult["contentType"]; extension: ImageResult["extension"] } {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return { contentType: "image/png", extension: "png" };
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return { contentType: "image/webp", extension: "webp" };
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { contentType: "image/jpeg", extension: "jpg" };
  throw new Error("AI_PROVIDER_INVALID_IMAGE_RESPONSE");
}
function extractImageValue(payload: any, provider: AIProviderConfig): string {
  const value = provider.mode === "json" ? getPath(payload, provider.imageResponsePath) : payload?.data?.[0]?.b64_json ?? payload?.images?.[0]?.base64 ?? payload?.output?.[0]?.b64_json ?? payload?.data?.[0]?.url ?? payload?.images?.[0]?.url;
  if (typeof value === "string") return value;
  if (value && typeof value === "object") return String(value.b64_json || value.base64 || value.image_base64 || value.url || value.image_url || "");
  return "";
}
async function downloadImage(url: string): Promise<Buffer> {
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error("AI_PROVIDER_IMAGE_URL_INVALID"); }
  const localHttp = parsed.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !localHttp) throw new Error("AI_PROVIDER_IMAGE_URL_INVALID");
  const response = await fetchWithTimeout(url, { method: "GET", redirect: "error" }, 30_000);
  if (!response.ok) throw new Error("AI_PROVIDER_IMAGE_DOWNLOAD_FAILED");
  const type = (response.headers.get("content-type") || "").split(";")[0].toLowerCase();
  if (!/^image\/(jpeg|png|webp)$/.test(type)) throw new Error("AI_PROVIDER_INVALID_IMAGE_RESPONSE");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new Error("AI_PROVIDER_IMAGE_TOO_LARGE");
  detectImage(buffer);
  return buffer;
}
function dataUrlBuffer(value: string): Buffer | null {
  const match = /^data:image\/(?:jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/i.exec(value);
  if (match) return Buffer.from(match[1], "base64");
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length > 100) return Buffer.from(value, "base64");
  return null;
}
export async function generateImageWithProvider(provider: AIProviderConfig, prompt: string, referenceImage?: string): Promise<ImageResult> {
  if (!provider.apiKey) throw new Error("AI_PROVIDER_API_KEY_MISSING");
  const selectedModel = provider.imageModel || provider.model;
  let endpoint = provider.imageEndpoint;
  let headers = providerHeaders(provider, "image");
  let body: any;
  let multipart: FormData | undefined;
  const reference = referenceImage ? dataUrlBuffer(referenceImage) : null;
  if (referenceImage && (!reference || reference.length > MAX_IMAGE_BYTES)) throw new Error("IMAGE_GENERATION_INVALID_REFERENCE");
  if (reference) detectImage(reference);
  if (provider.mode === "json") {
    if (referenceImage && !provider.imageBodyTemplate.includes("{{referenceImage}}")) throw new Error("IMAGE_GENERATION_REFERENCE_UNSUPPORTED");
    endpoint = urlWithModel(endpoint, selectedModel, provider.apiKey);
    const template = templateReplace(provider.imageBodyTemplate, { model: selectedModel, prompt, apiKey: provider.apiKey, referenceImage: referenceImage || "" });
    try { body = JSON.parse(template); } catch { throw new Error("AI_PROVIDER_BODY_JSON_INVALID"); }
  } else if (provider.preset === "gemini") {
    endpoint = urlWithModel(endpoint, selectedModel, provider.apiKey);
    if (!endpoint.includes(":generateContent")) endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selectedModel)}:generateContent`;
    body = { contents: [{ role: "user", parts: [{ text: prompt }, ...(reference ? [{ inlineData: { mimeType: detectImage(reference).contentType, data: reference.toString("base64") } }] : [])] }], generationConfig: { responseModalities: ["IMAGE"] } };
  } else {
    endpoint = imageGenerationEndpoint(urlWithModel(endpoint, selectedModel, provider.apiKey));
    body = { model: selectedModel, prompt, n: 1, size: "1024x1024" };
    if (reference) {
      endpoint = endpoint.replace(/\/images\/generations\/?$/, "/images/edits");
      multipart = new FormData();
      multipart.set("model", selectedModel); multipart.set("prompt", prompt); multipart.set("size", "1024x1024");
      multipart.set("image", new Blob([new Uint8Array(reference)], { type: detectImage(reference).contentType }), "reference." + detectImage(reference).extension);
      headers = Object.fromEntries(Object.entries(headers).filter(([key]) => key.toLowerCase() !== "content-type"));
    }
  }
  const response = await fetchWithTimeout(endpoint, { method: "POST", headers, body: multipart || JSON.stringify(body) }, 120_000);
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  let buffer: Buffer;
  if (contentType.startsWith("image/")) {
    buffer = Buffer.from(await response.arrayBuffer());
  } else {
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok) parseProviderError(payload, response.status);
    let value = extractImageValue(payload, provider);
    if (!value && provider.preset === "gemini") {
      const parts = payload?.candidates?.[0]?.content?.parts || [];
      const part = parts.find((item: any) => item?.inlineData?.data || item?.inline_data?.data);
      value = part?.inlineData?.data || part?.inline_data?.data || "";
    }
    if (!value) throw new Error("AI_PROVIDER_NO_IMAGE_IN_RESPONSE");
    if (/^https?:\/\//i.test(value)) buffer = await downloadImage(value);
    else {
      const decoded = dataUrlBuffer(value);
      if (!decoded) throw new Error("AI_PROVIDER_INVALID_IMAGE_RESPONSE");
      buffer = decoded;
    }
  }
  if (!response.ok) parseProviderError({}, response.status);
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new Error("AI_PROVIDER_IMAGE_TOO_LARGE");
  const detected = detectImage(buffer);
  return { buffer, ...detected, model: selectedModel, provider: provider.preset };
}

export type TryOnProviderRequest = {
  photoDataUrl: string;
  clothingImageUrl: string;
  clothingPrompt?: string;
  avatarSex?: "male" | "female";
  seed: number;
};
export type TryOnProviderResult = { dataUrl: string; seed: number; model: string; provider: string };

export async function generateTryOnWithProvider(provider: AIProviderConfig, input: TryOnProviderRequest): Promise<TryOnProviderResult> {
  if (!provider.apiKey) throw new Error("AI_PROVIDER_API_KEY_MISSING");
  if (!provider.supportsTryOn || !provider.tryOnEndpoint) throw new Error("AI_PROVIDER_TRYON_DISABLED");
  const selectedModel = provider.tryOnModel || provider.imageModel || provider.model || "";
  const endpoint = urlWithModel(provider.tryOnEndpoint, selectedModel, provider.apiKey);
  const headers = providerHeaders(provider, "tryon");
  const defaultTryOnTemplate = '{"model":"{{model}}","person_image":"{{photoDataUrl}}","garment_image":"{{clothingImageUrl}}","prompt":"{{clothingPrompt}}","seed":{{seed}}}';
  const selectedTryOnTemplate = provider.tryOnMode === "json" ? (provider.tryOnBodyTemplate || defaultTryOnTemplate) : defaultTryOnTemplate;
  const template = templateReplace(selectedTryOnTemplate, {
    model: selectedModel,
    apiKey: provider.apiKey,
    photoDataUrl: input.photoDataUrl,
    clothingImageUrl: input.clothingImageUrl,
    clothingPrompt: String(input.clothingPrompt || "").slice(0, 900),
    avatarSex: input.avatarSex || "",
    seed: input.seed
  });
  let body: unknown;
  try { body = JSON.parse(template); } catch { throw new Error("AI_PROVIDER_BODY_JSON_INVALID"); }
  const response = await fetchWithTimeout(endpoint, { method: "POST", headers, body: JSON.stringify(body) }, 120_000);
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  let buffer: Buffer;
  if (contentType.startsWith("image/")) {
    buffer = Buffer.from(await response.arrayBuffer());
  } else {
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok) parseProviderError(payload, response.status);
    let value: any = getPath(payload, provider.tryOnResponsePath || "image_url");
    if (value && typeof value === "object") value = value.image_url || value.url || value.image || value.base64 || value.b64_json || value.data;
    if (typeof value !== "string" || !value.trim()) throw new Error("AI_PROVIDER_TRYON_NO_IMAGE_IN_RESPONSE");
    if (/^https?:\/\//i.test(value)) buffer = await downloadImage(value);
    else {
      const decoded = dataUrlBuffer(value);
      if (!decoded) throw new Error("AI_PROVIDER_INVALID_IMAGE_RESPONSE");
      buffer = decoded;
    }
  }
  if (!response.ok) parseProviderError({}, response.status);
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new Error("AI_PROVIDER_IMAGE_TOO_LARGE");
  const detected = detectImage(buffer);
  return { dataUrl: `data:${detected.contentType};base64,${buffer.toString("base64")}`, seed: input.seed, model: selectedModel, provider: provider.preset };
}

export async function testAIProvider(id: string, capability: AIProviderCapability): Promise<{ ok: true; message: string; model?: string }> {
  const provider = (await readRegistry()).find(item => item.id === id);
  if (!provider) throw new Error("AI_PROVIDER_NOT_FOUND");
  if (capability === "chat") {
    if (!provider.supportsChat) throw new Error("AI_PROVIDER_CHAT_DISABLED");
    const result = await generateChatWithProvider(provider, { system: "You are a concise API connection tester.", message: "Reply with exactly: API connection successful.", history: [] });
    return { ok: true, message: result.slice(0, 200), model: provider.model };
  }
  if (capability === "image") {
    if (!provider.supportsImage) throw new Error("AI_PROVIDER_IMAGE_DISABLED");
    const result = await generateImageWithProvider(provider, "Create a simple, minimal navy blue circle centered on a pure white background. No text.");
    return { ok: true, message: `Image request succeeded (${Math.round(result.buffer.length / 1024)} KB).`, model: result.model };
  }
  if (!provider.supportsTryOn || !provider.tryOnEndpoint) throw new Error("AI_PROVIDER_TRYON_DISABLED");
  return { ok: true, message: "Try-on configuration is saved. Test it through the storefront with a real customer photo and product image.", model: provider.tryOnModel || provider.imageModel || provider.model };
}
