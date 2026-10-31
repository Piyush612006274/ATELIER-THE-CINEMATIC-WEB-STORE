"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const colors = [
  ["background", "Page background", "#080a09"], ["surface", "Cards / surfaces", "#101311"],
  ["text", "Main text", "#f1eee7"], ["muted", "Secondary text", "#a6a69d"],
  ["accent", "Buttons / accents", "#d7ff55"], ["headerBackground", "Header", "#080a09"],
  ["footerBackground", "Footer", "#080a09"],
];
const copy = [["siteName", "Brand name"], ["tagline", "Brand tagline"], ["announcement", "Announcement"], ["footerTagline", "Footer text"], ["copyrightText", "Copyright"], ["headerShopLabel", "Shop menu label"], ["headerCollectionsLabel", "Collections menu label"], ["headerAboutLabel", "About menu label"]];
export function SiteAppearanceEditor({ settings = {}, onSaved, onPreview, onNotify }: { settings?: Record<string, any>; onSaved: (settings: any) => void; onPreview: (patch: any) => void; onNotify: (text: string) => void }) {
  const [draft, setDraft] = useState<Record<string, any>>({ theme: settings.theme || {} });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (!dirty) setDraft({ theme: settings.theme || {}, ...Object.fromEntries(copy.map(([key]) => [key, settings[key] || ""])) }); }, [settings, dirty]);
  const change = (patch: any) => { const next = { ...draft, ...patch }; setDraft(next); setDirty(true); onPreview(next); };
  const save = async () => {
    setSaving(true);
    try {
      const saved = await api("/admin/settings", { method: "PUT", body: JSON.stringify(draft) });
      onSaved(saved); setDirty(false);
      window.dispatchEvent(new CustomEvent("atelier:data-changed"));
      onNotify("Website appearance saved. All storefront pages now use these settings.");
    } catch (error: any) { onNotify(`Appearance was not saved: ${error.message}`); }
    finally { setSaving(false); }
  };
  return <details className="site-appearance-editor"><summary>Whole website · colours, fonts & header / footer</summary>
    <p>Preview changes here, then save appearance to publish across all pages. Edit page content in Sections below.</p>
    <fieldset disabled={saving}><div className="form-grid">{colors.map(([key, label, fallback]) => <label className="field" key={key}>{label}<input type="color" value={draft.theme?.[key] || fallback} onChange={e => change({ theme: { ...draft.theme, [key]: e.target.value } })} /></label>)}
      {["headingFont", "bodyFont"].map(key => <label className="field" key={key}>{key === "headingFont" ? "Heading font" : "Body font"}<select value={draft.theme?.[key] || (key === "headingFont" ? "Georgia" : "Arial")} onChange={e => change({ theme: { ...draft.theme, [key]: e.target.value } })}>{["Georgia", "Arial", "Inter", "Newsreader", "Verdana", "Trebuchet MS"].map(font => <option key={font}>{font}</option>)}</select></label>)}
      {copy.map(([key, label]) => <label className="field" key={key}>{label}<input value={draft[key] ?? settings[key] ?? ""} onChange={e => change({ [key]: e.target.value })} /></label>)}
    </div></fieldset>
    <button type="button" className="btn dark" disabled={!dirty || saving} onClick={() => void save()}>{saving ? "Saving appearance…" : "Save appearance"}</button>
    {dirty && <button type="button" className="btn text" disabled={saving} onClick={() => { setDirty(false); onPreview(settings); }}>Discard appearance changes</button>}
  </details>;
}
