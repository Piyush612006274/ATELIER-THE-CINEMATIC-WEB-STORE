"use client";
import React from "react";
import { ImageField } from "./cms-fields";
import { cinematicDefaults, CIN_TYPES } from "@/lib/cinematicDefaults";
import { CAMPAIGN_LAYOUTS, campaignLayout } from "@/lib/campaign-layouts";

type F = { k: string; l: string; t?: "text" | "area" | "image" | "check" | "num" | "select"; opts?: string[]; hint?: string };
type L = { k: string; l: string; one: string; item: F[] };
const SCHEMA: Record<string, { name: string; hint: string; fields: F[]; lists: L[] }> = {
  CIN_HERO: { name: "Cinematic hero", hint: "Big headline + interactive look switcher (cut-out model, backdrop, depth).", fields: [
    { k: "eyebrow", l: "Small heading" }, { k: "line1", l: "Headline line 1" }, { k: "line2", l: "Headline line 2 (outlined)" }, { k: "description", l: "Description", t: "area" },
    { k: "button1Text", l: "Button 1 text" }, { k: "button1Link", l: "Button 1 link (/page or #section)" }, { k: "button2Text", l: "Button 2 text" }, { k: "button2Link", l: "Button 2 link" },
    { k: "footnoteNum", l: "Footnote number" }, { k: "footnote", l: "Footnote text" }, { k: "scrollCue", l: "Scroll hint text" }, { k: "autoplay", l: "Auto-change looks", t: "check" }, { k: "intervalMs", l: "Change every (ms)", t: "num" }],
    lists: [{ k: "looks", l: "Looks", one: "Look", item: [
      { k: "tab", l: "Button label" }, { k: "mode", l: "Style", t: "select", opts: ["cutout", "photo"], hint: "cutout = transparent PNG/WebP model with depth effect, photo = framed photograph" },
      { k: "figure", l: "Model / photo image", t: "image" }, { k: "bg", l: "Backdrop image", t: "image" }, { k: "number", l: "Big number (01)" }, { k: "caption", l: "Caption (new line = line break)", t: "area" },
      { k: "sub", l: "Caption small text" }, { k: "rail", l: "Vertical text (left)" }, { k: "coord", l: "Vertical text (right)" }] }] },
  CIN_TICKER: { name: "Scrolling ticker", hint: "Acid-green marquee strip.", fields: [], lists: [{ k: "items", l: "Phrases", one: "Phrase", item: [{ k: "text", l: "Text" }] }] },
  CIN_FILM: { name: "Film & animated cards", hint: "1. Choose a style. 2. Edit the cards below. 3. Preview and Save design. Switching styles keeps your photos and words.", fields: [{ k: "heading", l: "Section heading" }, { k: "eyebrow", l: "Small heading" }, { k: "hint", l: "Intro / scroll hint" }, { k: "cardTheme", l: "Colours", t: "select", opts: ["site", "custom"] }, { k: "cardBackground", l: "Custom background (e.g. #101311)" }, { k: "cardTextColor", l: "Custom text colour (e.g. #f1eee7)" }, { k: "cardRadius", l: "Rounded corners (0–64)", t: "num" }, { k: "animationMs", l: "Movement duration in milliseconds (600 = gentle)", t: "num" }, { k: "imageFit", l: "Photo layout", t: "select", opts: ["contain", "cover"], hint: "Contain shows the whole outfit. Cover fills the photo area." }, { k: "autoplay", l: "Automatically change cards in Fade mode", t: "check" }, { k: "intervalMs", l: "Time between Fade cards (5500 = 5.5 seconds)", t: "num" }, { k: "show3D", l: "Show 3D outfits below this section", t: "check" }],
    lists: [{ k: "frames", l: "Your photos & cards", one: "Card", item: [{ k: "chapter", l: "Short label" }, { k: "title", l: "Main heading" }, { k: "emphasis", l: "Highlighted words" }, { k: "desc", l: "Description", t: "area" }, { k: "tag", l: "Photo caption" }, { k: "image", l: "Photo", t: "image" }, { k: "buttonText", l: "Button text" }, { k: "link", l: "Button destination (e.g. /shop)" }, { k: "background", l: "This card's background (optional)" }, { k: "textColor", l: "This card's text colour (optional)" }] }] },
  CIN_EDIT: { name: "The edit (2 tiles)", hint: "Heading + large editorial image tiles.", fields: [{ k: "micro", l: "Small heading" }, { k: "title", l: "Title (new line = line break)", t: "area" }, { k: "body", l: "Side text", t: "area" }],
    lists: [{ k: "tiles", l: "Tiles", one: "Tile", item: [{ k: "index", l: "Top label" }, { k: "title", l: "Title", t: "area" }, { k: "meta", l: "Small text" }, { k: "image", l: "Image", t: "image" }, { k: "link", l: "Link" }] }] },
  CIN_MANIFESTO: { name: "Manifesto", hint: "Giant statement.", fields: [{ k: "micro", l: "Small heading" }, { k: "title", l: "Statement (new line = line break)", t: "area" }, { k: "emphasis", l: "Green italic line" }, { k: "body", l: "Paragraph", t: "area" }, { k: "mark", l: "Side mark" }], lists: [] },
  CIN_SHOP: { name: "Shop products", hint: "Live products from your catalogue with filters and quick add.", fields: [{ k: "micro", l: "Small heading" }, { k: "title", l: "Title", t: "area" }, { k: "body", l: "Side text", t: "area" },
    { k: "filter", l: "Which products", t: "select", opts: ["all", "new", "best", "men", "women"] }, { k: "limit", l: "How many", t: "num" }, { k: "showFilters", l: "Show filter buttons", t: "check" },
    { k: "allLabel", l: "Filter: all" }, { k: "menLabel", l: "Filter: men" }, { k: "womenLabel", l: "Filter: women" }, { k: "noteLeft", l: "Bottom note" }, { k: "viewAllText", l: "View-all text" }, { k: "viewAllLink", l: "View-all link" }], lists: [] },
  CIN_LOOKBOOK: { name: "Lookbook", hint: "Horizontal swipe row of looks.", fields: [{ k: "micro", l: "Small heading" }, { k: "title", l: "Title", t: "area" }, { k: "body", l: "Side text", t: "area" }],
    lists: [{ k: "looks", l: "Looks", one: "Look", item: [{ k: "label", l: "Caption" }, { k: "image", l: "Image", t: "image" }, { k: "link", l: "Link" }] }] },
  CIN_LETTER: { name: "Newsletter letter", hint: "Email signup (saves to Newsletter in the dashboard).", fields: [{ k: "micro", l: "Small heading" }, { k: "title", l: "Title", t: "area" }, { k: "body", l: "Text", t: "area" }, { k: "placeholder", l: "Input placeholder" }, { k: "button", l: "Button text" }], lists: [] },
};
export const CIN_NAMES: Record<string, string> = Object.fromEntries(Object.entries(SCHEMA).map(([k, v]) => [k, v.name]));
export const CIN_HINTS: Record<string, string> = Object.fromEntries(Object.entries(SCHEMA).map(([k, v]) => [k, v.hint]));
export const isCin = (t: string) => (CIN_TYPES as readonly string[]).includes(t);
export const cinDefault = (t: string): Record<string, any> => JSON.parse(JSON.stringify(cinematicDefaults[t] || {}));

