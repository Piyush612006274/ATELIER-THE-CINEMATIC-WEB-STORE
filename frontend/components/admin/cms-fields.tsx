"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { ImageLibraryModal } from "./admin-extras";

// Shared controls must not import the page builders that consume them.
const errText = (e: any) => String(e?.message || e || "Something went wrong").replaceAll("_", " ");
export const RATIOS = ["original", "1:1", "4:5", "3:4", "5:8", "2:3", "16:9", "21:9"];
export const FITS = [["cover", "Fill frame (crop edges)"], ["contain", "Show full image"], ["full", "Natural size"]];

export function RangeControl({ label, value, min, max, step = 1, onChange, unit = "", hint = "Drag or scroll" }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; unit?: string; hint?: string;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));
  const safe = clamp(value);
  const decimals = step < 1 ? Math.max(0, String(step).split(".")[1]?.length || 0) : 0;
  const format = (v: number) => decimals ? v.toFixed(decimals) : String(Math.round(v));
  const nudge = (delta: number) => onChange(clamp(safe + delta));
  return <div className="field range-control">
    <div className="range-control-head">
      <label>{label}</label>
      <output>{format(safe)}{unit}</output>
    </div>
    <input
      className="range-input"
      type="range"
      min={min}
      max={max}
      step={step}
      value={safe}
      aria-label={label}
      onChange={e => onChange(Number(e.target.value))}
      onWheel={e => { e.preventDefault(); nudge(e.deltaY > 0 ? -step : step); }}
    />
    <div className="range-control-meta"><span>{format(min)}{unit}</span><span>{hint}</span><span>{format(max)}{unit}</span></div>
  </div>;
}

export async function uploadImageFile(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Only JPG, PNG or WEBP images can be uploaded.");
  if (file.size > 8 * 1024 * 1024) throw new Error("IMAGE_TOO_LARGE (max 8 MB)");
  const dataUrl = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result || "")); r.onerror = () => reject(new Error("IMAGE_READ_FAILED")); r.readAsDataURL(file); });
  const out = await api<{ url: string }>("/admin/images/upload", { method: "POST", body: JSON.stringify({ filename: file.name, dataUrl }) });
  return out.url;
}

/** Image input: paste URL OR upload from computer. With `layout` it also shows fit / ratio / height / focus controls. */
export function ImageField({ label = "Image", value, onChange, onNotify, layout, data, onData }: {
  label?: string; value?: string; onChange: (v: string) => void; onNotify: (m: string) => void;
  layout?: boolean; data?: Record<string, any>; onData?: (k: string, v: any) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  const pick = async (f?: File) => { if (!f) return; setBusy(true); try { onChange(await uploadImageFile(f)); onNotify("Image uploaded. Save to publish."); } catch (e: any) { onNotify(errText(e.message)); } finally { setBusy(false); } };
  const d = data || {}; const set = (k: string, v: any) => onData && onData(k, v);
  return <div className="img-field">
    <label>{label}</label>
    <div className="img-field-row">
      <input value={value || ""} onChange={e => onChange(e.target.value)} placeholder="Paste image URL (https://… or /images/…)" />
      <button type="button" className="btn text img-lib-btn" onClick={() => setLibOpen(true)}>Library</button>
      <label className="btn dark img-upload-btn">{busy ? "Uploading…" : "Upload"}<input type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={e => { void pick(e.target.files?.[0]); e.target.value = ""; }} /></label>
    </div>
    {libOpen && <ImageLibraryModal onClose={() => setLibOpen(false)} onPick={url => { onChange(url); setLibOpen(false); onNotify("Image selected. Press Save design to publish."); }} />}
    {value ? <img className="cms-builder-preview" src={value} alt="preview" onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = ".25"; }} onLoad={e => { (e.currentTarget as HTMLImageElement).style.opacity = "1"; }} /> : null}
    {layout && <div className="form-grid img-layout">
      <div className="field"><label>Image fit</label><select value={d.fit || d.displayMode || "cover"} onChange={e => set("fit", e.target.value)}>{FITS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
      <div className="field"><label>Aspect ratio</label><select value={d.ratio || d.aspectRatio || "original"} onChange={e => set("ratio", e.target.value)}>{RATIOS.map(r => <option key={r}>{r}</option>)}</select></div>
      <RangeControl label="Height" value={Number(d.height || 0)} min={0} max={1800} step={10} unit="px" onChange={v => set("height", v)} />
      <div className="field"><label>Focus (e.g. center top / 50% 20%)</label><input value={d.position || "center"} onChange={e => set("position", e.target.value)} /></div>
    </div>}
  </div>;
}

/** List of images with URL/upload per row + auto change timer. */
export function ImageListField({ label, images, onChange, onNotify, autoRotate, intervalMs, onAuto }: {
  label: string; images: string[]; onChange: (v: string[]) => void; onNotify: (m: string) => void;
  autoRotate?: boolean; intervalMs?: number; onAuto?: (k: string, v: any) => void;
}) {
  const list = Array.isArray(images) ? images : [];
  return <div className="img-list">
    <div className="img-list-head"><b>{label}</b><button type="button" className="btn text" onClick={() => onChange([...list, ""])}>+ Add image</button></div>
    {list.map((src, i) => <div className="img-list-row" key={i}>
      <ImageField label={`Image ${i + 1}`} value={src} onNotify={onNotify} onChange={v => onChange(list.map((x, n) => n === i ? v : x))} />
      <div className="img-list-actions"><button type="button" className="btn text" onClick={() => i > 0 && onChange(list.map((x, n) => n === i - 1 ? list[i] : n === i ? list[i - 1] : x))}>↑</button><button type="button" className="btn text" onClick={() => i < list.length - 1 && onChange(list.map((x, n) => n === i + 1 ? list[i] : n === i ? list[i + 1] : x))}>↓</button><button type="button" className="btn text" onClick={() => onChange(list.filter((_, n) => n !== i))}>Remove</button></div>
    </div>)}
    {onAuto && <div className="form-grid">
      <label className="check"><input type="checkbox" checked={Boolean(autoRotate)} onChange={e => onAuto("autoRotate", e.target.checked)} /> Auto change images</label>
      <RangeControl label="Change every" value={Number(intervalMs || 2000)} min={1000} max={10000} step={500} unit="ms" onChange={v => onAuto("intervalMs", v)} />
    </div>}
  </div>;
}

