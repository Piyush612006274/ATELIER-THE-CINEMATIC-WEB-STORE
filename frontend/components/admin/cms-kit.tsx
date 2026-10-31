"use client";

import { CinForm, CIN_NAMES, isCin, cinDefault } from "./cin-form";
import { RATIOS, FITS, RangeControl, ImageField, ImageListField } from "./cms-fields";
export { RATIOS, FITS, RangeControl, ImageField, ImageListField, uploadImageFile } from "./cms-fields";
// ATELIER CMS kit: image field (URL + direct upload + fit/ratio/height), list editors and the full Site Builder.
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export type CmsSection = { id: string; pageId: string; type: string; sortOrder: number; visible: boolean; content: Record<string, any> };
export type CmsPage = { id: string; slug: string; title: string; status: string; isSystem: boolean; seoTitle?: string | null; seoDescription?: string | null; sections: CmsSection[] };

const errText = (e: any) => String(e?.message || e || "Something went wrong").replaceAll("_", " ");
const TXT = (label: string, k: string, d: any, set: (k: string, v: any) => void, area = false) =>
  <div className={`field ${area ? "full" : ""}`} key={k}><label>{label}</label>{area ? <textarea rows={5} value={String(d[k] ?? "")} onChange={e => set(k, e.target.value)} /> : <input value={String(d[k] ?? "")} onChange={e => set(k, e.target.value)} />}</div>;

const SECTION_TYPES = ["CIN_HERO", "CIN_TICKER", "CIN_FILM", "CIN_EDIT", "CIN_MANIFESTO", "CIN_SHOP", "CIN_LOOKBOOK", "CIN_LETTER", "HERO_SLIDER", "HERO", "BENEFITS", "COLLECTION_GRID", "IMAGE_GRID", "BANNER", "IMAGE_TEXT", "PRODUCT_GRID", "RICH_TEXT", "FAQ", "NEWSLETTER", "SPACER", "NATIVE"];
const NICE: Record<string, string> = { ...CIN_NAMES, HERO_SLIDER: "Hero slider", HERO: "Hero / header image", BENEFITS: "Benefit bar", COLLECTION_GRID: "Collection cards", IMAGE_GRID: "Image cards", BANNER: "Banner", IMAGE_TEXT: "Image + text", PRODUCT_GRID: "Products", RICH_TEXT: "Text block", FAQ: "FAQ", NEWSLETTER: "Newsletter", SPACER: "Spacer", NATIVE: "Built-in page area" };

