"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";

/* ───────────── shared helpers ───────────── */
export const BUILDER_FOCUS_KEY = "atelier:builder-focus";
export type BuilderFocus = { slug?: string; pageId?: string; sectionId?: string; sectionType?: string };
/** Ask the Website Builder to open a given page/section (works whether or not the builder is mounted yet). */
export function focusBuilder(f: BuilderFocus) {
  try { sessionStorage.setItem(BUILDER_FOCUS_KEY, JSON.stringify(f)); } catch {}
  window.dispatchEvent(new CustomEvent("atelier:builder-focus", { detail: f }));
}
const humanize = (k: string) => k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ").replace(/^./, c => c.toUpperCase());

/* ───────────── live health (real checks, not placeholders) ───────────── */
type Health = { loaded: boolean; payments: { ready: boolean; mode: string; source: string }; ai: { providers: number; chat: boolean; image: boolean }; backup: { count: number; last: string }; pages: number };
const EMPTY: Health = { loaded: false, payments: { ready: false, mode: "", source: "none" }, ai: { providers: 0, chat: false, image: false }, backup: { count: 0, last: "" }, pages: 0 };
export function useAdminHealth(refreshKey = 0): Health {
  const [h, setH] = useState<Health>(EMPTY);
  useEffect(() => {
    let alive = true;
    (async () => {
      const [pay, ai, snaps, pages] = await Promise.allSettled([api<any>("/admin/payment-config"), api<any>("/admin/ai/providers"), api<any>("/admin/site/snapshots"), api<any[]>("/admin/pages")]);
      if (!alive) return;
      const p = pay.status === "fulfilled" ? pay.value?.active : null;
      const provs: any[] = ai.status === "fulfilled" ? (ai.value?.providers || ai.value || []) : [];
      const s: any[] = snaps.status === "fulfilled" ? (snaps.value?.snapshots || []) : [];
      setH({
        loaded: true,
        payments: { ready: Boolean(p?.ready), mode: p?.mode || "", source: p?.source || "none" },
        ai: { providers: provs.length, chat: provs.some(x => x.defaultChat && x.enabled), image: provs.some(x => x.defaultImage && x.enabled) },
        backup: { count: s.length, last: s[0]?.updatedAt || "" },
        pages: pages.status === "fulfilled" ? pages.value.length : 0
      });
    })();
    return () => { alive = false; };
  }, [refreshKey]);
  return h;
}

/* ───────────── floating dock (bottom pill) + status chip (top right) ───────────── */
export function AdminDock({ section, previewOpen, onPreview, onEdit, onFind }: { section: string; previewOpen: boolean; onPreview: () => void; onEdit: () => void; onFind: () => void }) {
  const [b, setB] = useState<{ status: string; saving: boolean }>({ status: "saved", saving: false });
  useEffect(() => { const h = (e: Event) => setB((e as CustomEvent).detail || { status: "saved", saving: false }); window.addEventListener("atelier:builder-status", h); return () => window.removeEventListener("atelier:builder-status", h); }, []);
  const inBuilder = section === "builder"; const dirty = inBuilder && b.status !== "saved";
  const primary = inBuilder
    ? <button className={`dock-main${dirty ? " is-dirty" : ""}`} disabled={b.saving || !dirty} onClick={() => window.dispatchEvent(new CustomEvent("atelier:request-save"))}>{b.saving ? "Saving…" : dirty ? "Save changes" : "All saved ✓"}</button>
    : <button className="dock-main" onClick={onEdit}>Edit website <span aria-hidden="true">↗</span></button>;
  return <div className="admin-dock" role="toolbar" aria-label="Quick actions">
    <button className={`dock-icon${previewOpen ? " on" : ""}`} onClick={onPreview} title="Live preview" aria-label="Toggle live preview" aria-pressed={previewOpen}>◐</button>
    {primary}
    <button className="dock-icon" onClick={onFind} title="Find anything (Ctrl/⌘ + K)" aria-label="Find anything to edit">⌕</button>
  </div>;
}

export function AdminStatusChip({ onGo }: { onGo: (id: string) => void }) {
  const h = useAdminHealth();
  const text = !h.loaded ? "Checking…" : `${h.payments.ready ? `Payments ${h.payments.mode === "live" ? "LIVE" : "TEST"}` : "Payments off"} · AI ${h.ai.providers}`;
  return <button className={`admin-chip${h.loaded && h.payments.ready ? " ok" : ""}`} onClick={() => onGo(h.payments.ready ? "ai" : "payments")} title="System status"><i /> <span>{text}</span></button>;
}

