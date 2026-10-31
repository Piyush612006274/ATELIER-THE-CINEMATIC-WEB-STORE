import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const api = read("backend/src/index.ts");
const providers = read("backend/src/admin/aiProviders.ts");
const ai = read("backend/src/lib/ai.ts");
const image = read("backend/src/admin/imageGeneration.ts");
const ui = read("frontend/components/admin/ai-provider-studio.tsx");
const admin = read("frontend/components/storefront/storefront.tsx");
const init = read("backend/tools/init-env.mjs");
const template = read("backend/.env.example");
const builder = read("frontend/components/admin/visual-site-builder.tsx");
const settingsRoute = api.slice(api.indexOf('app.put("/api/admin/settings"'), api.indexOf('\n', api.indexOf('app.put("/api/admin/settings"')));
const checks = [
  ["Admin AI provider list/save/delete/test endpoints are present and admin-guarded", api.includes('app.get("/api/admin/ai/providers",requireAdmin') && api.includes('app.post("/api/admin/ai/providers",requireAdmin') && api.includes('app.delete("/api/admin/ai/providers/:id",requireAdmin') && api.includes('app.post("/api/admin/ai/providers/:id/test",aiImageGenerationRateLimit,requireAdmin')],
  ["API keys are encrypted using AES-GCM and a dedicated master key", providers.includes('createCipheriv("aes-256-gcm"') && providers.includes('createDecipheriv("aes-256-gcm"') && providers.includes('AI_PROVIDER_ENCRYPTION_KEY')],
  ["Provider secrets are redacted from browser responses", providers.includes('apiKeyConfigured: boolean; apiKeyHint: string') && providers.includes('apiKey: ""') && providers.includes('const { apiKey, ...safe } = p')],
  ["Built-in and custom JSON provider modes are supported", providers.includes('"openai"') && providers.includes('"gemini"') && providers.includes('"anthropic"') && providers.includes('"custom_json"') && providers.includes('safeTemplate')],
  ["Provider registry is protected from normal Site Settings GET/PUT operations", api.includes('startsWith("__atelier_")') && settingsRoute.includes('__atelier_')],
  ["Storefront AI chat uses the configured default provider", ai.includes('activeAIProvider("chat")') && ai.includes('generateChatWithProvider(configuredProvider')],
  ["Media Library generation uses configured image provider before env fallback", image.includes('activeAIProvider("image")') && image.includes('generateImageWithProvider(adminProvider, cleanPrompt)')],
  ["Admin navigation exposes AI API Studio", admin.includes('["ai","AI API Studio","ai"]') && admin.includes('<AIProviderStudio onNotify={onNotify}/>') && admin.includes("ai-provider-studio")],
  ["Admin UI provides common presets, JSON request templates, and provider tests", ui.includes('ChatGPT / OpenAI') && ui.includes('Custom JSON API') && ui.includes('Save & test chat') && ui.includes('Save & test image') && ui.includes('imageResponsePath')],
  ["Fresh environment setup creates the separate encryption key", init.includes('setValue(api, "AI_PROVIDER_ENCRYPTION_KEY", randomSecret())') && template.includes('AI_PROVIDER_ENCRYPTION_KEY=')],
  ["Admin UI explains custom API protocol limits and separate API billing", ui.includes("require a dedicated adapter") && ui.includes("OpenAI API billing is separate from a ChatGPT subscription")],
  ["No actual provider credentials are hardcoded in AI provider source", !/sk-[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{20,}|hf_[A-Za-z0-9]{20,}/.test(providers + ui + template)],
  ["Provider configuration supports a separate virtual try-on endpoint/body/response mapping", providers.includes("supportsTryOn") && providers.includes("tryOnBodyTemplate") && providers.includes("generateTryOnWithProvider") && ui.includes("Virtual Try-On API URL / JSON")],
  ["Website reset restores default CMS pages and records confirmation", api.includes('app.post("/api/admin/site/reset", requireAdmin') && api.includes('z.literal("RESET WEBSITE")') && api.includes("factoryReset(prisma")],
  ["Visual builder exposes drag-and-drop guide and universal website reset", builder.includes("visual-builder-howto") && (builder.includes("Factory reset") || builder.includes("Reset website")) && builder.includes("/admin/site/reset")],
  ["Try-on photos use a dedicated bounded JSON parser and are validated before dispatch", api.includes('req.path === "/api/ai/try-on"') && api.includes('express.json({limit:"20mb"})') && ai.includes("parseDataUrl(photoDataUrl, 12 * 1024 * 1024)")]
];
let failures = 0;
for (const [label, pass] of checks) { console.log(`${pass ? "PASS" : "FAIL"} :: ${label}`); if (!pass) failures++; }
console.log(`AI_PROVIDER_STUDIO_AUDIT=${checks.length - failures}/${checks.length} ${failures ? "FAIL" : "PASS"}`);
process.exitCode = failures ? 1 : 0;