export function SiteBuilder({ pages, setPages, onNotify, settings, setSettings, onPreview }: { pages: CmsPage[]; setPages: (x: CmsPage[]) => void; onNotify: (x: string) => void; settings?: Record<string, any>; setSettings?: (x: any) => void; onPreview?: (path: string) => void }) {
  const [selectedId, setSelectedId] = useState(pages[0]?.id || "");
  const [sectionId, setSectionId] = useState("");
  const [draft, setDraft] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [newTitle, setNewTitle] = useState(""); const [newSlug, setNewSlug] = useState(""); const [addMenu, setAddMenu] = useState(true);
  useEffect(() => { if (!selectedId && pages[0]) setSelectedId(pages[0].id); }, [pages, selectedId]);
  const page = pages.find(p => p.id === selectedId) || null;
  const PRIORITY = ["home", "about", "collections", "login", "register", "indo-western", "western", "shop"];
  const rank = (x: CmsPage) => { const i = PRIORITY.indexOf(x.slug); return i >= 0 ? i : x.isSystem ? 100 : 50; };
  const orderedPages = [...pages].sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title));
  const sections = (page?.sections || []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const section = sections.find(x => x.id === sectionId) || sections[0] || null;
  useEffect(() => { setSectionId(section?.id || ""); setDraft(section ? JSON.parse(JSON.stringify(section.content || {})) : null); /* Preview opens only after an explicit admin action. */ /* eslint-disable-next-line */ }, [page?.id, page?.sections.length, section?.id]);
  const replaceSection = (out: CmsSection) => setPages(pages.map(x => x.id === page!.id ? { ...x, sections: x.sections.map(y => y.id === out.id ? out : y) } : x));
  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } catch (e: any) { onNotify(errText(e.message)); } finally { setBusy(false); } };

  const savePage = (patch: any) => run(async () => { const out = await api<CmsPage>(`/admin/pages/${page!.id}`, { method: "PATCH", body: JSON.stringify(patch) }); setPages(pages.map(x => x.id === out.id ? { ...x, ...out, sections: out.sections || x.sections } : x)); onNotify("Page saved."); });
  const addPage = () => run(async () => {
    const slug = newSlug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!newTitle.trim() || !slug) { onNotify("Title and slug are required."); return; }
    const out = await api<CmsPage>("/admin/pages", { method: "POST", body: JSON.stringify({ title: newTitle.trim(), slug, status: "PUBLISHED", seoTitle: newTitle.trim() }) });
    setPages([...pages, { ...out, sections: [] }]); setSelectedId(out.id);
    if (addMenu && settings && setSettings) {
      let nav: any[] = []; try { nav = JSON.parse(String(settings.navLinks || "[]")); } catch { nav = []; }
      if (!nav.length) nav = [["/", "Home"], ["/shop", "Shop"], ["/collections", "Collections"], ["/indo-western", "Indo-Western"], ["/western", "Western"], ["/about", "About"]].map(([route, label]) => ({ route, label }));
      nav.push({ route: `/${slug}`, label: newTitle.trim() });
      const saved = await api<Record<string, any>>("/admin/settings", { method: "PUT", body: JSON.stringify({ navLinks: JSON.stringify(nav) }) }); setSettings(saved);
    }
    setNewTitle(""); setNewSlug(""); onNotify("Page created and published. Add sections below.");
  });
  const deletePage = () => run(async () => {
    if (!page || !confirm(`Delete page "${page.title}" permanently?`)) return;
    await api(`/admin/pages/${page.id}`, { method: "DELETE" });
    const rest = pages.filter(p => p.id !== page.id); setPages(rest); setSelectedId(rest[0]?.id || ""); onNotify("Page deleted.");
  });
  const resetPage = () => run(async () => {
    if (!page || !confirm("Reset this page to the original ATELIER layout? Your edits on this page will be replaced.")) return;
    const out = await api<CmsPage>(`/admin/pages/${page.id}/reset`, { method: "POST" }); setPages(pages.map(x => x.id === out.id ? out : x)); setSectionId(""); onNotify("Page reset to default layout.");
  });
  const addSection = (type: string) => run(async () => {
    const base: Record<string, any> = isCin(type) ? cinDefault(type) : { title: NICE[type] || type };
    if (type === "HERO_SLIDER") Object.assign(base, { autoplay: true, intervalMs: 6000, slides: [{ eyebrow: "NEW", line1: "Headline", text: "Supporting text", image: "", fit: "cover", position: "center", buttonText: "Shop now", buttonLink: "/shop" }] });
    if (type === "NATIVE") base.route = "shop";
    const out = await api<CmsSection>(`/admin/pages/${page!.id}/sections`, { method: "POST", body: JSON.stringify({ type, sortOrder: sections.length, visible: true, content: base }) });
    setPages(pages.map(x => x.id === page!.id ? { ...x, sections: [...x.sections, out] } : x)); setSectionId(out.id); onNotify("Section added.");
  });
  const saveSection = () => run(async () => { const out = await api<CmsSection>(`/admin/sections/${section!.id}`, { method: "PATCH", body: JSON.stringify({ content: draft }) }); replaceSection(out); window.dispatchEvent(new CustomEvent("atelier:data-changed")); onNotify("Section saved and published to the live page."); });
  const removeSection = () => run(async () => { if (!section || !confirm("Remove this section?")) return; await api(`/admin/sections/${section.id}`, { method: "DELETE" }); setPages(pages.map(x => x.id === page!.id ? { ...x, sections: x.sections.filter(y => y.id !== section.id) } : x)); setSectionId(""); setDraft(null); onNotify("Section removed."); });
  const duplicate = () => run(async () => { const out = await api<CmsSection>(`/admin/sections/${section!.id}/duplicate`, { method: "POST" }); setPages(pages.map(x => x.id === page!.id ? { ...x, sections: [...x.sections, out] } : x)); setSectionId(out.id); onNotify("Section duplicated."); });
  const toggleVisible = (v: boolean) => run(async () => { const out = await api<CmsSection>(`/admin/sections/${section!.id}`, { method: "PATCH", body: JSON.stringify({ visible: v }) }); replaceSection(out); });
  const move = (i: number, delta: number) => run(async () => {
    const next = [...sections]; const j = i + delta; if (j < 0 || j >= next.length) return; [next[i], next[j]] = [next[j], next[i]];
    const updated: CmsSection[] = [];
    for (const [n, x] of next.entries()) updated.push(await api<CmsSection>(`/admin/sections/${x.id}`, { method: "PATCH", body: JSON.stringify({ sortOrder: n }) }));
    setPages(pages.map(x => x.id === page!.id ? { ...x, sections: updated } : x));
  });

  const set = (k: string, v: any) => setDraft((d: any) => ({ ...d, [k]: v }));
  const setStyle = (k: string, v: any) => setDraft((d: any) => ({ ...d, style: { ...(d?.style || {}), [k]: v } }));
  const setIn = (arrKey: string, i: number, patch: Record<string, any>) => setDraft((d: any) => ({ ...d, [arrKey]: (d[arrKey] || []).map((x: any, n: number) => n === i ? { ...x, ...patch } : x) }));
  const addIn = (arrKey: string, item: any) => setDraft((d: any) => ({ ...d, [arrKey]: [...(d[arrKey] || []), item] }));
  const delIn = (arrKey: string, i: number) => setDraft((d: any) => ({ ...d, [arrKey]: (d[arrKey] || []).filter((_: any, n: number) => n !== i) }));
  const d = draft || {};
  const isAuth = page?.slug === "login" || page?.slug === "register";

  const imageBlock = <ImageField value={d.image} onChange={v => set("image", v)} onNotify={onNotify} layout data={d} onData={set} />;
  const rotation = <ImageListField label="Auto-changing images (optional — real product photos)" images={d.rotationImages || []} onChange={v => set("rotationImages", v)} onNotify={onNotify} autoRotate={d.autoRotate} intervalMs={d.intervalMs} onAuto={set} />;

  let form: any = null;
  if (section && draft) {
    const t = section.type;
    if (t === "HERO_SLIDER") form = <>
      <div className="form-grid"><label className="check"><input type="checkbox" checked={d.autoplay !== false} onChange={e => set("autoplay", e.target.checked)} /> Auto-play slides</label><RangeControl label="Slide every" value={Number(d.intervalMs || 6500)} min={2000} max={12000} step={500} unit="ms" onChange={v => set("intervalMs", v)} /><RangeControl label="Slider height" value={Number(d.height || 0)} min={0} max={1400} step={10} unit="px" onChange={v => set("height", v)} /></div>
      {(d.slides || []).map((s: any, i: number) => <div className="builder-item-card" key={i}>
        <div className="builder-form-head"><b>Slide {i + 1}</b><button className="btn text" onClick={() => delIn("slides", i)}>Remove slide</button></div>
        <div className="form-grid">{["eyebrow:Small heading", "line1:Headline line 1", "line2:Headline line 2", "line3:Headline line 3", "text:Supporting text", "buttonText:Button 1 text", "buttonLink:Button 1 link", "button2Text:Button 2 text", "button2Link:Button 2 link"].map(x => { const [k, l] = x.split(":"); return <div className="field" key={k}><label>{l}</label><input value={s[k] || ""} onChange={e => setIn("slides", i, { [k]: e.target.value })} /></div>; })}</div>
        <ImageField label="Slide image" value={s.image} onChange={v => setIn("slides", i, { image: v })} onNotify={onNotify} layout data={s} onData={(k, v) => setIn("slides", i, { [k]: v })} />
      </div>)}
      <button className="btn dark" onClick={() => addIn("slides", { eyebrow: "", line1: "New slide", text: "", image: "", fit: "cover", position: "center", buttonText: "Shop now", buttonLink: "/shop" })}>+ Add slide</button>
    </>;
    else if (t === "HERO" && isAuth) form = <>
      <div className="form-grid">{["eyebrow:Caption small heading", "captionTitle:Caption title (on image)", "captionText:Caption text", "panelTitle:Form heading", "panelText:Form sub-text"].map(x => { const [k, l] = x.split(":"); return TXT(l, k, d, set); })}</div>
      <div className="form-grid"><RangeControl label="Image panel height" value={Number(d.imageHeight || 0)} min={0} max={1600} step={10} unit="px" hint="0 = full height" onChange={v => set("imageHeight", v)} /><div className="field"><label>Image fit</label><select value={d.fit || "cover"} onChange={e => set("fit", e.target.value)}>{FITS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div><div className="field"><label>Focus</label><input value={d.position || "center top"} onChange={e => set("position", e.target.value)} /></div></div>
      {rotation}
    </>;
    else if (t === "HERO" || t === "BANNER" || t === "IMAGE_TEXT") form = <>
      <div className="form-grid">{["eyebrow:Small heading", t === "HERO" ? "line1:Headline line 1" : "title:Title", t === "HERO" ? "line2:Headline line 2" : "", t === "HERO" ? "line3:Headline line 3" : "", t === "HERO" ? "text:Supporting text" : "", "buttonText:Button text", "buttonLink:Button link", t === "IMAGE_TEXT" ? "linkText:" : ""].filter(x => x && !x.endsWith(":")).map(x => { const [k, l] = x.split(":"); return TXT(l, k, d, set); })}</div>
      {t !== "HERO" && TXT("Body text", "body", d, set, true)}
      {t === "IMAGE_TEXT" && <label className="check"><input type="checkbox" checked={Boolean(d.reverse)} onChange={e => set("reverse", e.target.checked)} /> Image on the right</label>}
      {imageBlock}{rotation}
    </>;
    else if (t === "BENEFITS") form = <>
      {(d.items || []).map((it: any, i: number) => <div className="builder-item-card" key={i}><div className="form-grid"><div className="field"><label>Icon (box / truck / return)</label><input value={it.icon || ""} onChange={e => setIn("items", i, { icon: e.target.value })} /></div><div className="field"><label>Title</label><input value={it.title || ""} onChange={e => setIn("items", i, { title: e.target.value })} /></div><div className="field"><label>Text</label><input value={it.text || ""} onChange={e => setIn("items", i, { text: e.target.value })} /></div></div><button className="btn text" onClick={() => delIn("items", i)}>Remove</button></div>)}
      <button className="btn dark" onClick={() => addIn("items", { icon: "box", title: "New benefit", text: "" })}>+ Add benefit</button>
    </>;
    else if (t === "COLLECTION_GRID" || t === "IMAGE_GRID") form = <>
      <div className="form-grid">{["eyebrow:Small heading", "title:Title", "body:Sub text", "viewAllText:View-all text", "viewAllLink:View-all link"].map(x => { const [k, l] = x.split(":"); return TXT(l, k, d, set); })}<RangeControl label="Cards per row (desktop)" value={Number(d.columns || 4)} min={1} max={5} step={1} unit="" hint="Use ← / → for precision" onChange={v => set("columns", v)} /></div>
      {(d.items || []).map((it: any, i: number) => <div className="builder-item-card" key={i}>
        <div className="builder-form-head"><b>Card {i + 1}</b><button className="btn text" onClick={() => delIn("items", i)}>Remove card</button></div>
        <div className="form-grid">{["title:Title", "body:Short text", "link:Link (e.g. /shop?gender=Men)", "buttonText:Button text"].map(x => { const [k, l] = x.split(":"); return <div className="field" key={k}><label>{l}</label><input value={it[k] || ""} onChange={e => setIn("items", i, { [k]: e.target.value })} /></div>; })}</div>
        <ImageField label="Card image" value={it.image} onChange={v => setIn("items", i, { image: v })} onNotify={onNotify} layout data={it} onData={(k, v) => setIn("items", i, { [k]: v })} />
      </div>)}
      <button className="btn dark" onClick={() => addIn("items", { title: "New card", image: "", link: "/shop", fit: "cover", ratio: "4:5", position: "center top", buttonText: "Shop Now →" })}>+ Add card</button>
    </>;
    else if (t === "PRODUCT_GRID") form = <><div className="form-grid">{["eyebrow:Small heading", "title:Title", "body:Sub text", "gender:Gender (Men / Women / empty)", "filter:Filter (new / best / empty)", "limit:How many products"].map(x => { const [k, l] = x.split(":"); return TXT(l, k, d, set); })}</div><p className="settings-help">Products come from your real catalogue only.</p></>;
    else if (t === "RICH_TEXT") form = <><div className="form-grid">{TXT("Small heading", "eyebrow", d, set)}{TXT("Title", "title", d, set)}</div>{TXT("Body text", "body", d, set, true)}</>;
    else if (t === "NEWSLETTER") form = <><div className="form-grid">{TXT("Small heading", "eyebrow", d, set)}{TXT("Title", "title", d, set)}</div>{TXT("Text", "body", d, set, true)}</>;
    else if (t === "FAQ") form = <>{(d.items || []).map((it: any, i: number) => <div className="builder-item-card" key={i}><div className="field"><label>Question</label><input value={it.question || ""} onChange={e => setIn("items", i, { question: e.target.value })} /></div><div className="field"><label>Answer</label><textarea rows={3} value={it.answer || ""} onChange={e => setIn("items", i, { answer: e.target.value })} /></div><button className="btn text" onClick={() => delIn("items", i)}>Remove</button></div>)}<button className="btn dark" onClick={() => addIn("items", { question: "Question?", answer: "Answer." })}>+ Add question</button></>;
    else if (t === "SPACER") form = <RangeControl label="Height" value={Number(d.height || 40)} min={0} max={1600} step={10} unit="px" onChange={v => set("height", v)} />;
    else if (t === "NATIVE") form = <div className="field"><label>Built-in area (shop, cart, checkout, account, indo-western, western, wishlist, search, builder, stylist, custom, product)</label><input value={d.route || ""} onChange={e => set("route", e.target.value)} /></div>;
    if (!["SPACER", "NATIVE", "PRODUCT_GRID", "FAQ", "BENEFITS", "NEWSLETTER", "HERO_SLIDER"].includes(t) && !isAuth) form = <>{form}<div className="form-grid"><RangeControl label="Extra top/bottom spacing" value={Number(d.spacing || 0)} min={0} max={320} step={5} unit="px" onChange={v => set("spacing", v)} /></div></>;
  }

  return <div className="site-builder">
    <div className="admin-toolbar admin-section-toolbar"><div><div className="eyebrow">CMS / Site Builder</div><h2 className="serif">Every page, one control room.</h2><p className="admin-section-description">Edit text, images (URL or upload), sizes and ratios on every page. Create or delete pages. Login and Register pages are here too.</p></div></div>
    <div className="builder-layout">
      <aside className="builder-pages">
        <div className="builder-new"><input className="utr" placeholder="New page title" value={newTitle} onChange={e => setNewTitle(e.target.value)} /><input className="utr" placeholder="slug (e.g. sale)" value={newSlug} onChange={e => setNewSlug(e.target.value)} /><label className="check"><input type="checkbox" checked={addMenu} onChange={e => setAddMenu(e.target.checked)} /> Add to main menu</label><button className="btn" onClick={addPage} disabled={busy}>Create page</button></div>
        {orderedPages.map(p => <button key={p.id} className={`builder-page-item ${p.id === page?.id ? "active" : ""}`} onClick={() => setSelectedId(p.id)}><span><b>{p.title}</b><small>/{p.slug}</small></span><em>{p.status}</em></button>)}
      </aside>
      <section className="builder-editor">{page ? <>
        <div className="builder-editor-head"><div><div className="eyebrow">Page</div><h3>{page.title}</h3><small>/{page.slug}{page.isSystem ? " · built-in page" : " · custom page"}</small></div>
          <div className="builder-actions"><select className="sort" value={page.status} onChange={e => void savePage({ status: e.target.value })}><option>PUBLISHED</option><option>DRAFT</option><option>ARCHIVED</option></select>{page.isSystem && <button className="btn text" onClick={resetPage}>Reset to default</button>}<button className="btn dark" onClick={deletePage}>Delete page</button></div></div>
        <div className="builder-meta-grid"><div className="field"><label>Page title</label><input defaultValue={page.title} key={page.id + "t"} onBlur={e => e.target.value !== page.title && void savePage({ title: e.target.value })} /></div><div className="field"><label>SEO title</label><input defaultValue={page.seoTitle || ""} key={page.id + "s"} onBlur={e => void savePage({ seoTitle: e.target.value })} /></div><div className="field"><label>SEO description</label><input defaultValue={page.seoDescription || ""} key={page.id + "d"} onBlur={e => void savePage({ seoDescription: e.target.value })} /></div></div>
        <div className="builder-section-add"><span>Add section</span>{SECTION_TYPES.map(t => <button key={t} className="btn text" onClick={() => void addSection(t)}>{NICE[t]}</button>)}</div>
        <div className="builder-section-list">{sections.map((x, i) => <div key={x.id} className={`builder-section-row ${x.id === section?.id ? "active" : ""}`}><button className="builder-section-select" onClick={() => { setSectionId(x.id); setDraft(JSON.parse(JSON.stringify(x.content || {}))); }}><span><b>{NICE[x.type] || x.type}</b><small>Section {i + 1}</small></span><span>{x.visible ? "Visible" : "Hidden"}</span></button><div className="builder-move"><button onClick={() => void move(i, -1)} aria-label="Move up">↑</button><button onClick={() => void move(i, 1)} aria-label="Move down">↓</button></div></div>)}</div>
        {section && draft && <div className="builder-form">
          <div className="builder-form-head"><div><div className="eyebrow">Section editor</div><h4>{NICE[section.type] || section.type}</h4></div><div><label className="check" style={{ display: "inline-flex", marginRight: 12 }}><input type="checkbox" checked={Boolean(section.visible)} onChange={e => void toggleVisible(e.target.checked)} /> Visible</label><button className="btn text" onClick={duplicate}>Duplicate</button><button className="btn text" onClick={removeSection}>Delete</button></div></div>
          <div className="admin-form">{form}<div className="builder-item-card"><b>Section design</b><div className="form-grid"><div className="field"><label>Background colour</label><input value={String(d.style?.background || "")} placeholder="transparent or #ffffff" onChange={e => setStyle("background", e.target.value)} /></div><div className="field"><label>Text colour</label><input value={String(d.style?.color || "")} placeholder="Use theme default" onChange={e => setStyle("color", e.target.value)} /></div><div className="field"><label>Text alignment</label><select value={d.style?.align || "left"} onChange={e => setStyle("align", e.target.value)}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></div><RangeControl label="Top and bottom padding" value={Number(d.spacing || 0)} min={0} max={320} step={4} unit="px" onChange={v => set("spacing", v)} /></div></div></div>
          <div className="builder-save"><button className="btn" disabled={busy} onClick={saveSection}>{busy ? "Saving…" : "Save section"}</button></div>
        </div>}
      </> : <p className="muted">Select or create a page.</p>}</section>
    </div>
  </div>;
}

