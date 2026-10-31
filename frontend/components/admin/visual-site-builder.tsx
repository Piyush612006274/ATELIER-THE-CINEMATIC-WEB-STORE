"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { SiteHistoryModal } from "./admin-extras";
import { SiteAppearanceEditor } from "./site-appearance-editor";
import { EasySiteEditor } from "./easy-site-editor";
import { isCin, cinDefault, CIN_NAMES } from "./cin-form";
import { ImageField, RangeControl, SectionContentForm, type CmsPage, type CmsSection } from "./cms-kit";

type Props = {
  pages: CmsPage[];
  setPages: (x: CmsPage[]) => void;
  onNotify: (x: string) => void;
  onPreview?: (path: string) => void;
  settings?: Record<string, any>;
  setSettings?: (x: any) => void;
};

type FreeElement = {
  id: string;
  type: "text" | "image" | "button" | "spacer" | "divider" | "columns" | "video";
  content: Record<string, any>;
  style: Record<string, any>;
  children?: FreeElement[];
};

const PAGE_PRIORITY = ["home", "about", "collections", "shop", "men", "women", "indo-western", "western", "login", "register", "cart", "checkout", "wishlist", "account"];
const BLOCKS: Array<[string, string, string]> = [
  ["CIN_HERO", "Cinematic hero", "Headline + look switcher"],
  ["CIN_TICKER", "Ticker", "Scrolling brand phrases"],
  ["CIN_FILM", "Film & animated cards", "Film, stacked cards and 4 extra layouts"],
  ["CIN_EDIT", "The edit", "Two large editorial tiles"],
  ["CIN_MANIFESTO", "Manifesto", "Giant brand statement"],
  ["CIN_SHOP", "Shop products", "Live catalogue + filters"],
  ["CIN_LOOKBOOK", "Lookbook", "Horizontal swipe looks"],
  ["CIN_LETTER", "Newsletter letter", "Email signup card"],
  ["HERO", "Hero", "Big campaign image + headline"],
  ["IMAGE_TEXT", "Image + Text", "Editorial split layout"],
  ["IMAGE_GRID", "Image Grid", "Visual collection cards"],
  ["PRODUCT_GRID", "Product Grid", "Live product catalogue"],
  ["RICH_TEXT", "Text", "Editorial copy block"],
  ["BANNER", "Banner", "Full width campaign panel"],
  ["FREEFORM", "Freeform", "Drag individual elements"],
  ["NEWSLETTER", "Newsletter", "Email capture section"],
  ["FAQ", "FAQ", "Questions and answers"],
  ["SPACER", "Spacer", "Vertical breathing room"],
  ["NATIVE", "Native Area", "Protected commerce area"],
];

const blockLabel: Record<string, string> = { ...CIN_NAMES, ...Object.fromEntries(BLOCKS.map(x => [x[0], x[1]])), BENEFITS: "Benefit bar", COLLECTION_GRID: "Collection cards", HERO_SLIDER: "Hero slider", VIDEO: "Video", AUTH: "Auth" };
const uid = (prefix = "el") => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

const defaultStyle = () => ({
  background: "transparent",
  color: "#241d18",
  paddingTop: 0,
  paddingRight: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  borderRadius: 0,
  borderWidth: 0,
  borderColor: "#d6cbc0",
  maxWidth: "",
  align: "left",
  gap: 16,
  minHeight: 0,
  width: "",
  height: "",
  opacity: 1,
  fontSize: 0,
  fontWeight: 400,
  lineHeight: 1.5,
  letterSpacing: 0,
});

const freeElement = (type: FreeElement["type"]): FreeElement => {
  const common = { style: { ...defaultStyle() } };
  if (type === "image") return { id: uid(), type, content: { src: "/images/hero/hero-01.jpg", alt: "ATELIER editorial", fit: "contain", ratio: "original" }, ...common };
  if (type === "button") return { id: uid(), type, content: { text: "Explore the collection", link: "/shop" }, style: { ...defaultStyle(), background: "#201914", color: "#fff", paddingTop: 14, paddingRight: 22, paddingBottom: 14, paddingLeft: 22 } };
  if (type === "spacer") return { id: uid(), type, content: { height: 80 }, ...common };
  if (type === "divider") return { id: uid(), type, content: {}, style: { ...common, borderColor: "#d6cbc0", borderWidth: 1 } };
  if (type === "columns") return { id: uid(), type, content: { columns: 2 }, children: [freeElement("text"), freeElement("image")], ...common };
  if (type === "video") return { id: uid(), type, content: { src: "", poster: "" }, ...common };
  return { id: uid(), type: "text", content: { eyebrow: "ATELIER", title: "A considered point of view.", body: "Write your story here. Every word can be changed visually from the control room." }, ...common };
};

const sectionDefaults = (type: string): Record<string, any> => {
  if (isCin(type)) return cinDefault(type);
  const base = { title: blockLabel[type] || type, spacing: 0, style: defaultStyle() };
  if (type === "HERO") return { ...base, eyebrow: "ATELIER", line1: "Redefining", line2: "Modern Luxury", line3: "", text: "Exceptional fashion with an editorial point of view.", buttonText: "Explore collections", buttonLink: "/collections", image: "/images/hero/hero-04-wide.jpg", fit: "cover", ratio: "21:9", position: "center" };
  if (type === "IMAGE_TEXT") return { ...base, eyebrow: "OUR STORY", title: "Crafted with Passion", body: "A considered blend of heritage, craftsmanship and modern silhouettes.", buttonText: "Learn more", buttonLink: "/about", image: "/images/products/new-catalogue/women/asymmetric-co-ord-blazer-set-01.avif", fit: "cover", ratio: "4:5", position: "center", reverse: false };
  if (type === "IMAGE_GRID") return { ...base, eyebrow: "SHOP THE COLLECTION", title: "For Every You", body: "From timeless classics to contemporary silhouettes.", columns: 4, items: [{ title: "Men's Collection", body: "Modern essentials", link: "/shop?gender=Men", image: "/images/products/new-catalogue/men/classic-linen-shirt-01.avif", fit: "contain", ratio: "5:8" }, { title: "Women's Collection", body: "Contemporary feminine", link: "/shop?gender=Women", image: "/images/products/new-catalogue/women/pleated-palazzo-co-ord-01.avif", fit: "contain", ratio: "5:8" }], viewAllText: "View all collections", viewAllLink: "/collections" };
  if (type === "PRODUCT_GRID") return { ...base, eyebrow: "THE LATEST", title: "New Arrivals", body: "Fresh pieces, just landed.", limit: 6, filter: "new", gender: "" };
  if (type === "RICH_TEXT") return { ...base, eyebrow: "EDITORIAL", title: "Your story, considered.", body: "Use this block for brand narrative, campaign copy or long-form editorial content." };
  if (type === "BANNER") return { ...base, eyebrow: "ATELIER / EDIT", title: "The quiet art of dressing well.", body: "Move beautifully through every occasion.", buttonText: "Discover more", buttonLink: "/shop", image: "/images/hero/hero-03.jpg", height: 520, fit: "cover", ratio: "original", position: "center" };
  if (type === "FREEFORM") return { ...base, background: "#f7f2eb", minHeight: 360, elements: [freeElement("text"), freeElement("image"), freeElement("button")] };
  if (type === "NEWSLETTER") return { ...base, eyebrow: "THE ATELIER LETTER", title: "Notes on style.", body: "New arrivals, journal entries and private invitations." };
  if (type === "FAQ") return { ...base, eyebrow: "FAQ", title: "Questions", items: [{ question: "How does sizing work?", answer: "Choose your usual size or use the fit guidance on each product." }] };
  if (type === "SPACER") return { ...base, height: 80 };
  if (type === "NATIVE") return { ...base, route: "shop" };
  return base;
};

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <div className="field"><label>{label}</label><div className="visual-color-row"><input type="color" value={/^#[0-9a-f]{6}$/i.test(value || "") ? value : "#ffffff"} onChange={e => onChange(e.target.value)} /><input value={value || ""} onChange={e => onChange(e.target.value)} placeholder="#f6f1ea or transparent" /></div></div>;
}

