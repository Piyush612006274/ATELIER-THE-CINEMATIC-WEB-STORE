"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

type Preset = "openai" | "gemini" | "anthropic" | "groq" | "openrouter" | "deepseek" | "mistral" | "custom_openai" | "custom_json";
type Provider = {
  id: string;
  name: string;
  preset: Preset;
  mode: "url" | "json";
  apiKey: string;
  apiKeyConfigured?: boolean;
  apiKeyHint?: string;
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
  clearApiKey: boolean;
  chatHeadersJson: string;
  chatBodyTemplate: string;
  chatResponsePath: string;
  imageHeadersJson: string;
  imageBodyTemplate: string;
  imageResponsePath: string;
  tryOnMode: "url" | "json";
  tryOnEndpoint: string;
  tryOnHeadersJson: string;
  tryOnBodyTemplate: string;
  tryOnResponsePath: string;
};

type ProviderRow = Omit<Provider, "apiKey" | "clearApiKey"> & { apiKey: ""; apiKeyConfigured: boolean; apiKeyHint: string };
type Props = { onNotify: (message: string) => void };

const PRESET_DETAILS: Record<Preset, { label: string; chatEndpoint: string; imageEndpoint: string; model: string; imageModel: string; supportsChat: boolean; supportsImage: boolean; mode: "url" | "json"; chatPath: string; imagePath: string }> = {
  openai: { label: "ChatGPT / OpenAI", chatEndpoint: "https://api.openai.com/v1/chat/completions", imageEndpoint: "https://api.openai.com/v1/images/generations", model: "gpt-4o-mini", imageModel: "gpt-image-1", supportsChat: true, supportsImage: true, mode: "url", chatPath: "choices.0.message.content", imagePath: "data.0.b64_json" },
  gemini: { label: "Google Gemini", chatEndpoint: "https://generativelanguage.googleapis.com/v1beta/models/{{model}}:generateContent", imageEndpoint: "https://generativelanguage.googleapis.com/v1beta/models/{{model}}:generateContent", model: "gemini-2.5-flash", imageModel: "gemini-3.1-flash-lite-image", supportsChat: true, supportsImage: true, mode: "url", chatPath: "candidates.0.content.parts.0.text", imagePath: "candidates.0.content.parts.0.inlineData.data" },
  anthropic: { label: "Anthropic Claude", chatEndpoint: "https://api.anthropic.com/v1/messages", imageEndpoint: "", model: "claude-3-5-haiku-latest", imageModel: "", supportsChat: true, supportsImage: false, mode: "url", chatPath: "content.0.text", imagePath: "" },
  groq: { label: "Groq", chatEndpoint: "https://api.groq.com/openai/v1/chat/completions", imageEndpoint: "", model: "llama-3.3-70b-versatile", imageModel: "", supportsChat: true, supportsImage: false, mode: "url", chatPath: "choices.0.message.content", imagePath: "" },
  openrouter: { label: "OpenRouter", chatEndpoint: "https://openrouter.ai/api/v1/chat/completions", imageEndpoint: "", model: "openai/gpt-4o-mini", imageModel: "", supportsChat: true, supportsImage: false, mode: "url", chatPath: "choices.0.message.content", imagePath: "" },
  deepseek: { label: "DeepSeek", chatEndpoint: "https://api.deepseek.com/chat/completions", imageEndpoint: "", model: "deepseek-chat", imageModel: "", supportsChat: true, supportsImage: false, mode: "url", chatPath: "choices.0.message.content", imagePath: "" },
  mistral: { label: "Mistral AI", chatEndpoint: "https://api.mistral.ai/v1/chat/completions", imageEndpoint: "", model: "mistral-small-latest", imageModel: "", supportsChat: true, supportsImage: false, mode: "url", chatPath: "choices.0.message.content", imagePath: "" },
  custom_openai: { label: "Other AI (not in list) · OpenAI-compatible URL", chatEndpoint: "https://api.example.com/v1/chat/completions", imageEndpoint: "https://api.example.com/v1/images/generations", model: "your-chat-model", imageModel: "your-image-model", supportsChat: true, supportsImage: false, mode: "url", chatPath: "choices.0.message.content", imagePath: "data.0.b64_json" },
  custom_json: { label: "Other AI (not in list) · custom JSON", chatEndpoint: "https://api.example.com/chat", imageEndpoint: "https://api.example.com/images", model: "your-model", imageModel: "your-image-model", supportsChat: true, supportsImage: false, mode: "json", chatPath: "choices.0.message.content", imagePath: "data.0.b64_json" }
};