/** Navigation menu editor used inside Site Settings. Stored as JSON string in settings.navLinks. */
export function NavEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  let nav: { route: string; label: string }[] = []; try { nav = JSON.parse(value || "[]"); } catch { nav = []; }
  if (!nav.length) nav = [["/", "Home"], ["/shop", "Shop"], ["/collections", "Collections"], ["/indo-western", "Indo-Western"], ["/western", "Western"], ["/about", "About"]].map(([route, label]) => ({ route, label }));
  const push = (n: typeof nav) => onChange(JSON.stringify(n));
  return <div className="nav-editor">{nav.map((n, i) => <div className="form-grid" key={i}><div className="field"><label>Label</label><input value={n.label} onChange={e => push(nav.map((x, k) => k === i ? { ...x, label: e.target.value } : x))} /></div><div className="field"><label>Link</label><input value={n.route} onChange={e => push(nav.map((x, k) => k === i ? { ...x, route: e.target.value } : x))} /></div><div className="img-list-actions"><button type="button" className="btn text" onClick={() => i > 0 && push(nav.map((x, k) => k === i - 1 ? nav[i] : k === i ? nav[i - 1] : x))}>↑</button><button type="button" className="btn text" onClick={() => i < nav.length - 1 && push(nav.map((x, k) => k === i + 1 ? nav[i] : k === i ? nav[i + 1] : x))}>↓</button><button type="button" className="btn text" onClick={() => push(nav.filter((_, k) => k !== i))}>Remove</button></div></div>)}<button type="button" className="btn dark" onClick={() => push([...nav, { route: "/", label: "New link" }])}>+ Add menu link</button></div>;
}