export function VisualSiteBuilder({ pages, setPages, onNotify, onPreview, setSettings, settings }: Props) {
  const [selectedPageId, setSelectedPageId] = useState(pages.find(p => p.slug === "home")?.id || pages[0]?.id || "");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedElementId, setSelectedElementId] = useState("");
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [zoom, setZoom] = useState(80);
  const [dragSection, setDragSection] = useState<string | null>(null);
  const [history, setHistory] = useState<CmsPage[][]>([]);
  const [future, setFuture] = useState<CmsPage[][]>([]);
  const [saving, setSaving] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [easyDirty, setEasyDirty] = useState(false);
  const [easySaving, setEasySaving] = useState(false);
  const easySaveRef = useRef<(() => Promise<boolean>) | null>(null);
  const [status, setStatus] = useState<"saved" | "dirty">("saved");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetPhrase, setResetPhrase] = useState("");
  const [resetting, setResetting] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState("");
  const [newPageSlug, setNewPageSlug] = useState("");
  const [canvasMetrics, setCanvasMetrics] = useState({ availableWidth: 0, availableHeight: 640 });
  const canvasOuterRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const pageRef = useRef<CmsPage | null>(null);
  const selectedSectionRef = useRef("");
  const appearanceRef = useRef<Record<string, any> | null>(null);
  const lastPages = useRef<CmsPage[]>(pages);

  // Start with a useful preview size on the device opening the builder.
  useEffect(() => {
    const width = window.innerWidth;
    setDevice(width <= 700 ? "mobile" : width <= 1000 ? "tablet" : "desktop");
  }, []);

  useEffect(() => { if ((!selectedPageId || !pages.some(p => p.id === selectedPageId)) && pages.length) setSelectedPageId((pages.find(p => p.slug === "home") || pages[0]).id); }, [pages, selectedPageId]);
  // Quick find / dashboard shortcuts open a specific page or section here.
  useEffect(() => {
    const apply = (f: any) => {
      if (!f) return; const pg = pages.find(p => (f.pageId && p.id === f.pageId) || (f.slug && p.slug === f.slug));
       if (pg) { setSelectedPageId(pg.id); const match = pg.sections.find((x: any) => f.sectionId ? x.id === f.sectionId : f.sectionType && x.type === f.sectionType); if (match) setSelectedSectionId(match.id); }
    };
    try { const raw = sessionStorage.getItem("atelier:builder-focus"); if (raw && pages.length) { sessionStorage.removeItem("atelier:builder-focus"); apply(JSON.parse(raw)); } } catch {}
    const on = (e: Event) => { try { sessionStorage.removeItem("atelier:builder-focus"); } catch {} apply((e as CustomEvent).detail); };
    window.addEventListener("atelier:builder-focus", on); return () => window.removeEventListener("atelier:builder-focus", on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages.length]);
  const savedRef = useRef<Record<string, string>>({});
  useEffect(() => { if (status === "saved") savedRef.current = Object.fromEntries(pages.map(p => [p.id, JSON.stringify(p)])); }, [pages, status]);
  useEffect(() => { lastPages.current = pages; }, [pages]);

  const page = pages.find(p => p.id === selectedPageId) || null;
  const sections = useMemo(() => (page?.sections || []).slice().sort((a, b) => a.sortOrder - b.sortOrder), [page]);
  const section = sections.find(s => s.id === selectedSectionId) || sections[0] || null;
  const sectionDraft = section ? section.content || {} : {};
  const selectedElement = section?.type === "FREEFORM" ? ((sectionDraft.elements || []) as FreeElement[]).find(x => x.id === selectedElementId) : null;
  const pageRank = (p: CmsPage) => { const i = PAGE_PRIORITY.indexOf(p.slug); return i >= 0 ? i : (p.isSystem ? 100 : 200); };
  const orderedPages = [...pages].sort((a, b) => pageRank(a) - pageRank(b) || a.title.localeCompare(b.title));

  pageRef.current = page; selectedSectionRef.current = section?.id || "";
  const isAuthPage = page?.slug === "login" || page?.slug === "register";
  const checkoutTheme = (settings?.checkoutTheme || {}) as Record<string, any>;

  const saveCheckoutTheme = async (patch: Record<string, string>) => {
    const next = { ...checkoutTheme, ...patch };
    if (setSettings) setSettings({ ...(settings || {}), checkoutTheme: next });
    for (const [key, value] of Object.entries(next)) {
      const name = `--checkout-${key.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)}`;
      document.documentElement.style.setProperty(name, value);
      postToCanvas({ type: "atelier:canvas-css-var", name, value });
    }
    try {
      const saved = await api<Record<string, any>>("/admin/settings", { method: "PUT", body: JSON.stringify({ checkoutTheme: next }) });
      if (setSettings) setSettings(saved);
      window.dispatchEvent(new CustomEvent("atelier:data-changed"));
      onNotify("Checkout appearance saved and applied to the live checkout.");
    } catch (e: any) { onNotify(String(e?.message || e)); }
  };

  // The canvas is the REAL storefront (same components + CSS as the live site) running in an iframe.
  // The builder pushes the unsaved draft into it and receives clicks back, so what you see here is what visitors get.
  // We always use window.location.origin so the iframe loads the storefront root (e.g. http://localhost:3000)
  // regardless of which path the admin is currently on.
  const siteOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const canvasPageUrl = (slug: string) => {
    const path = slug === "home" ? "" : `/${slug}`;
    return `${siteOrigin}${path}?canvas=1`;
  };
  const postToCanvas = (msg: Record<string, any>) => { const w = iframeRef.current?.contentWindow; if (w) w.postMessage(msg, window.location.origin); };
  useEffect(() => { if (page) postToCanvas({ type: "atelier:canvas-page", page }); /* eslint-disable-next-line */ }, [page]);
  useEffect(() => { postToCanvas({ type: "atelier:canvas-selected", sectionId: section?.id || "" }); /* eslint-disable-next-line */ }, [section?.id]);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== iframeRef.current?.contentWindow) return;
      const m: any = e.data; if (!m || typeof m !== "object") return;
      if (m.type === "atelier:canvas-ready") {
        if (pageRef.current) postToCanvas({ type: "atelier:canvas-page", page: pageRef.current });
        postToCanvas({ type: "atelier:canvas-selected", sectionId: selectedSectionRef.current });
        if (appearanceRef.current) postToCanvas({ type: "atelier:canvas-settings", settings: appearanceRef.current });
      }
      if (m.type === "atelier:canvas-select" && m.sectionId) { setSelectedSectionId(String(m.sectionId)); setSelectedElementId(String(m.elementId || "")); }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => { if (section) setSelectedSectionId(section.id); }, [section?.id]);
  useEffect(() => { if (section?.type === "CIN_FILM") document.querySelector(".visual-builder-inspector .cin-form")?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [section?.id]);
  useEffect(() => { setSelectedElementId(""); }, [page?.id]);

  const commit = (next: CmsPage[]) => {
    setHistory(h => [...h.slice(-29), JSON.parse(JSON.stringify(pages))]);
    setFuture([]);
    setPages(next);
    setStatus("dirty");
  };
  const updateSection = (id: string, fn: (s: CmsSection) => CmsSection) => commit(pages.map(p => p.id === page!.id ? { ...p, sections: p.sections.map(s => s.id === id ? fn({ ...s, content: JSON.parse(JSON.stringify(s.content || {})) }) : s) } : p));
  const patchSectionContent = (patch: Record<string, any>) => { if (!section) return; updateSection(section.id, s => ({ ...s, content: { ...(s.content || {}), ...patch } })); };
  const patchSectionStyle = (patch: Record<string, any>) => patchSectionContent({ style: { ...((section?.content || {}).style || {}), ...patch } });
  const patchElement = (patch: Partial<FreeElement>) => { if (!section || !selectedElement) return; updateSection(section.id, s => ({ ...s, content: { ...(s.content || {}), elements: (s.content.elements || []).map((e: FreeElement) => e.id === selectedElement.id ? { ...e, ...patch } : e) } })); };
  const patchElementContent = (patch: Record<string, any>) => patchElement({ content: { ...(selectedElement?.content || {}), ...patch } });
  const patchElementStyle = (patch: Record<string, any>) => patchElement({ style: { ...(selectedElement?.style || {}), ...patch } });

  const createPage = async () => {
    const title = newPageTitle.trim();
    const slug = (newPageSlug.trim() || title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!title || !slug) return onNotify("Enter a page title and slug.");
    setSaving(true);
    try {
      const out = await api<CmsPage>("/admin/pages", { method: "POST", body: JSON.stringify({ title, slug, status: "DRAFT", seoTitle: title }) });
      setPages([...pages, { ...out, sections: [] }]);
      setSelectedPageId(out.id); setSelectedSectionId(""); setNewPageTitle(""); setNewPageSlug("");
      onNotify("New page created as draft. Build it visually, then publish it.");
    } catch (e:any) { onNotify(String(e?.message || e)); } finally { setSaving(false); }
  };
  const updatePageMeta = async (patch: Record<string, any>) => {
    if (!page) return;
    try {
      const out = await api<CmsPage>(`/admin/pages/${page.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      setPages(pages.map(p => p.id === out.id ? { ...p, ...out, sections: p.sections } : p));
    } catch (e:any) { onNotify(String(e?.message || e)); }
  };

  const saveImageSetting = async (key: "imageFit" | "imageAspect", value: string) => {
    const theme = { ...(settings?.theme || {}), [key]: value };
    if (setSettings) setSettings((current: any) => ({ ...current, theme }));
    document.documentElement.style.setProperty(
      key === "imageFit" ? "--site-img-fit" : "--site-img-aspect",
      value,
    );
    postToCanvas({
      type: "atelier:canvas-css-var",
      name: key === "imageFit" ? "--site-img-fit" : "--site-img-aspect",
      value,
    });
    try {
      const saved = await api<Record<string, any>>("/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ theme }),
      });
      if (setSettings) setSettings(saved);
      window.dispatchEvent(new CustomEvent("atelier:data-changed"));
      onNotify("Global image settings saved to the live site.");
    } catch (e: any) {
      onNotify(String(e?.message || e));
    }
  };

  const save = async () => {
    if (!page) return;
    setSaving(true);
    try {
      if (easyDirty && easySaveRef.current) {
        if (!(await easySaveRef.current())) return;
        if (status === "saved" && page.status !== "DRAFT") return;
      }
      let dirty = pages.filter(p => savedRef.current[p.id] !== JSON.stringify(p));
      if (!dirty.length) dirty = pages.filter(p => p.id === page.id);
      if (page.status === "DRAFT" && !dirty.some(item => item.id === page.id)) dirty.push(page);
      const publishedIds = new Set<string>();
      for (const current of dirty) {
        const publishing = current.id === page.id && current.status === "DRAFT";
        const savedPage = publishing ? { ...current, status: "PUBLISHED" as const } : current;
        await api(`/admin/pages/${current.id}/design`, { method: "PUT", body: JSON.stringify({ title: savedPage.title, status: savedPage.status, seoTitle: savedPage.seoTitle || null, seoDescription: savedPage.seoDescription || null, sections: savedPage.sections.map(s => ({ id: s.id, content: s.content, visible: s.visible, sortOrder: s.sortOrder })) }) });
        savedRef.current[current.id] = JSON.stringify(savedPage);
        if (publishing) publishedIds.add(current.id);
      }
      const nextPages = lastPages.current.map(item => publishedIds.has(item.id) ? { ...item, status: "PUBLISHED" as const } : item);
      if (publishedIds.size) setPages(nextPages);
      setStatus(nextPages.some(p => savedRef.current[p.id] !== JSON.stringify(p)) ? "dirty" : "saved"); onNotify(publishedIds.size ? "This page is now published on your website." : dirty.length > 1 ? `Website changes saved on ${dirty.length} pages.` : "Website changes published."); window.dispatchEvent(new CustomEvent("atelier:data-changed"));
    } catch (e: any) { setStatus("dirty"); onNotify(`Save stopped before all changes were written. Your draft is still open; retry Save design. ${String(e?.message || e)}`); }
    finally { setSaving(false); }
  };

  const saveRef = useRef(save); saveRef.current = save;
  useEffect(() => { const h = () => { void saveRef.current(); }; window.addEventListener("atelier:request-save", h); return () => window.removeEventListener("atelier:request-save", h); }, []);
  useEffect(() => { window.dispatchEvent(new CustomEvent("atelier:builder-status", { detail: { status: status === "dirty" || easyDirty ? "dirty" : "saved", saving: saving || easySaving } })); }, [status, saving, easyDirty, easySaving]);
  useEffect(() => () => { window.dispatchEvent(new CustomEvent("atelier:builder-status", { detail: { status: "saved", saving: false } })); }, []);
  const resetPage = async () => {
    if (!page) return;
    if (!window.confirm(`Reset the page "${page.title}" to its original design?\n\nA backup is saved first and can be restored from History. Other pages are not changed.`)) return;
    setSaving(true);
    try {
      const out = await api<CmsPage>(`/admin/pages/${page.id}/reset`, { method: "POST" });
      setPages(pages.map(x => x.id === out.id ? out : x)); setSelectedSectionId(""); setSelectedElementId(""); setHistory([]); setFuture([]); setStatus("saved");
      onNotify(`"${out.title}" is back to its original design.`); window.dispatchEvent(new CustomEvent("atelier:data-changed"));
    } catch (e: any) { onNotify(String(e?.message || e).replaceAll("_", " ")); }
    finally { setSaving(false); }
  };
  const undo = () => { const prev = history[history.length - 1]; if (!prev) return; setFuture(f => [JSON.parse(JSON.stringify(pages)), ...f]); setHistory(h => h.slice(0, -1)); setPages(prev); setStatus("dirty"); };
  const redo = () => { const next = future[0]; if (!next) return; setHistory(h => [...h, JSON.parse(JSON.stringify(pages))]); setFuture(f => f.slice(1)); setPages(next); setStatus("dirty"); };
  const resetWebsite = async () => {
    if (resetPhrase.trim() !== "RESET WEBSITE" || resetting) return;
    setResetting(true);
    try {
      const result = await api<{ ok: boolean; pages: CmsPage[]; settings?: Record<string, any>; removedCustomPages: number; resetDesignSettings: number }>("/admin/site/reset", {
        method: "POST",
        body: JSON.stringify({ confirmation: resetPhrase.trim() })
      });
      setPages(result.pages || []);
      if (result.settings && setSettings) setSettings(result.settings);
      setSelectedPageId((result.pages || []).find(p => p.slug === "home")?.id || result.pages?.[0]?.id || "");
      setSelectedSectionId(""); setSelectedElementId(""); setHistory([]); setFuture([]); setStatus("saved");
      setResetOpen(false); setResetPhrase("");
      window.dispatchEvent(new CustomEvent("atelier:data-changed"));
      onNotify(`Website design restored. Removed ${result.removedCustomPages} custom page(s); products, orders, accounts, payment details and AI API connections were kept.`);
    } catch (e:any) {
      onNotify(String(e?.message || e));
    } finally { setResetting(false); }
  };

  const addBlock = (type: string) => { if (!page) return; const newSection: CmsSection = { id: uid("section"), pageId: page.id, type, sortOrder: sections.length, visible: true, content: sectionDefaults(type) } as CmsSection; // optimistic local ID; backend assigns real ID on save-less mode below
    void (async () => { setSaving(true); try { const out = await api<CmsSection>(`/admin/pages/${page.id}/sections`, { method: "POST", body: JSON.stringify({ type, sortOrder: sections.length, visible: true, content: newSection.content }) }); commit(pages.map(p => p.id === page.id ? { ...p, sections: [...p.sections, out] } : p)); setSelectedSectionId(out.id); setSelectedElementId(""); window.setTimeout(() => postToCanvas({ type: "atelier:canvas-scroll-to", sectionId: out.id }), 350); onNotify(`${blockLabel[type] || type} added to canvas.`); } catch (e: any) { onNotify(String(e?.message || e)); } finally { setSaving(false); } })(); };

  const deleteSection = async () => { if (!section || section.type === "NATIVE") { if (section) onNotify("Protected native areas stay available for commerce routes; hide them instead."); return; } if (!confirm(`Delete ${blockLabel[section.type] || section.type}?`)) return; try { await api(`/admin/sections/${section.id}`, { method: "DELETE" }); const next = pages.map(p => p.id === page!.id ? { ...p, sections: p.sections.filter(s => s.id !== section.id) } : p); commit(next); setSelectedSectionId(""); setSelectedElementId(""); onNotify("Section deleted."); } catch (e: any) { onNotify(String(e?.message || e)); } };
  const duplicateSection = async () => { if (!section) return; try { const out = await api<CmsSection>(`/admin/sections/${section.id}/duplicate`, { method: "POST" }); const next = pages.map(p => p.id === page!.id ? { ...p, sections: [...p.sections, out] } : p); commit(next); setSelectedSectionId(out.id); onNotify("Section duplicated."); } catch (e: any) { onNotify(String(e?.message || e)); } };

  const dropSection = async (targetId: string) => { if (!dragSection || !page || dragSection === targetId) return; const current = sections.slice(); const from = current.findIndex(x => x.id === dragSection); const to = current.findIndex(x => x.id === targetId); if (from < 0 || to < 0) return; const moved = current.splice(from, 1)[0]; current.splice(to, 0, moved); const updated = await Promise.all(current.map((s, i) => api<CmsSection>(`/admin/sections/${s.id}`, { method: "PATCH", body: JSON.stringify({ sortOrder: i }) }).then(out => ({ ...s, sortOrder: out.sortOrder })))); commit(pages.map(p => p.id === page.id ? { ...p, sections: updated } : p)); setDragSection(null); };

  const addFreeElement = (type: FreeElement["type"]) => { if (!section || section.type !== "FREEFORM") return; const element = freeElement(type); patchSectionContent({ elements: [...(sectionDraft.elements || []), element] }); setSelectedElementId(element.id); };
  const deleteFreeElement = () => { if (!selectedElement || !section) return; patchSectionContent({ elements: (sectionDraft.elements || []).filter((x: FreeElement) => x.id !== selectedElement.id) }); setSelectedElementId(""); };
  const moveFreeElement = (fromId: string, toId: string) => { if (!section || section.type !== "FREEFORM" || fromId === toId) return; const list=[...(sectionDraft.elements || [])]; const from=list.findIndex((x: FreeElement)=>x.id===fromId); const to=list.findIndex((x: FreeElement)=>x.id===toId); if(from<0||to<0)return; const moved=list.splice(from,1)[0]; list.splice(to,0,moved); patchSectionContent({elements:list}); };

  const canvasWidth = device === "mobile" ? 390 : device === "tablet" ? 768 : 1440;
  useEffect(() => {
    const outer = canvasOuterRef.current;
    if (!outer || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const computed = window.getComputedStyle(outer);
      const padX = (Number.parseFloat(computed.paddingLeft) || 0) + (Number.parseFloat(computed.paddingRight) || 0);
      const padY = (Number.parseFloat(computed.paddingTop) || 0) + (Number.parseFloat(computed.paddingBottom) || 0);
      const availableWidth = Math.max(240, outer.clientWidth - padX);
      const availableHeight = Math.max(420, outer.clientHeight - padY);
      setCanvasMetrics(previous => Math.abs(previous.availableWidth - availableWidth) < 1 && Math.abs(previous.availableHeight - availableHeight) < 1 ? previous : { availableWidth, availableHeight });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    return () => observer.disconnect();
  }, [device]);
  const fitScale = canvasMetrics.availableWidth > 0 ? Math.min(1, canvasMetrics.availableWidth / canvasWidth) : (device === "desktop" ? 0.6 : 1);
  const canvasScale = fitScale * zoom / 100;
  const stageWidth = canvasWidth * canvasScale;
  const stageHeight = canvasMetrics.availableHeight;
  const frameHeight = stageHeight / canvasScale;

  return <div className={`visual-builder-shell ${advanced ? "is-advanced" : "is-easy"}`}>
    <div className="visual-builder-topbar">
      <div><div className="eyebrow">ATELIER / WEBSITE EDITOR</div><h2 className="serif">Your website. Your way.</h2><small>{status === "dirty" || easyDirty ? "Website changes not published yet" : "Website changes saved"}</small></div>
      <div className="visual-builder-top-actions">
        <button className="btn text" type="button" aria-pressed={advanced} onClick={() => setAdvanced(value => !value)}>{advanced ? "Switch to easy mode" : "Advanced design tools"}</button>
        <button className="btn text" onClick={undo} disabled={!history.length}>Undo</button><button className="btn text" onClick={redo} disabled={!future.length}>Redo</button>
        <div className="visual-device-switch"><button className={device === "desktop" ? "active" : ""} onClick={() => setDevice("desktop")}>Desktop</button><button className={device === "tablet" ? "active" : ""} onClick={() => setDevice("tablet")}>Tablet</button><button className={device === "mobile" ? "active" : ""} onClick={() => setDevice("mobile")}>Mobile</button></div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, background: "rgba(0,0,0,0.04)", padding: "2px 8px", borderRadius: 4, border: "1px solid rgba(0,0,0,0.08)" }}>
          <span style={{ fontWeight: 600 }}>Image Fit:</span>
          <select style={{ fontSize: 11, background: "transparent", border: "none", cursor: "pointer" }} value={settings?.theme?.imageFit || "contain"} onChange={e => { void saveImageSetting("imageFit", e.target.value); }}>
            <option value="contain">Contain (No Crop)</option>
            <option value="cover">Cover (Fill Card)</option>
          </select>
          <span style={{ fontWeight: 600, marginLeft: 4 }}>Ratio:</span>
          <select style={{ fontSize: 11, background: "transparent", border: "none", cursor: "pointer" }} value={settings?.theme?.imageAspect || "4/5"} onChange={e => { void saveImageSetting("imageAspect", e.target.value); }}>
            <option value="4/5">4:5 Editorial</option>
            <option value="3/4">3:4 Classic</option>
            <option value="1/1">1:1 Square</option>
            <option value="16/9">16:9 Widescreen</option>
          </select>
        </div>
        <button className="btn text" onClick={() => page && onPreview?.(page.slug === "home" ? "/" : `/${page.slug}`)}>Live preview</button>
        <button className="btn text" onClick={() => setHistoryOpen(true)} disabled={saving || resetting}>History</button>
        <button className="btn text" onClick={() => void resetPage()} disabled={saving || resetting || !page}>Reset page</button>
        {advanced && <button className="btn text danger-text" onClick={() => { setResetPhrase(""); setResetOpen(true); }} disabled={saving || resetting}>Factory reset</button>}
        <button className="btn dark" disabled={saving || easySaving || (status === "saved" && !easyDirty && page?.status !== "DRAFT")} onClick={save}>{saving || easySaving ? "Publishing…" : "Publish website"}</button>
      </div>
    </div>

    <div className="visual-builder-howto" role="note"><strong>How to edit your real website:</strong> The centre is your actual page, rendered by the same code as the live site (it scrolls like a browser window). Click any section in it, or pick it from <b>Sections</b> on the left, then change its text, images and links on the right. Press <b>Publish website</b> to publish; open storefront tabs update by themselves. Image + Text sections have a <b>Reverse layout</b> switch. Use <b>Image fit / Aspect ratio / Height / Focus</b> under each image to control the crop. Undo/Redo reverses unsaved changes.</div>

    <SiteAppearanceEditor settings={settings} onNotify={onNotify} onSaved={value => setSettings?.(value)} onPreview={value => { appearanceRef.current = { ...appearanceRef.current, ...value }; postToCanvas({ type: "atelier:canvas-settings", settings: value }); }} />
    {page?.slug === "checkout" && <section className="checkout-theme-editor" aria-label="Checkout page appearance">
      <div><div className="eyebrow">Built-in commerce page</div><h3 className="serif">Checkout appearance</h3><p>Checkout is a protected payment form, so it does not use ordinary CMS blocks. Edit its visible colours here; payment settings remain under Gateway Setup.</p></div>
      <div className="form-grid">
        <ColorField label="Page background" value={String(checkoutTheme.pageBackground || "#f5f0e9")} onChange={v => void saveCheckoutTheme({ pageBackground: v })}/>
        <ColorField label="Card background" value={String(checkoutTheme.cardBackground || "#fbf7f1")} onChange={v => void saveCheckoutTheme({ cardBackground: v })}/>
        <ColorField label="Main text" value={String(checkoutTheme.textColor || "#211a16")} onChange={v => void saveCheckoutTheme({ textColor: v })}/>
        <ColorField label="Muted text" value={String(checkoutTheme.mutedColor || "#6e655e")} onChange={v => void saveCheckoutTheme({ mutedColor: v })}/>
        <ColorField label="Input background" value={String(checkoutTheme.inputBackground || "#fffdf9")} onChange={v => void saveCheckoutTheme({ inputBackground: v })}/>
        <ColorField label="Accent / payment button" value={String(checkoutTheme.accentColor || "#d7ff55")} onChange={v => void saveCheckoutTheme({ accentColor: v })}/>
      </div>
      <button className="btn text" type="button" onClick={() => onPreview?.("/checkout")}>Preview checkout</button>
    </section>}

    {historyOpen && <SiteHistoryModal onClose={() => setHistoryOpen(false)} onNotify={onNotify} onRestored={out => {
      setPages(out.pages || []); if (out.settings && setSettings) setSettings(out.settings);
      setSelectedPageId((out.pages || []).find((p: CmsPage) => p.slug === "home")?.id || out.pages?.[0]?.id || "");
      setSelectedSectionId(""); setSelectedElementId(""); setHistory([]); setFuture([]); setStatus("saved");
      window.dispatchEvent(new CustomEvent("atelier:data-changed"));
    }} />}
    {resetOpen && <div className="visual-reset-backdrop" role="presentation"><section className="visual-reset-modal" role="dialog" aria-modal="true" aria-labelledby="visual-reset-title"><div className="eyebrow">Recovery / Factory reset</div><h3 id="visual-reset-title">Factory reset to the original design?</h3><p>This restores built-in pages and sections, removes custom pages, and clears visual theme/navigation changes. A backup of the current design is saved first and can be restored from <b>History</b>. It does <b>not</b> delete products, customer accounts, orders, payment configuration, security settings or saved AI API connections.</p><p>Type <code>RESET WEBSITE</code> below to confirm.</p><label className="field"><span>Confirmation phrase</span><input autoFocus value={resetPhrase} onChange={e => setResetPhrase(e.target.value)} placeholder="RESET WEBSITE" onKeyDown={e => { if (e.key === "Enter") void resetWebsite(); if (e.key === "Escape") setResetOpen(false); }}/></label><div className="visual-reset-actions"><button className="btn text" type="button" disabled={resetting} onClick={() => { setResetOpen(false); setResetPhrase(""); }}>Cancel</button><button className="btn dark" type="button" disabled={resetting || resetPhrase.trim() !== "RESET WEBSITE"} onClick={() => void resetWebsite()}>{resetting ? "Restoring…" : "Restore original website"}</button></div></section></div>}

    <div className="visual-builder-grid">
      <aside className="visual-builder-palette">
        <div className="visual-panel-title"><span>Pages</span><small>{orderedPages.length}</small></div>
        <div className="visual-new-page"><input value={newPageTitle} onChange={e=>setNewPageTitle(e.target.value)} placeholder="New page name"/><input value={newPageSlug} onChange={e=>setNewPageSlug(e.target.value)} placeholder="slug (e.g. journal)"/><button className="btn dark" onClick={() => void createPage()} disabled={saving}>+ Create page</button></div>
        <div className="visual-pages-list">{orderedPages.map(p => <button key={p.id} className={p.id === page?.id ? "active" : ""} onClick={() => setSelectedPageId(p.id)}><span>{p.title}</span><small>/{p.slug} · {p.status}</small></button>)}</div>
        <div className="visual-panel-title add-title"><span>Sections</span><small>{sections.length} · drag to reorder</small></div>
        <div className="visual-layers">{sections.map(s => { const c: Record<string, any> = s.content || {}; const hint = String(c.title || c.line1 || c.eyebrow || c.route || "").slice(0, 34); return <button key={s.id} draggable onDragStart={() => setDragSection(s.id)} onDragEnd={() => setDragSection(null)} onDragOver={e => dragSection && e.preventDefault()} onDrop={e => { e.stopPropagation(); void dropSection(s.id); }} className={s.id === section?.id ? "active" : ""} onClick={() => { setSelectedSectionId(s.id); setSelectedElementId(""); postToCanvas({ type: "atelier:canvas-scroll-to", sectionId: s.id }); }}><b>{blockLabel[s.type] || s.type}</b><small>{hint}{s.visible ? "" : " · hidden"}</small></button>; })}</div>
        <div className="visual-panel-title add-title"><span>Add block</span><small>click to add</small></div>
        <div className="visual-block-list">{BLOCKS.map(([type, label, desc]) => <button key={type} onClick={() => addBlock(type)}><b>{label}</b><small>{desc}</small></button>)}</div>
      </aside>

      <main className="visual-builder-canvas-wrap">
        <div className="visual-canvas-toolbar"><div><b>{page?.title || "Page"}</b><span>/{page?.slug || ""}</span></div><div className="visual-zoom"><button onClick={() => setZoom(z => Math.max(50, z - 10))}>−</button><span>{zoom}%</span><button onClick={() => setZoom(z => Math.min(110, z + 10))}>+</button></div></div>
        <div className="visual-canvas-outer" ref={canvasOuterRef}><div className="visual-canvas-stage" style={{ width: stageWidth, height: stageHeight, marginInline: "auto", flex: "0 0 auto", position: "relative" }}>
          {page ? <iframe ref={iframeRef} key={page.slug} className="visual-canvas-frame" title={`${page.title} — real page canvas`} src={canvasPageUrl(page.slug)} style={{ width: canvasWidth, height: frameHeight, transform: `scale(${canvasScale})`, transformOrigin: "top left", position: "absolute", top: 0, left: 0 }} /> : <div className="visual-canvas-empty"><strong>Pick a page</strong><span>Choose a page on the left.</span></div>}
        </div></div>
      </main>

      <aside className="visual-builder-inspector">
    <EasySiteEditor onStateChange={state => { setEasyDirty(state.dirty); setEasySaving(state.saving); easySaveRef.current = state.save; }} settings={settings || {}} frameRef={iframeRef} route={page?.slug === "home" ? "/" : `/${page?.slug || ""}`} onNotify={onNotify} onSaved={value => setSettings?.(value)} onPreview={value => { appearanceRef.current = { ...appearanceRef.current, ...value }; postToCanvas({ type: "atelier:canvas-settings", settings: value }); }} onFilm={() => { const home = pages.find(item => item.slug === "home"); const film = home?.sections.find(item => item.type === "CIN_FILM"); if (home && film) { setSelectedPageId(home.id); setSelectedSectionId(film.id); setSelectedElementId(""); window.setTimeout(() => { postToCanvas({ type: "atelier:canvas-scroll-to", sectionId: film.id }); document.querySelector(".visual-builder-inspector .cin-form")?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, 500); } else onNotify("Choose Home, then add Film & animated cards from Add block."); }} />
        {!section ? <div className="visual-inspector-empty"><strong>Select something on the canvas.</strong><span>Its content and visual controls will appear here.</span></div> : <>
          <div className="visual-panel-title"><span>{selectedElement ? "Element" : "Section"}</span><small>{selectedElement ? selectedElement.type : blockLabel[section.type] || section.type}</small></div>
          {!selectedElement && <>
            <details open className="visual-page-settings"><summary>Page settings</summary><div className="form-grid"><div className="field full"><label>Page title</label><input value={page?.title || ""} onChange={e=>setPages(pages.map(x=>x.id===page?.id?{...x,title:e.target.value}:x))} onBlur={e=>void updatePageMeta({title:e.target.value})}/></div><div className="field"><label>SEO title</label><input value={page?.seoTitle || ""} onChange={e=>setPages(pages.map(x=>x.id===page?.id?{...x,seoTitle:e.target.value}:x))} onBlur={e=>void updatePageMeta({seoTitle:e.target.value})}/></div><div className="field"><label>Status</label><select value={page?.status || "DRAFT"} onChange={e=>void updatePageMeta({status:e.target.value})}><option>PUBLISHED</option><option>DRAFT</option><option>ARCHIVED</option></select></div><div className="field full"><label>SEO description</label><textarea rows={4} value={page?.seoDescription || ""} onChange={e=>setPages(pages.map(x=>x.id===page?.id?{...x,seoDescription:e.target.value}:x))} onBlur={e=>void updatePageMeta({seoDescription:e.target.value})}/></div></div></details>
            <div className="visual-inspector-tabs"><span className="active">Edit content below</span><span>{advanced ? "Advanced tools on" : "Easy mode"}</span></div>
            {section.type === "HERO" && !isAuthPage && <><div className="form-grid">{[["eyebrow","Eyebrow"],["line1","Headline line 1"],["line2","Headline line 2"],["line3","Headline line 3"],["text","Supporting text"],["buttonText","Button text"],["buttonLink","Button link"]].map(([k,l]) => <div className="field" key={k}><label>{l}</label><input value={String(sectionDraft[k] ?? "")} onChange={e => patchSectionContent({ [k]: e.target.value })}/></div>)}</div><ImageField value={sectionDraft.image} onChange={v => patchSectionContent({ image: v })} onNotify={onNotify} layout data={sectionDraft} onData={(k,v) => patchSectionContent({ [k]: v })}/></>}
            {section.type === "IMAGE_TEXT" && <><div className="form-grid">{[["eyebrow","Eyebrow"],["title","Title"],["body","Body"],["buttonText","Button text"],["buttonLink","Button link"]].map(([k,l]) => <div className={`field ${k === "body" ? "full" : ""}`} key={k}><label>{l}</label>{k === "body" ? <textarea rows={5} value={String(sectionDraft[k] ?? "")} onChange={e => patchSectionContent({ [k]: e.target.value })}/> : <input value={String(sectionDraft[k] ?? "")} onChange={e => patchSectionContent({ [k]: e.target.value })}/>}</div>)}</div><label className="visual-toggle-field"><input type="checkbox" checked={Boolean(sectionDraft.reverse)} onChange={e => patchSectionContent({ reverse: e.target.checked })}/><span><b>Reverse layout</b><small>Move the text to the left and the image to the right. On mobile, the image stays above the text.</small></span></label><ImageField value={sectionDraft.image} onChange={v => patchSectionContent({ image: v })} onNotify={onNotify} layout data={sectionDraft} onData={(k,v) => patchSectionContent({ [k]: v })}/></>}
            {(section.type === "RICH_TEXT" || section.type === "NEWSLETTER") && <div className="form-grid">{[["eyebrow","Eyebrow"],["title","Title"]].map(([k,l]) => <div className="field" key={k}><label>{l}</label><input value={String(sectionDraft[k] ?? "")} onChange={e => patchSectionContent({ [k]: e.target.value })}/></div>)}<div className="field full"><label>Body</label><textarea rows={8} value={String(sectionDraft.body ?? "")} onChange={e => patchSectionContent({ body: e.target.value })}/></div></div>}
            {section.type === "FREEFORM" && <><div className="visual-element-toolbar"><button onClick={() => addFreeElement("text")}>+ Text</button><button onClick={() => addFreeElement("image")}>+ Image</button><button onClick={() => addFreeElement("button")}>+ Button</button><button onClick={() => addFreeElement("columns")}>+ Columns</button><button onClick={() => addFreeElement("spacer")}>+ Spacer</button><button onClick={() => addFreeElement("divider")}>+ Divider</button><button onClick={() => addFreeElement("video")}>+ Video</button></div><p className="settings-help">Click an element in the canvas to edit it. Drag blocks between sections to reorder.</p></>}
            {(["IMAGE_GRID", "COLLECTION_GRID", "BANNER", "BENEFITS", "HERO_SLIDER", "PRODUCT_GRID", "FAQ", "SPACER", "NATIVE"].includes(section.type) || isCin(section.type) || (section.type === "HERO" && isAuthPage)) && <SectionContentForm type={section.type} content={sectionDraft} onPatch={patchSectionContent} onNotify={onNotify} isAuth={isAuthPage}/>}
            <details open className="visual-design-details"><summary>Design & layout</summary><div className="form-grid">{["paddingTop","paddingRight","paddingBottom","paddingLeft"].map(k => <RangeControl key={k} label={k.replace("padding", "Padding ")} value={Number((sectionDraft.style || {})[k] || 0)} min={0} max={360} step={4} unit="px" onChange={v => patchSectionStyle({ [k]: v })}/>) }<RangeControl label="Border radius" value={Number((sectionDraft.style || {}).borderRadius || 0)} min={0} max={60} step={2} unit="px" onChange={v => patchSectionStyle({ borderRadius: v })}/><RangeControl label="Border width" value={Number((sectionDraft.style || {}).borderWidth || 0)} min={0} max={8} step={1} unit="px" onChange={v => patchSectionStyle({ borderWidth: v })}/><RangeControl label="Minimum height" value={Number((sectionDraft.style || {}).minHeight || 0)} min={0} max={1400} step={10} unit="px" onChange={v => patchSectionStyle({ minHeight: v })}/><RangeControl label="Gap" value={Number((sectionDraft.style || {}).gap || 16)} min={0} max={120} step={4} unit="px" onChange={v => patchSectionStyle({ gap: v })}/></div><ColorField label="Background" value={String((sectionDraft.style || {}).background || "transparent")} onChange={v => patchSectionStyle({ background: v })}/><ColorField label="Text colour" value={String((sectionDraft.style || {}).color || "#241d18")} onChange={v => patchSectionStyle({ color: v })}/>{section.type === "IMAGE_TEXT" && <><ColorField label="Button background" value={String((sectionDraft.style || {}).buttonBackground || "#d7ff55")} onChange={v => patchSectionStyle({ buttonBackground: v })}/><ColorField label="Button text colour" value={String((sectionDraft.style || {}).buttonColor || "#080a09")} onChange={v => patchSectionStyle({ buttonColor: v })}/></>}<div className="field"><label>Text alignment</label><select value={(sectionDraft.style || {}).align || "left"} onChange={e => patchSectionStyle({ align: e.target.value })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></div></details>
            <div className="visual-inspector-actions"><button className="btn text" onClick={duplicateSection}>Duplicate</button><button className="btn text danger-text" onClick={deleteSection}>Delete</button><label className="check"><input type="checkbox" checked={section.visible} onChange={e => updateSection(section.id, s => ({ ...s, visible: e.target.checked }))}/> Visible</label></div>
          </>}
          {selectedElement && <>
            <div className="field"><label>Element type</label><select value={selectedElement.type} onChange={e => patchElement({ type: e.target.value as FreeElement["type"] })}>{["text","image","button","columns","spacer","divider","video"].map(x => <option key={x} value={x}>{x}</option>)}</select></div>
            {selectedElement.type === "text" && <div className="form-grid">{[["eyebrow","Eyebrow"],["title","Title"]].map(([k,l]) => <div className="field" key={k}><label>{l}</label><input value={String(selectedElement.content[k] || "")} onChange={e => patchElementContent({ [k]: e.target.value })}/></div>)}<div className="field full"><label>Body</label><textarea rows={7} value={String(selectedElement.content.body || "")} onChange={e => patchElementContent({ body: e.target.value })}/></div></div>}
            {selectedElement.type === "image" && <ImageField value={selectedElement.content.src} onChange={v => patchElementContent({ src: v })} onNotify={onNotify} layout data={selectedElement.content} onData={(k,v) => patchElementContent({ [k]: v })}/>} 
            {selectedElement.type === "button" && <div className="form-grid">{[["text","Button text"],["link","Link"]].map(([k,l]) => <div className="field" key={k}><label>{l}</label><input value={String(selectedElement.content[k] || "")} onChange={e => patchElementContent({ [k]: e.target.value })}/></div>)}</div>}
            {selectedElement.type === "spacer" && <RangeControl label="Height" value={Number(selectedElement.content.height || 80)} min={0} max={1200} step={10} unit="px" onChange={v => patchElementContent({ height: v })}/>} 
            {selectedElement.type === "columns" && <RangeControl label="Columns" value={Number(selectedElement.content.columns || 2)} min={1} max={6} step={1} onChange={v => patchElementContent({ columns: v })}/>} 
            {selectedElement.type === "video" && <div className="form-grid">{[["src","Video URL"],["poster","Poster image URL"]].map(([k,l]) => <div className="field full" key={k}><label>{l}</label><input value={String(selectedElement.content[k] || "")} onChange={e => patchElementContent({ [k]: e.target.value })}/></div>)}</div>}
            <details open className="visual-design-details"><summary>Element design</summary><div className="form-grid">{["paddingTop","paddingRight","paddingBottom","paddingLeft"].map(k => <RangeControl key={k} label={k.replace("padding", "Padding ")} value={Number((selectedElement.style || {})[k] || 0)} min={0} max={240} step={4} unit="px" onChange={v => patchElementStyle({ [k]: v })}/>) }<RangeControl label="Radius" value={Number((selectedElement.style || {}).borderRadius || 0)} min={0} max={60} step={2} unit="px" onChange={v => patchElementStyle({ borderRadius: v })}/><RangeControl label="Width" value={Number((selectedElement.style || {}).width || 0)} min={0} max={1400} step={10} unit="px" hint="0 = auto" onChange={v => patchElementStyle({ width: v || "" })}/><RangeControl label="Height" value={Number((selectedElement.style || {}).height || 0)} min={0} max={1400} step={10} unit="px" hint="0 = auto" onChange={v => patchElementStyle({ height: v || "" })}/><RangeControl label="Font size" value={Number((selectedElement.style || {}).fontSize || 0)} min={0} max={140} step={1} unit="px" hint="0 = block default" onChange={v => patchElementStyle({ fontSize: v || 0 })}/><RangeControl label="Line height" value={Number((selectedElement.style || {}).lineHeight || 1.5)} min={0.8} max={2.4} step={0.05} unit="" onChange={v => patchElementStyle({ lineHeight: v })}/><RangeControl label="Letter spacing" value={Number((selectedElement.style || {}).letterSpacing || 0)} min={-2} max={12} step={0.25} unit="px" onChange={v => patchElementStyle({ letterSpacing: v })}/><RangeControl label="Opacity" value={Number((selectedElement.style || {}).opacity ?? 1)} min={0.1} max={1} step={0.05} unit="" onChange={v => patchElementStyle({ opacity: v })}/></div><ColorField label="Background" value={String((selectedElement.style || {}).background || "transparent")} onChange={v => patchElementStyle({ background: v })}/><ColorField label="Text colour" value={String((selectedElement.style || {}).color || "#241d18")} onChange={v => patchElementStyle({ color: v })}/><div className="field"><label>Alignment</label><select value={(selectedElement.style || {}).align || "left"} onChange={e => patchElementStyle({ align: e.target.value })}><option>left</option><option>center</option><option>right</option></select></div></details>
            <div className="visual-inspector-actions"><button className="btn text danger-text" onClick={deleteFreeElement}>Delete element</button><button className="btn text" onClick={() => setSelectedElementId("")}>Back to section</button></div>
          </>}
        </>}
      </aside>
    </div>
  </div>;
}