/* ───────────── Quick find: search every text/page/product and jump straight to editing it ───────────── */
type Hit = { kind: string; title: string; sub: string; run: () => void };
function leaves(v: any, path: string[], out: { path: string[]; text: string }[]) {
  if (typeof v === "string") { if (v.trim().length >= 3 && !/^(https?:|#|\/|data:)/.test(v)) out.push({ path, text: v }); }
  else if (Array.isArray(v)) v.forEach((x, i) => leaves(x, [...path, String(i + 1)], out));
  else if (v && typeof v === "object") for (const k of Object.keys(v)) leaves(v[k], [...path, k], out);
}
export function QuickFind({ open, onClose, areas, onGo }: { open: boolean; onClose: () => void; areas: [string, string][]; onGo: (id: string) => void }) {
  const [q, setQ] = useState(""); const [idx, setIdx] = useState(0); const [pages, setPages] = useState<any[] | null>(null); const [products, setProducts] = useState<any[]>([]);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return; setQ(""); setIdx(0); setTimeout(() => input.current?.focus(), 30);
    api<any[]>("/admin/pages").then(setPages).catch(() => setPages([]));
    api<any[]>("/products").then(p => setProducts(Array.isArray(p) ? p : [])).catch(() => {});
  }, [open]);
  const all = useMemo<Hit[]>(() => {
    const out: Hit[] = [];
    areas.forEach(([id, label]) => out.push({ kind: "Area", title: label, sub: "Dashboard section", run: () => onGo(id) }));
    (pages || []).forEach(p => {
      out.push({ kind: "Page", title: p.title, sub: `/${p.slug === "home" ? "" : p.slug} · edit this page`, run: () => { focusBuilder({ pageId: p.id }); onGo("builder"); } });
      (p.sections || []).forEach((s: any) => { const ls: { path: string[]; text: string }[] = []; leaves(s.content, [], ls);
        ls.forEach(l => out.push({ kind: "Text", title: l.text.replace(/\s+/g, " ").slice(0, 90), sub: `${p.title} › ${humanize(String(s.type).toLowerCase())} › ${humanize(l.path[l.path.length - 1] || "text")}`, run: () => { focusBuilder({ pageId: p.id, sectionId: s.id }); onGo("builder"); } })); });
    });
    products.forEach(pr => out.push({ kind: "Product", title: pr.name, sub: `${pr.category?.name || pr.type || "Product"} · ₹${Number(pr.price || 0).toLocaleString("en-IN")}`, run: () => onGo("products") }));
    return out;
  }, [pages, products, areas, onGo]);
  const hits = useMemo(() => { const t = q.trim().toLowerCase(); const list = t ? all.filter(h => (h.title + " " + h.sub).toLowerCase().includes(t)) : all.filter(h => h.kind === "Area" || h.kind === "Page"); return list.slice(0, 40); }, [all, q]);
  useEffect(() => setIdx(0), [q]);
  if (!open) return null;
  const pick = (h?: Hit) => { if (!h) return; onClose(); h.run(); };
  return <div className="qf-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="qf-box" role="dialog" aria-modal="true" aria-label="Find anything to edit">
      <input ref={input} className="qf-input" value={q} onChange={e => setQ(e.target.value)} placeholder="Search any heading, text, page, product or setting…" aria-label="Search"
        onKeyDown={e => { if (e.key === "Escape") onClose(); else if (e.key === "ArrowDown") { e.preventDefault(); setIdx(i => Math.min(hits.length - 1, i + 1)); } else if (e.key === "ArrowUp") { e.preventDefault(); setIdx(i => Math.max(0, i - 1)); } else if (e.key === "Enter") pick(hits[idx]); }} />
      <div className="qf-list" role="listbox">
        {pages === null && <div className="qf-empty">Reading your website…</div>}
        {pages !== null && !hits.length && <div className="qf-empty">Nothing matches “{q}”.</div>}
        {hits.map((h, i) => <button key={i} role="option" aria-selected={i === idx} className={`qf-item${i === idx ? " on" : ""}`} onMouseEnter={() => setIdx(i)} onClick={() => pick(h)}>
          <span className="qf-kind">{h.kind}</span><span className="qf-title">{h.title}</span><small>{h.sub}</small></button>)}
      </div>
      <div className="qf-foot"><span>↑↓ choose</span><span>Enter open &amp; edit</span><span>Esc close</span></div>
    </div></div>;
}

/* ───────────── dashboard welcome: edit shortcuts + real setup checklist ───────────── */
export function AdminWelcome({ onGo, onPreview, stats }: { onGo: (id: string) => void; onPreview: (p?: string) => void; stats: any }) {
  const h = useAdminHealth();
  const [pages, setPages] = useState<any[]>([]);
  useEffect(() => { api<any[]>("/admin/pages").then(p => { const order = ["home", "about", "collections", "shop", "indo-western", "western", "women", "men"]; const rank = (x: any) => { const i = order.indexOf(x.slug); return i < 0 ? 99 : i; }; setPages(p.filter(x => x.isSystem).sort((a, b) => rank(a) - rank(b)).slice(0, 8)); }).catch(() => {}); }, []);
  const checks: { ok: boolean; label: string; hint: string; go: string }[] = [
    { ok: h.payments.ready, label: h.payments.ready ? `Payments are on (${h.payments.mode === "live" ? "live" : "test"} mode)` : "Add Razorpay keys so customers can pay", hint: "Payments", go: "payments" },
    { ok: h.ai.chat, label: h.ai.chat ? `AI chatbot connected${h.ai.image ? " · image AI ready" : ""}` : "Connect an AI for the shop chatbot", hint: "AI API Studio", go: "ai" },
    { ok: (stats?.products ?? 0) > 0, label: (stats?.products ?? 0) > 0 ? `${stats.products} products in your catalogue` : "Add your first product", hint: "Products", go: "products" },
    { ok: h.backup.count > 0, label: h.backup.count ? `Website history on · last saved ${new Date(h.backup.last).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}` : "Website history starts after your first edit", hint: "Builder → History", go: "builder" }
  ];
  const done = checks.filter(c => c.ok).length;
  return <div className="adm-welcome">
    <section className="adm-hero">
      <div className="adm-hero-copy">
        <div className="adm-kicker">Edit anything · it goes live for real</div>
        <h2>Click a page, change the words or the picture, press save.</h2>
        <p>Choose what you want to change below. Preview your words, images and layouts before saving them to the website. Product details, menus and colours each have their own simple tools.</p>
        <div className="adm-hero-actions"><button className="adm-btn acid" onClick={() => onGo("builder")}>Open website editor ↗</button><button className="adm-btn" onClick={() => onPreview("/")}>See the live site</button></div>
      </div>
      <div className="adm-pages" aria-label="Edit a page">
        <div className="adm-pages-title">Edit a page</div>
        {pages.map(p => <button key={p.id} className="adm-page" onClick={() => { focusBuilder({ pageId: p.id }); onGo("builder"); }}><b>{p.title}</b><small>/{p.slug === "home" ? "" : p.slug}</small><span aria-hidden="true">↗</span></button>)}
      </div>
    </section>
    <section className="easy-studio-tasks" aria-label="Start a website task"><button type="button" onClick={() => onGo('builder')}><b>✎ Change website words</b><small>Pick a page and click the words you want to replace</small></button><button type="button" onClick={() => { focusBuilder({ slug: 'home', sectionType: 'CIN_FILM' }); onGo('builder'); }}><b>▱ Change Film / Cards</b><small>Choose one of six animated layouts</small></button><button type="button" onClick={() => onGo('products')}><b>▦ Change products & photos</b><small>Update names, prices, images and availability</small></button><button type="button" onClick={() => onGo('navigation')}><b>↗ Change website menus</b><small>Choose where header and footer links go</small></button></section>
    <section className="adm-check" aria-label="Setup status">
      <div className="adm-check-head"><h3>Setup status</h3><span>{h.loaded ? `${done} of ${checks.length} ready` : "Checking…"}</span></div>
      <div className="adm-bar"><i style={{ width: `${(done / checks.length) * 100}%` }} /></div>
      {checks.map((c, i) => <button key={i} className={`adm-check-row${c.ok ? " ok" : ""}`} onClick={() => onGo(c.go)}><span className="adm-tick">{c.ok ? "✓" : "!"}</span><span>{c.label}</span><small>{c.hint} ↗</small></button>)}
    </section>
  </div>;
}