/**
 * Content editor for the section types that the Visual Studio inspector does not hand-build
 * (card grids, banners, hero slider, benefit bar, products, FAQ, spacer, native areas, login/register hero).
 * `onPatch` merges the given keys into the section content, exactly like the inspector's other fields.
 */
export function SectionContentForm({ type, content, onPatch, onNotify, isAuth = false }: {
  type: string; content: Record<string, any>; onPatch: (patch: Record<string, any>) => void; onNotify: (m: string) => void; isAuth?: boolean;
}) {
  const d = content || {};
  const set = (k: string, v: any) => onPatch({ [k]: v });
  const setIn = (arrKey: string, i: number, patch: Record<string, any>) => onPatch({ [arrKey]: (d[arrKey] || []).map((x: any, n: number) => n === i ? { ...x, ...patch } : x) });
  const addIn = (arrKey: string, item: any) => onPatch({ [arrKey]: [...(d[arrKey] || []), item] });
  const delIn = (arrKey: string, i: number) => onPatch({ [arrKey]: (d[arrKey] || []).filter((_: any, n: number) => n !== i) });
  const fields = (list: string[]) => <div className="form-grid">{list.map(x => { const [k, l] = x.split(":"); return TXT(l, k, d, set); })}</div>;

  if (isCin(type)) return <CinForm type={type} content={d} onPatch={onPatch} onNotify={onNotify} />;

  if (type === "HERO" && isAuth) return <>
    {fields(["eyebrow:Caption small heading", "captionTitle:Caption title (on image)", "captionText:Caption text", "panelTitle:Form heading", "panelText:Form sub-text"])}
    <div className="form-grid"><RangeControl label="Image panel height" value={Number(d.imageHeight || 0)} min={0} max={1600} step={10} unit="px" hint="0 = full height" onChange={v => set("imageHeight", v)} /><div className="field"><label>Image fit</label><select value={d.fit || "cover"} onChange={e => set("fit", e.target.value)}>{FITS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div><div className="field"><label>Focus</label><input value={d.position || "center top"} onChange={e => set("position", e.target.value)} /></div></div>
    <ImageListField label="Auto-changing images (optional — real product photos)" images={d.rotationImages || []} onChange={v => set("rotationImages", v)} onNotify={onNotify} autoRotate={d.autoRotate} intervalMs={d.intervalMs} onAuto={set} />
  </>;

  if (type === "HERO_SLIDER") return <>
    <div className="form-grid"><label className="check"><input type="checkbox" checked={d.autoplay !== false} onChange={e => set("autoplay", e.target.checked)} /> Auto-play slides</label><RangeControl label="Slide every" value={Number(d.intervalMs || 6500)} min={2000} max={12000} step={500} unit="ms" onChange={v => set("intervalMs", v)} /><RangeControl label="Slider height" value={Number(d.height || 0)} min={0} max={1400} step={10} unit="px" onChange={v => set("height", v)} /></div>
    {(d.slides || []).map((s: any, i: number) => <div className="builder-item-card" key={i}>
      <div className="builder-form-head"><b>Slide {i + 1}</b><button className="btn text" onClick={() => delIn("slides", i)}>Remove slide</button></div>
      <div className="form-grid">{["eyebrow:Small heading", "line1:Headline line 1", "line2:Headline line 2", "line3:Headline line 3", "text:Supporting text", "buttonText:Button 1 text", "buttonLink:Button 1 link", "button2Text:Button 2 text", "button2Link:Button 2 link"].map(x => { const [k, l] = x.split(":"); return <div className="field" key={k}><label>{l}</label><input value={s[k] || ""} onChange={e => setIn("slides", i, { [k]: e.target.value })} /></div>; })}</div>
      <ImageField label="Slide image" value={s.image} onChange={v => setIn("slides", i, { image: v })} onNotify={onNotify} layout data={s} onData={(k, v) => setIn("slides", i, { [k]: v })} />
    </div>)}
    <button className="btn dark" onClick={() => addIn("slides", { eyebrow: "", line1: "New slide", text: "", image: "", fit: "cover", position: "center", buttonText: "Shop now", buttonLink: "/shop" })}>+ Add slide</button>
  </>;

  if (type === "BANNER") return <>
    {fields(["eyebrow:Small heading", "title:Title", "buttonText:Button text", "buttonLink:Button link"])}
    {TXT("Body text", "body", d, set, true)}
    <ImageField value={d.image} onChange={v => set("image", v)} onNotify={onNotify} layout data={d} onData={set} />
  </>;

  if (type === "BENEFITS") return <>
    {(d.items || []).map((it: any, i: number) => <div className="builder-item-card" key={i}><div className="form-grid"><div className="field"><label>Icon (box / truck / return)</label><input value={it.icon || ""} onChange={e => setIn("items", i, { icon: e.target.value })} /></div><div className="field"><label>Title</label><input value={it.title || ""} onChange={e => setIn("items", i, { title: e.target.value })} /></div><div className="field"><label>Text</label><input value={it.text || ""} onChange={e => setIn("items", i, { text: e.target.value })} /></div></div><button className="btn text" onClick={() => delIn("items", i)}>Remove</button></div>)}
    <button className="btn dark" onClick={() => addIn("items", { icon: "box", title: "New benefit", text: "" })}>+ Add benefit</button>
  </>;

  if (type === "COLLECTION_GRID" || type === "IMAGE_GRID") return <>
    <div className="form-grid">{["eyebrow:Small heading", "title:Title", "body:Sub text", "viewAllText:View-all text", "viewAllLink:View-all link"].map(x => { const [k, l] = x.split(":"); return TXT(l, k, d, set); })}<RangeControl label="Cards per row (desktop)" value={Number(d.columns || 4)} min={1} max={5} step={1} unit="" hint="Use ← / → for precision" onChange={v => set("columns", v)} /></div>
    {(d.items || []).map((it: any, i: number) => <div className="builder-item-card" key={i}>
      <div className="builder-form-head"><b>Card {i + 1}</b><button className="btn text" onClick={() => delIn("items", i)}>Remove card</button></div>
      <div className="form-grid">{["title:Title", "body:Short text", "link:Link (e.g. /shop?gender=Men)", "buttonText:Button text"].map(x => { const [k, l] = x.split(":"); return <div className="field" key={k}><label>{l}</label><input value={it[k] || ""} onChange={e => setIn("items", i, { [k]: e.target.value })} /></div>; })}</div>
      <ImageField label="Card image" value={it.image} onChange={v => setIn("items", i, { image: v })} onNotify={onNotify} layout data={it} onData={(k, v) => setIn("items", i, { [k]: v })} />
    </div>)}
    <button className="btn dark" onClick={() => addIn("items", { title: "New card", image: "", link: "/shop", fit: "cover", ratio: "4:5", position: "center top", buttonText: "Shop Now →" })}>+ Add card</button>
  </>;

  if (type === "PRODUCT_GRID") return <><div className="form-grid">{["eyebrow:Small heading", "title:Title", "body:Sub text", "gender:Gender (Men / Women / empty)", "filter:Filter (new / best / empty)", "limit:How many products"].map(x => { const [k, l] = x.split(":"); return TXT(l, k, d, set); })}</div><p className="settings-help">Products come from your real catalogue only.</p></>;

  if (type === "FAQ") return <>{(d.items || []).map((it: any, i: number) => <div className="builder-item-card" key={i}><div className="field"><label>Question</label><input value={it.question || ""} onChange={e => setIn("items", i, { question: e.target.value })} /></div><div className="field"><label>Answer</label><textarea rows={3} value={it.answer || ""} onChange={e => setIn("items", i, { answer: e.target.value })} /></div><button className="btn text" onClick={() => delIn("items", i)}>Remove</button></div>)}<button className="btn dark" onClick={() => addIn("items", { question: "Question?", answer: "Answer." })}>+ Add question</button></>;

  if (type === "SPACER") return <RangeControl label="Height" value={Number(d.height || 40)} min={0} max={1600} step={10} unit="px" onChange={v => set("height", v)} />;

  if (type === "NATIVE") return <div className="field"><label>Built-in area (shop, cart, checkout, account, indo-western, western, wishlist, search, builder, stylist, custom, product)</label><input value={d.route || ""} onChange={e => set("route", e.target.value)} /></div>;

  return null;
}