function newDraft(preset: Preset = "openai"): Provider {
  const d = PRESET_DETAILS[preset];
  return {
    id: `provider-${Date.now()}`, name: preset.startsWith("custom_") ? "" : d.label, preset, mode: d.mode, apiKey: "", endpoint: d.chatEndpoint,
    imageEndpoint: d.imageEndpoint, model: d.model, imageModel: d.imageModel, tryOnModel: d.imageModel || d.model, enabled: true,
    supportsChat: d.supportsChat, supportsImage: d.supportsImage, supportsTryOn: false, defaultChat: false, defaultImage: false, defaultTryOn: false,
    clearApiKey: false, chatHeadersJson: "{}",
    chatBodyTemplate: '{\n  "model": "{{model}}",\n  "messages": {{messages}},\n  "temperature": 0.5,\n  "max_tokens": 700\n}',
    chatResponsePath: d.chatPath, imageHeadersJson: "{}",
    imageBodyTemplate: '{\n  "model": "{{model}}",\n  "prompt": "{{prompt}}",\n  "n": 1,\n  "size": "1024x1024"\n}',
    imageResponsePath: d.imagePath,
    tryOnMode: "json",
    tryOnEndpoint: "",
    tryOnHeadersJson: '{\n  "Authorization": "Bearer {{apiKey}}",\n  "Content-Type": "application/json"\n}',
    tryOnBodyTemplate: '{\n  "model": "{{model}}",\n  "person_image": "{{photoDataUrl}}",\n  "garment_image": "{{clothingImageUrl}}",\n  "prompt": "{{clothingPrompt}}",\n  "seed": {{seed}}\n}',
    tryOnResponsePath: "image_url"
  };
}
function formFrom(row: ProviderRow): Provider {
  return { ...row, apiKey: "", clearApiKey: false };
}
function AITextField({ label, value, onChange, type = "text", placeholder, help, full = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; help?: string; full?: boolean }) {
  return <div className={`field${full ? " full" : ""}`}><label>{label}</label><input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || ""} autoComplete={type === "password" ? "new-password" : "off"}/>{help && <small className="settings-help">{help}</small>}</div>;
}
function AITextArea({ label, value, onChange, help }: { label: string; value: string; onChange: (value: string) => void; help?: string }) {
  return <div className="field full"><label>{label}</label><textarea rows={5} spellCheck={false} value={value} onChange={e => onChange(e.target.value)} style={{ fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace", fontSize: 12 }}/>{help && <small className="settings-help">{help}</small>}</div>;
}
function safeMessage(error: any): string {
  const raw = String(error?.message || error || "Request failed");
  if (raw.includes("AI_PROVIDER_ENCRYPTION_KEY_UNAVAILABLE")) return "Add a separate AI_PROVIDER_ENCRYPTION_KEY to backend/.env and restart the API before saving provider credentials.";
  if (raw.includes("AI_PROVIDER_REGISTRY_DECRYPT_FAILED")) return "Saved provider keys could not be decrypted. Restore the original AI_PROVIDER_ENCRYPTION_KEY from your backup.";
  if (raw.includes("AI_PROVIDER_API_KEY_MISSING")) return "Add an API key, save the provider, then test it.";
  return raw.replaceAll("_", " ").slice(0, 220);
}

export function AIProviderStudio({ onNotify }: Props) {
  const [rows, setRows] = useState<ProviderRow[]>([]);
  const [draft, setDraft] = useState<Provider>(newDraft());
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<"chat" | "image" | null>(null);
  const [lastTest, setLastTest] = useState<{ capability: string; message: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<{ providers: ProviderRow[] }>("/admin/ai/providers");
      setRows(Array.isArray(result.providers) ? result.providers : []);
    } catch (error: any) { onNotify(safeMessage(error)); }
    finally { setLoading(false); }
  }, [onNotify]);
  useEffect(() => { void load(); }, [load]);

  const set = (key: keyof Provider, value: any) => setDraft(current => ({ ...current, [key]: value }));
  const selectPreset = (preset: Preset) => {
    const next = newDraft(preset);
    const presetLabels = Object.values(PRESET_DETAILS).map(x => x.label);
    setDraft(current => ({ ...next, name: current.name.trim() && !presetLabels.includes(current.name) ? current.name : next.name, id: current.id || next.id, apiKey: current.apiKey, clearApiKey: current.clearApiKey }));
    setLastTest(null);
  };
  const edit = (row: ProviderRow) => { setDraft(formFrom(row)); setEditing(true); setLastTest(null); };
  const startNew = () => { setDraft(newDraft()); setEditing(true); setLastTest(null); };
  const startNewByName = () => { setDraft(newDraft("custom_openai")); setEditing(true); setLastTest(null); setTimeout(() => document.getElementById("ai-name-input")?.focus(), 80); };

  const saveDraft = async (): Promise<string | null> => {
    if (saving) return null;
    if (!draft.name.trim()) { onNotify("Type the name of this AI first (for example: Kimi, Qwen, Perplexity)."); document.getElementById("ai-name-input")?.focus(); return null; }
    if (!draft.supportsChat && !draft.supportsImage && !draft.supportsTryOn) { onNotify("Enable Chat, Image Generation, Virtual Try-On, or more than one capability."); return null; }
    setSaving(true); setLastTest(null);
    try {
      const result = await api<{ providers: ProviderRow[] }>("/admin/ai/providers", { method: "POST", body: JSON.stringify(draft) });
      const nextRows = Array.isArray(result.providers) ? result.providers : [];
      setRows(nextRows);
      const saved = nextRows.find(x => x.id === draft.id) || nextRows.find(x => x.name === draft.name && x.preset === draft.preset);
      if (saved) setDraft(formFrom(saved));
      onNotify("AI provider saved securely.");
      return saved?.id || draft.id;
    } catch (error: any) { onNotify(safeMessage(error)); return null; }
    finally { setSaving(false); }
  };
  const test = async (capability: "chat" | "image") => {
    if (capability === "image" && !confirm("This sends a real image-generation request. It may consume provider quota or cost money. Continue?")) return;
    const id = await saveDraft();
    if (!id) return;
    setTesting(capability); setLastTest(null);
    try {
      const result = await api<{ ok: boolean; message: string; model?: string }>(`/admin/ai/providers/${encodeURIComponent(id)}/test`, { method: "POST", body: JSON.stringify({ capability }) });
      const message = `${result.message}${result.model ? ` · Model: ${result.model}` : ""}`;
      setLastTest({ capability, message }); onNotify(`${capability === "chat" ? "Chat" : "Image"} API test succeeded.`);
    } catch (error: any) { const message = safeMessage(error); setLastTest({ capability, message }); onNotify(`${capability === "chat" ? "Chat" : "Image"} API test failed: ${message}`); }
    finally { setTesting(null); }
  };
  const remove = async (row: ProviderRow) => {
    if (!confirm(`Remove ${row.name} from the AI provider registry? This cannot be undone.`)) return;
    try { const result = await api<{ providers: ProviderRow[] }>(`/admin/ai/providers/${encodeURIComponent(row.id)}`, { method: "DELETE" }); setRows(result.providers || []); if (draft.id === row.id) { setEditing(false); setDraft(newDraft()); } onNotify("AI provider removed."); }
    catch (error: any) { onNotify(safeMessage(error)); }
  };

  return <div className="admin-module ai-provider-studio">
    <div className="admin-toolbar admin-section-toolbar"><div><div className="eyebrow">Integrations / AI Control</div><h2 className="serif">AI API Studio</h2><p className="admin-section-description">Connect chat and image providers from the admin dashboard. Keys are encrypted in the database and are never returned to the browser.</p></div><div className="admin-toolbar-actions"><button className="btn" onClick={startNew}>Add AI provider</button><button className="btn text" onClick={startNewByName}>AI not listed? Add by name</button><button className="btn text" onClick={() => void load()} disabled={loading}>Refresh</button></div></div>
    <section className="admin-card admin-module-card ai-provider-note"><strong>Simple setup: choose the AI name, paste its key, then configure Chat and Virtual Try-On separately.</strong><p>Common presets include ChatGPT / OpenAI, Gemini, Claude, Groq, OpenRouter, DeepSeek and Mistral. Choose “Custom JSON API” for another provider and type the API or model name yourself.</p><p className="settings-help">Chat and Virtual Try-On have separate endpoints, request JSON and response paths. JSON mode supports services that accept JSON and return an image URL/base64 immediately. Multipart image uploads, asynchronous job polling, OAuth, or unusual vendor protocols require a dedicated adapter; no admin form can make every proprietary API compatible automatically.</p></section>
    <div className="ai-provider-grid">
      {loading ? <div className="admin-empty"><strong>Loading providers…</strong></div> : rows.length ? rows.map(row => <article className="admin-card admin-module-card ai-provider-card" key={row.id}>
        <div className="ai-provider-card-top"><div><div className="eyebrow">{PRESET_DETAILS[row.preset]?.label || row.preset}</div><h3>{row.name}</h3></div><span className={`admin-badge ${row.enabled ? "admin-badge-success" : "admin-badge-danger"}`}>{row.enabled ? "Enabled" : "Disabled"}</span></div>
        <p className="ai-provider-model">{row.model || row.imageModel || "Model not set"}</p>
        <div className="ai-provider-badges">{row.supportsChat && <span className={`admin-badge ${row.defaultChat ? "admin-badge-dark" : ""}`}>{row.defaultChat ? "Default Chat" : "Chat"}</span>}{row.supportsImage && <span className={`admin-badge ${row.defaultImage ? "admin-badge-dark" : ""}`}>{row.defaultImage ? "Default Images" : "Images"}</span>}{row.supportsTryOn && <span className={`admin-badge ${row.defaultTryOn ? "admin-badge-dark" : ""}`}>{row.defaultTryOn ? "Default Virtual Try-On" : "Virtual Try-On"}</span>}<span className="admin-badge">Key: {row.apiKeyConfigured ? row.apiKeyHint : "Missing"}</span><span className="admin-badge">{row.mode === "json" ? "Custom JSON" : "URL / Preset"}</span></div>
        <div className="ai-provider-card-actions"><button className="btn text" onClick={() => edit(row)}>Edit</button><button className="btn text danger-text" onClick={() => void remove(row)}>Remove</button></div>
      </article>) : <div className="admin-empty ai-provider-empty"><strong>No AI providers configured.</strong><span>Add ChatGPT, Gemini, Claude, an OpenAI-compatible API, or a custom JSON endpoint.</span><button className="btn" onClick={startNew}>Add your first provider</button></div>}
    </div>

    {editing && <div className="ai-provider-editor admin-card admin-module-card">
      <div className="ai-provider-editor-head"><div><div className="eyebrow">Provider configuration</div><h3 className="serif">{rows.some(row => row.id === draft.id) ? "Edit AI provider" : "Add AI provider"}</h3><p>API secrets stay on the backend. Leave the key field blank while editing to keep the saved key.</p></div><button className="btn text" onClick={() => { setEditing(false); setLastTest(null); }}>Close</button></div>
      <div className="admin-form">
        <div className="field"><label>Common AI provider</label><select value={draft.preset} onChange={e => selectPreset(e.target.value as Preset)}>{Object.entries(PRESET_DETAILS).map(([key, details]) => <option value={key} key={key}>{details.label}</option>)}</select><small className="settings-help">Selecting a preset fills in its usual endpoints and protocol defaults. You can edit them. OpenAI API billing is separate from a ChatGPT subscription.</small></div>
        <div className="field full ai-name-field"><label>AI name {draft.preset.startsWith("custom_") ? "(type any name)" : ""}</label><input id="ai-name-input" value={draft.name} onChange={e => set("name", e.target.value)} placeholder={draft.preset.startsWith("custom_") ? "e.g. Kimi, Qwen, Perplexity, My company AI" : "e.g. Main ChatGPT key"} autoComplete="off"/>{draft.preset.startsWith("custom_") && <small className="settings-help"><b>AI not in the list?</b> Type its name here. Most AIs follow the OpenAI format: paste their chat URL, key and model name below. If theirs is different, set “Chat / image API format” to Custom JSON and write the request and response yourself.</small>}</div>
        <div className="field"><label>Chat / image API format</label><select value={draft.mode} onChange={e => set("mode", e.target.value as "url" | "json")}><option value="url">Common provider format / API URL</option><option value="json">Custom JSON request and response</option></select><small className="settings-help">This setting applies to chat and creative image generation. Virtual Try-On has its own independent setting below.</small></div>
        <AITextField label="API key / token" value={draft.apiKey} onChange={v => { set("apiKey", v); if (v) set("clearApiKey", false); }} type="password" placeholder={draft.apiKeyConfigured ? `Saved (${draft.apiKeyHint}) — leave blank to keep` : "Paste API key"} help="Stored encrypted at rest. It is never included in the provider list response."/>
        <AITextField label="Chat model name" value={draft.model} onChange={v => set("model", v)} placeholder="Model ID used by the provider"/>
        <AITextField label="Image generation model name" value={draft.imageModel} onChange={v => set("imageModel", v)} placeholder="Image-capable model ID" help="Only used if this provider supports creative image generation."/>
        <label className="check full"><input type="checkbox" checked={draft.enabled} onChange={e => set("enabled", e.target.checked)}/> Provider enabled</label>
        <label className="check"><input type="checkbox" checked={draft.supportsChat} onChange={e => { set("supportsChat", e.target.checked); if (!e.target.checked) set("defaultChat", false); }}/> Can serve AI chat</label>
        <label className="check"><input type="checkbox" checked={draft.supportsImage} onChange={e => { set("supportsImage", e.target.checked); if (!e.target.checked) set("defaultImage", false); }}/> Can generate creative images</label>
        <label className="check"><input type="checkbox" checked={draft.supportsTryOn} onChange={e => { set("supportsTryOn", e.target.checked); if (!e.target.checked) set("defaultTryOn", false); }}/> Can serve Virtual Try-On for store products</label>
        <label className="check"><input type="checkbox" checked={draft.defaultChat} disabled={!draft.supportsChat || !draft.enabled} onChange={e => set("defaultChat", e.target.checked)}/> Make default chat provider</label>
        <label className="check"><input type="checkbox" checked={draft.defaultImage} disabled={!draft.supportsImage || !draft.enabled} onChange={e => set("defaultImage", e.target.checked)}/> Make default creative image provider</label>
        <label className="check full"><input type="checkbox" checked={draft.defaultTryOn} disabled={!draft.supportsTryOn || !draft.enabled} onChange={e => set("defaultTryOn", e.target.checked)}/> Make default Virtual Try-On provider</label>
        {draft.apiKeyConfigured && <label className="check full"><input type="checkbox" checked={draft.clearApiKey} onChange={e => set("clearApiKey", e.target.checked)}/> Remove the saved API key</label>}
      </div>

      <div className="ai-provider-config-block"><div className="settings-section-head"><div><div className="eyebrow">Connection</div><h3>Endpoint URLs</h3><p>Use the provider’s official API URL. For Gemini URLs the {"{{model}}"} placeholder is replaced automatically.</p></div></div>
        <div className="admin-form"><AITextField label="Chat endpoint URL" value={draft.endpoint} onChange={v => set("endpoint", v)} placeholder="https://api.example.com/v1/chat/completions" help="For OpenAI-compatible APIs, use the complete /chat/completions URL or the API base URL." full/><AITextField label="Image endpoint URL" value={draft.imageEndpoint} onChange={v => set("imageEndpoint", v)} placeholder="https://api.example.com/v1/images/generations" help="Optional unless Image Generation is enabled." full/></div>
      </div>

      {draft.mode === "json" && <div className="ai-provider-config-block"><div className="settings-section-head"><div><div className="eyebrow">Advanced mode</div><h3>Request / response JSON</h3><p className="muted">Variables you can use — chat: {"{{message}} {{prompt}} {{system}} {{fullPrompt}} {{messages}} {{history}} {{model}} {{apiKey}}"} · image: {"{{prompt}} {{model}} {{apiKey}}"}. Response path example: choices.0.message.content</p><p>Use template tokens to map the API. For header authentication, prefer <code>{"{{apiKey}}"}</code> in the headers instead of pasting a key directly there.</p></div></div>
        <div className="admin-form">
          <AITextArea label="Chat headers JSON" value={draft.chatHeadersJson} onChange={v => set("chatHeadersJson", v)} help={'Example: { "Authorization": "Bearer {{apiKey}}", "Content-Type": "application/json" }'}/>
          <AITextArea label="Chat request body JSON template" value={draft.chatBodyTemplate} onChange={v => set("chatBodyTemplate", v)} help="Available placeholders: {{model}}, {{apiKey}}, {{system}}, {{message}}, {{history}}, {{messages}}. Object placeholders like {{messages}} must not be inside quotes."/>
          <AITextField label="Chat response text path" value={draft.chatResponsePath} onChange={v => set("chatResponsePath", v)} placeholder="choices.0.message.content" help="Dot notation; numeric array indexes are supported." full/>
          <AITextArea label="Image headers JSON" value={draft.imageHeadersJson} onChange={v => set("imageHeadersJson", v)} help={'Example: { "Authorization": "Bearer {{apiKey}}", "Content-Type": "application/json" }'}/>
          <AITextArea label="Image request body JSON template" value={draft.imageBodyTemplate} onChange={v => set("imageBodyTemplate", v)} help="Available placeholders: {{model}}, {{apiKey}}, {{prompt}}."/>
          <AITextField label="Image response path (base64 or URL)" value={draft.imageResponsePath} onChange={v => set("imageResponsePath", v)} placeholder="data.0.b64_json" help="Examples: data.0.b64_json, data.0.url, image.base64, output.image_url" full/>
        </div>
      </div>}

      <div className="ai-provider-config-block ai-tryon-config-block"><div className="settings-section-head"><div><div className="eyebrow">Store product try-on</div><h3>Virtual Try-On API URL / JSON</h3><p>Separate from creative image generation. The configured API receives the customer photo and the selected product’s garment image. Keep the API key on the server.</p></div></div>
        <div className="admin-form">
          <div className="field"><label>Virtual Try-On request mode</label><select value={draft.tryOnMode} onChange={e => set("tryOnMode", e.target.value as "url" | "json")}><option value="url">API URL + standard JSON fields</option><option value="json">Custom JSON body / headers / response</option></select><small className="settings-help">Use Custom JSON when the provider uses different input field names or returns an image in a different response path.</small></div>
          <AITextField label="Virtual Try-On model name" value={draft.tryOnModel} onChange={v => set("tryOnModel", v)} placeholder="e.g. fashn-vton-1.5 or provider model ID" help="Leave blank only if the service does not require a model name." />
          <AITextField label="Virtual Try-On API endpoint URL" value={draft.tryOnEndpoint} onChange={v => set("tryOnEndpoint", v)} placeholder="https://api.example.com/try-on" help="Must accept a JSON POST and return an image or JSON containing an image URL/base64." full />
          {draft.tryOnMode === "json" && <>
            <AITextArea label="Virtual Try-On headers JSON" value={draft.tryOnHeadersJson} onChange={v => set("tryOnHeadersJson", v)} help={'Example: { "Authorization": "Bearer {{apiKey}}", "Content-Type": "application/json" }'} />
            <AITextArea label="Virtual Try-On request body JSON template" value={draft.tryOnBodyTemplate} onChange={v => set("tryOnBodyTemplate", v)} help={'Supported placeholders: {{model}}, {{apiKey}}, {{photoDataUrl}}, {{clothingImageUrl}}, {{clothingPrompt}}, {{avatarSex}}, {{seed}}. Keep string placeholders in quotes; leave {{seed}} unquoted.'} />
            <AITextField label="Virtual Try-On result image path" value={draft.tryOnResponsePath} onChange={v => set("tryOnResponsePath", v)} placeholder="image_url" help="Dot path to an image URL, data URL or base64 value; e.g. output.image_url or data.0.b64_json." full />
          </>}
          <div className="settings-help full">To test it end-to-end, save the provider then sign in to the storefront, upload a customer photo and select one product in Virtual Try-On. The test may consume the provider’s quota or incur charges.</div>
        </div>
      </div>

      <div className="ai-provider-editor-actions"><button className="btn" disabled={saving} onClick={() => void saveDraft()}>{saving ? "Saving…" : "Save provider"}</button><button className="btn dark" disabled={saving || testing !== null || !draft.supportsChat} onClick={() => void test("chat")}>{testing === "chat" ? "Testing chat…" : "Save & test chat"}</button><button className="btn dark" disabled={saving || testing !== null || !draft.supportsImage} onClick={() => void test("image")}>{testing === "image" ? "Generating test image…" : "Save & test image"}</button></div>
      {lastTest && <div className={`ai-provider-test-result ${lastTest.message.includes("failed") || /failed|error|missing|invalid/i.test(lastTest.message) ? "is-error" : "is-success"}`} role="status"><strong>{lastTest.capability === "chat" ? "Chat API" : "Image API"} test</strong><span>{lastTest.message}</span></div>}
    </div>}
  </div>;
}