function Field({ f, v, onChange, onNotify }: { f: F; v: any; onChange: (v: any) => void; onNotify: (m: string) => void }) {
  if (f.k === "cardTheme") return <label className="field">Layout colours<select value={String(v || "site")} onChange={event => onChange(event.target.value)}><option value="site">Match website — dark theme</option><option value="custom">Use my own colours</option></select><small>All layouts follow your website colours by default.</small></label>;
  if (f.k === "animationMs") return <label className="field">Movement speed<select value={String(v ?? 600)} onChange={event => onChange(Number(event.target.value))}><option value="1000">Slow & gentle</option><option value="600">Balanced</option><option value="300">Quick</option></select></label>;
  if (f.k === "intervalMs") return <label className="field">Seconds between automatic changes<input type="number" min={3} max={15} step={0.5} value={Number(v ?? 5500) / 1000} onChange={event => onChange(Math.max(3000, Math.min(15000, Number(event.target.value) * 1000)))}/></label>;
  if (f.t === "image") return <div className="field full"><ImageField label={f.l} value={v || ""} onChange={onChange} onNotify={onNotify} /></div>;
  if (f.t === "check") return <label className="check"><input type="checkbox" checked={v !== false && !!v} onChange={e => onChange(e.target.checked)} /> {f.l}</label>;
  if (f.t === "area") return <div className="field full"><label>{f.l}</label><textarea rows={3} value={String(v ?? "")} onChange={e => onChange(e.target.value)} /></div>;
  if (f.t === "num") return <div className="field"><label>{f.l}</label><input type="number" value={v ?? ""} onChange={e => onChange(Number(e.target.value))} /></div>;
  if (f.t === "select") return <div className="field"><label>{f.l}</label><select value={String(v ?? f.opts?.[0])} onChange={e => onChange(e.target.value)}>{f.opts!.map(o => <option key={o} value={o}>{o}</option>)}</select>{f.hint && <small>{f.hint}</small>}</div>;
  return <div className="field"><label>{f.l}</label><input value={String(v ?? "")} onChange={e => onChange(e.target.value)} /></div>;
}

