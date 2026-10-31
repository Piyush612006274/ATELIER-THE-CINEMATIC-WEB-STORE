"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

const msg = (e: any) => String(e?.message || e || "Something went wrong").replaceAll("_", " ");

/* ───────────────────────── Payment configuration (Razorpay) ───────────────────────── */
type PaymentCfg = {
  active: { source: "admin" | "env" | "none"; mode: string; keyId: string; ready: boolean };
  saved: { keyId: string; enabled: boolean; keySecretSet: boolean; keySecretHint: string; webhookSecretSet: boolean; mode: string; updatedAt: string } | null;
  envConfigured: boolean; webhookUrl: string;
};

export function PaymentConfigCard({ onNotify }: { onNotify: (m: string) => void }) {
  const [cfg, setCfg] = useState<PaymentCfg | null>(null);
  const [keyId, setKeyId] = useState(""); const [keySecret, setKeySecret] = useState(""); const [webhookSecret, setWebhookSecret] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState<"" | "save" | "test" | "clear">("");
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const load = useCallback(async () => {
    try { const c = await api<PaymentCfg>("/admin/payment-config"); setCfg(c); setKeyId(c.saved?.keyId || ""); setEnabled(c.saved?.enabled ?? true); }
    catch (e) { onNotify(msg(e)); }
  }, [onNotify]);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setBusy("save"); setTestResult(null);
    try {
      const out = await api<PaymentCfg>("/admin/payment-config", { method: "PUT", body: JSON.stringify({ keyId: keyId.trim() || undefined, keySecret: keySecret.trim() || undefined, webhookSecret: webhookSecret.trim() || undefined, enabled }) });
      setCfg({ ...out, webhookUrl: cfg?.webhookUrl || "" }); setKeySecret(""); setWebhookSecret("");
      window.dispatchEvent(new CustomEvent("atelier:data-changed"));
      onNotify("Payment configuration saved. Checkout will use these keys immediately.");
    } catch (e: any) { onNotify(e?.details ? msg(e) : msg(e)); } finally { setBusy(""); }
  };
  const test = async () => {
    setBusy("test"); setTestResult(null);
    try { setTestResult(await api("/admin/payment-config/test", { method: "POST", body: JSON.stringify({ keyId: keyId.trim() || undefined, keySecret: keySecret.trim() || undefined }) })); }
    catch (e: any) { setTestResult({ ok: false, message: msg(e) }); } finally { setBusy(""); }
  };
  const clear = async () => {
    if (!confirm("Remove the saved Razorpay keys? Checkout will fall back to backend/.env keys, or stop working if none are set.")) return;
    setBusy("clear");
    try { const out = await api<PaymentCfg>("/admin/payment-config", { method: "DELETE" }); setCfg({ ...out, webhookUrl: cfg?.webhookUrl || "" }); setKeyId(""); setKeySecret(""); setWebhookSecret(""); onNotify("Saved payment keys removed."); }
    catch (e) { onNotify(msg(e)); } finally { setBusy(""); }
  };

  const a = cfg?.active;
  const statusClass = a?.ready ? "pay-status ok" : "pay-status bad";
  const statusText = !a ? "Loading…" : a.ready
    ? `Payments are ON · ${a.mode === "live" ? "LIVE mode (real money)" : a.mode === "test" ? "TEST mode (no real money)" : "mode unknown"} · keys from ${a.source === "admin" ? "this page" : "backend/.env"}`
    : "Payments are OFF. Customers cannot pay until you add Razorpay keys below.";

  return <section className="admin-card admin-module-card pay-config" aria-label="Payment configuration">
    <div className="eyebrow">Gateway setup</div>
    <h3 className="serif" style={{ margin: "8px 0 6px" }}>Razorpay configuration</h3>
    <p className="admin-section-description">Get the keys from Razorpay Dashboard → Account &amp; Settings → API Keys. Use a <b>rzp_test_</b> key to try the checkout safely, then switch to <b>rzp_live_</b> when you are ready.</p>
    <div className={statusClass} role="status"><i/> {statusText}</div>
    <div className="admin-form pay-config-form">
      <div className="field"><label>Key ID</label><input value={keyId} onChange={e => setKeyId(e.target.value)} placeholder="rzp_test_xxxxxxxxxxxx" autoComplete="off" spellCheck={false}/></div>
      <div className="field"><label>Key Secret</label><input type="password" value={keySecret} onChange={e => setKeySecret(e.target.value)} placeholder={cfg?.saved?.keySecretSet ? `Saved ${cfg.saved.keySecretHint} — leave blank to keep` : "Paste your key secret"} autoComplete="new-password" spellCheck={false}/></div>
      <div className="field full"><label>Webhook Secret <span className="muted">(recommended)</span></label><input type="password" value={webhookSecret} onChange={e => setWebhookSecret(e.target.value)} placeholder={cfg?.saved?.webhookSecretSet ? "Saved — leave blank to keep" : "Secret you set when creating the webhook"} autoComplete="new-password" spellCheck={false}/></div>
    </div>
    <label className="check pay-enabled"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)}/> Accept payments with these keys</label>
    <div className="pay-actions">
      <button className="btn dark" onClick={() => void save()} disabled={busy !== "" || (!keyId.trim() && !cfg?.saved)}>{busy === "save" ? "Saving…" : "Save keys"}</button>
      <button className="btn text" onClick={() => void test()} disabled={busy !== ""}>{busy === "test" ? "Testing…" : "Test connection"}</button>
      {cfg?.saved && <button className="btn text danger-text" onClick={() => void clear()} disabled={busy !== ""}>Remove saved keys</button>}
    </div>
    {testResult && <div className={`pay-test ${testResult.ok ? "ok" : "bad"}`} role="status">{testResult.ok ? "✓ " : "✕ "}{testResult.message}</div>}
    <details className="pay-webhook"><summary>Webhook setup (so paid orders are confirmed even if the customer closes the tab)</summary>
      <ol>
        <li>Razorpay Dashboard → Account &amp; Settings → Webhooks → Add new webhook.</li>
        <li>Webhook URL: <code>{cfg?.webhookUrl || "https://YOUR-API-DOMAIN/api/webhooks/razorpay"}</code> (must be a public https address; localhost will not work).</li>
        <li>Active event: <code>payment.captured</code>. Choose a secret and paste the same secret above.</li>
      </ol>
    </details>
    <p className="muted pay-note">Secrets are stored encrypted and are never shown again after saving.</p>
  </section>;
}

/* ───────────────────────── Website history / restore ───────────────────────── */
type Snap = { id: string; kind: string; dateKey: string; label: string | null; pageCount: number; sectionCount: number; createdAt: string; updatedAt: string };
const KIND: Record<string, string> = { AUTO_DAILY: "End-of-day", MANUAL: "Checkpoint", PRE_RESET: "Before reset", PRE_RESTORE: "Before restore", PRE_UPGRADE: "Before upgrade", INITIAL: "First state" };
const prettyDate = (k: string) => { const d = new Date(`${k}T00:00:00`); return isNaN(d.getTime()) ? k : d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }); };

export function SiteHistoryModal({ onClose, onNotify, onRestored }: { onClose: () => void; onNotify: (m: string) => void; onRestored: (r: { pages: any[]; settings?: Record<string, any> }) => void }) {
  const [rows, setRows] = useState<Snap[] | null>(null);
  const [today, setToday] = useState("");
  const [label, setLabel] = useState("");
  const [confirmId, setConfirmId] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try { const r = await api<{ today: string; snapshots: Snap[] }>("/admin/site/snapshots"); setRows(r.snapshots); setToday(r.today); } catch (e) { onNotify(msg(e)); setRows([]); }
  }, [onNotify]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);

  const checkpoint = async () => {
    setBusy("checkpoint");
    try { await api("/admin/site/snapshots", { method: "POST", body: JSON.stringify({ label: label.trim() || undefined }) }); setLabel(""); onNotify("Checkpoint saved."); await load(); }
    catch (e) { onNotify(msg(e)); } finally { setBusy(""); }
  };
  const restore = async (s: Snap) => {
    setBusy(s.id);
    try {
      const out = await api<{ pages: any[]; settings?: Record<string, any> }>(`/admin/site/snapshots/${s.id}/restore`, { method: "POST", body: JSON.stringify({ confirmation: "RESTORE" }) });
      onRestored(out); setConfirmId("");
      onNotify(`Website restored to ${prettyDate(s.dateKey)}. Your previous state was backed up first, so you can undo this from History.`);
      await load();
    } catch (e) { onNotify(msg(e)); } finally { setBusy(""); }
  };
  const remove = async (s: Snap) => {
    if (!confirm("Delete this saved version permanently?")) return;
    try { await api(`/admin/site/snapshots/${s.id}`, { method: "DELETE" }); await load(); } catch (e) { onNotify(msg(e)); }
  };

  return <div className="visual-reset-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="visual-reset-modal history-modal" role="dialog" aria-modal="true" aria-labelledby="history-title">
      <div className="eyebrow">Recovery / Website history</div>
      <h3 id="history-title">Go back to how the site looked on any day</h3>
      <p>The website design is recorded automatically after every edit. Each date keeps the <b>last version saved that day</b>, so later edits never overwrite an earlier day. Restoring only changes pages, sections, navigation and theme. Products, orders, customers, payments and AI keys are never touched.</p>
      <div className="history-checkpoint">
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Name this version (optional), e.g. “Diwali sale live”" maxLength={120} onKeyDown={e => { if (e.key === "Enter") void checkpoint(); }}/>
        <button className="btn dark" onClick={() => void checkpoint()} disabled={busy === "checkpoint"}>{busy === "checkpoint" ? "Saving…" : "Save checkpoint now"}</button>
      </div>
      <div className="history-list" role="list">
        {rows === null && <div className="muted">Loading history…</div>}
        {rows && !rows.length && <div className="muted">No saved versions yet. Make an edit, or save a checkpoint above.</div>}
        {rows?.map(s => <div className="history-row" role="listitem" key={s.id}>
          <div className="history-main">
            <strong>{prettyDate(s.dateKey)}{s.dateKey === today && s.kind === "AUTO_DAILY" ? " · today" : ""}</strong>
            <span className={`history-kind kind-${s.kind.toLowerCase()}`}>{KIND[s.kind] || s.kind}</span>
            <small>{s.label ? `${s.label} · ` : ""}{s.pageCount} pages · {s.sectionCount} sections · saved {new Date(s.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
          </div>
          <div className="history-actions">
            {confirmId === s.id
              ? <><button className="btn dark" onClick={() => void restore(s)} disabled={busy === s.id}>{busy === s.id ? "Restoring…" : "Yes, restore"}</button><button className="btn text" onClick={() => setConfirmId("")}>Cancel</button></>
              : <><button className="btn text" onClick={() => setConfirmId(s.id)}>Restore</button>{s.kind !== "AUTO_DAILY" || s.dateKey !== today ? <button className="btn text danger-text" onClick={() => void remove(s)}>Delete</button> : null}</>}
          </div>
        </div>)}
      </div>
      <div className="visual-reset-actions"><button className="btn text" onClick={onClose}>Close</button></div>
    </section>
  </div>;
}

/* ───────────────────────── Image library picker (existing images) ───────────────────────── */
type LibImg = { url: string; name: string; folder: string };
export function ImageLibraryModal({ onPick, onClose }: { onPick: (url: string) => void; onClose: () => void }) {
  const [items, setItems] = useState<LibImg[] | null>(null);
  const [q, setQ] = useState(""); const [folder, setFolder] = useState("all"); const [err, setErr] = useState("");
  useEffect(() => { fetch("/atelier-image-library", { cache: "no-store" }).then(r => r.json()).then(d => setItems(d.images || [])).catch(() => { setErr("Could not load the image library."); setItems([]); }); }, []);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  const folders = Array.from(new Set((items || []).map(i => i.folder))).sort();
  const shown = (items || []).filter(i => (folder === "all" || i.folder === folder) && (!q.trim() || (i.name + " " + i.folder).toLowerCase().includes(q.trim().toLowerCase())));
  return <div className="visual-reset-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="visual-reset-modal image-lib-modal" role="dialog" aria-modal="true" aria-label="Choose an existing image">
      <div className="eyebrow">Image library</div>
      <h3>Choose an existing image</h3>
      <div className="image-lib-tools">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name…" autoFocus />
        <select value={folder} onChange={e => setFolder(e.target.value)}><option value="all">All folders ({items?.length ?? 0})</option>{folders.map(f => <option key={f} value={f}>{f}</option>)}</select>
      </div>
      <div className="image-lib-grid">
        {items === null && <div className="muted">Loading images…</div>}
        {err && <div className="muted">{err}</div>}
        {items && !shown.length && !err && <div className="muted">No images match.</div>}
        {shown.slice(0, 300).map(i => <button key={i.url} type="button" className="image-lib-item" title={`${i.folder}/${i.name}`} onClick={() => onPick(i.url)}>
          <img src={i.url} alt={i.name} loading="lazy" /><span>{i.name}</span>
        </button>)}
      </div>
      <div className="visual-reset-actions"><button className="btn text" onClick={onClose}>Cancel</button></div>
    </section>
  </div>;
}