export function CinForm({ type, content, onPatch, onNotify }: { type: string; content: Record<string, any>; onPatch: (p: Record<string, any>) => void; onNotify: (m: string) => void }) {
  const sc = SCHEMA[type]; if (!sc) return null;
  const d = content || {};
  const blank = cinDefault(type);
  const move = (key: string, i: number, dir: number) => { const a = [...(d[key] || [])]; const j = i + dir; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; onPatch({ [key]: a }); };
  return <div className="cin-form">
    <p className="admin-section-description">{sc.hint}</p>
    {type === "CIN_FILM" && <div className="campaign-style-picker" role="group" aria-label="Choose Film or card animation">{CAMPAIGN_LAYOUTS.map(layout => <button type="button" key={layout.id} aria-pressed={campaignLayout(d.presentation) === layout.id} onClick={() => onPatch({ presentation: layout.id })}><span aria-hidden="true">{layout.icon}</span><strong>{layout.name}</strong><small>{layout.hint}</small></button>)}</div>}
    {sc.fields.length > 0 && <div className="form-grid">{sc.fields.filter(f => type !== "CIN_FILM" || d.cardTheme === "custom" || !["cardBackground", "cardTextColor"].includes(f.k)).map(f => <Field key={f.k} f={f} v={d[f.k] ?? blank[f.k]} onChange={v => onPatch({ [f.k]: v })} onNotify={onNotify} />)}</div>}
    {sc.lists.map(L => <div key={L.k}>
      <h4 style={{ margin: "18px 0 8px" }}>{L.l}</h4>
      {(d[L.k] || []).map((it: any, i: number) => {
        const obj = typeof it === "string" ? { text: it } : it;
        const patchItem = (p: Record<string, any>) => onPatch({ [L.k]: (d[L.k] || []).map((x: any, n: number) => n === i ? { ...(typeof x === "string" ? { text: x } : x), ...p } : x) });
        return <div className="builder-item-card" key={i}>
          <div className="builder-form-head"><b>{L.one} {i + 1}</b><span><button className="btn text" onClick={() => move(L.k, i, -1)} aria-label="Move up">↑</button><button className="btn text" onClick={() => move(L.k, i, 1)} aria-label="Move down">↓</button><button className="btn text" onClick={() => onPatch({ [L.k]: (d[L.k] || []).filter((_: any, n: number) => n !== i) })}>Remove</button></span></div>
          <div className="form-grid">{L.item.filter(f => type !== "CIN_FILM" || d.cardTheme === "custom" || !["background", "textColor"].includes(f.k)).map(f => <Field key={f.k} f={f} v={obj[f.k]} onChange={v => patchItem({ [f.k]: v })} onNotify={onNotify} />)}</div>
        </div>;
      })}
      <button className="btn dark" onClick={() => { const first = (blank[L.k] || [])[0]; onPatch({ [L.k]: [...(d[L.k] || []), first ? JSON.parse(JSON.stringify(first)) : Object.fromEntries(L.item.map(f => [f.k, ""]))] }); }}>+ Add {L.one.toLowerCase()}</button>
    </div>)}
  </div>;
}
