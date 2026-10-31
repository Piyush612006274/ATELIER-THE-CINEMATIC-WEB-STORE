import { cmsDefaultPages } from "../database/cmsDefaults.js";
import { DESIGN_SETTING_KEYS, DESIGN_DEFAULT_SETTINGS } from "../database/siteDefaults.js";

/**
 * Website design history.
 *  - AUTO_DAILY : one row per calendar day (admin timezone) holding the LAST design state of that day.
 *                 It is refreshed after every admin edit, so "10/14" always means "how the site looked
 *                 when you finished editing on 10/14" and later edits never overwrite it.
 *  - MANUAL / PRE_RESET / PRE_RESTORE / PRE_UPGRADE / INITIAL : explicit checkpoints and safety backups.
 * Snapshots contain ONLY page/section content and design settings. Products, orders, customers,
 * payment configuration and AI provider keys are never included or touched.
 */
export type SnapshotKind = "AUTO_DAILY" | "MANUAL" | "PRE_RESET" | "PRE_RESTORE" | "PRE_UPGRADE" | "INITIAL";
const TZ = process.env.SNAPSHOT_TIMEZONE || "Asia/Kolkata";
export const dayKey = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

export async function buildState(db: any) {
  const pages = await db.sitePage.findMany({ include: { sections: { orderBy: { sortOrder: "asc" } } }, orderBy: { createdAt: "asc" } });
  const rows = await db.siteSetting.findMany({ where: { key: { in: [...DESIGN_SETTING_KEYS] } } });
  return {
    version: 1,
    pages: pages.map((p: any) => ({ slug: p.slug, title: p.title, status: p.status, isSystem: p.isSystem, seoTitle: p.seoTitle, seoDescription: p.seoDescription,
      sections: p.sections.map((s: any) => ({ type: s.type, sortOrder: s.sortOrder, visible: s.visible, content: s.content })) })),
    settings: Object.fromEntries(rows.map((r: any) => [r.key, r.value]))
  };
}
const countSections = (state: any) => (state.pages || []).reduce((n: number, p: any) => n + (p.sections?.length || 0), 0);

export async function saveSnapshot(db: any, opts: { kind: SnapshotKind; label?: string; actorId?: string | null }) {
  const state = await buildState(db);
  const meta = { pageCount: state.pages.length, sectionCount: countSections(state) };
  const key = dayKey();
  if (opts.kind === "AUTO_DAILY") {
    const existing = await db.siteDesignSnapshot.findFirst({ where: { kind: "AUTO_DAILY", dateKey: key } });
    if (existing) return db.siteDesignSnapshot.update({ where: { id: existing.id }, data: { state, ...meta, label: opts.label ?? existing.label, createdBy: opts.actorId ?? existing.createdBy } });
  }
  const row = await db.siteDesignSnapshot.create({ data: { kind: opts.kind, dateKey: key, label: opts.label ?? null, state, createdBy: opts.actorId ?? null, ...meta } });
  await pruneSnapshots(db);
  return row;
}

export async function pruneSnapshots(db: any) {
  const limits: Record<string, number> = { AUTO_DAILY: 180, MANUAL: 100, PRE_RESET: 20, PRE_RESTORE: 30, PRE_UPGRADE: 10 };
  for (const [kind, keep] of Object.entries(limits)) {
    const old = await db.siteDesignSnapshot.findMany({ where: { kind }, orderBy: { createdAt: "desc" }, skip: keep, select: { id: true } });
    if (old.length) await db.siteDesignSnapshot.deleteMany({ where: { id: { in: old.map((o: any) => o.id) } } });
  }
}

/** Replace live design with a state object. Runs inside a transaction supplied by the caller. */
export async function applyState(tx: any, state: any) {
  const pages: any[] = Array.isArray(state?.pages) ? state.pages : [];
  const slugs = pages.map(p => p.slug);
  await tx.sitePage.deleteMany({ where: { slug: { notIn: slugs } } });
  for (const p of pages) {
    const page = await tx.sitePage.upsert({
      where: { slug: p.slug },
      create: { slug: p.slug, title: p.title, status: p.status || "PUBLISHED", isSystem: Boolean(p.isSystem), seoTitle: p.seoTitle ?? null, seoDescription: p.seoDescription ?? null },
      update: { title: p.title, status: p.status || "PUBLISHED", isSystem: Boolean(p.isSystem), seoTitle: p.seoTitle ?? null, seoDescription: p.seoDescription ?? null }
    });
    await tx.siteSection.deleteMany({ where: { pageId: page.id } });
    for (const [i, s] of (p.sections || []).entries()) {
      await tx.siteSection.create({ data: { pageId: page.id, type: s.type, sortOrder: s.sortOrder ?? i, visible: s.visible !== false, content: s.content ?? {} } });
    }
  }
  const settings = state?.settings && typeof state.settings === "object" ? state.settings : {};
  for (const key of DESIGN_SETTING_KEYS) {
    if (key in settings) await tx.siteSetting.upsert({ where: { key }, update: { value: settings[key] }, create: { key, value: settings[key] } });
    else await tx.siteSetting.deleteMany({ where: { key } });
  }
}

export function factoryState() {
  return {
    version: 1,
    pages: cmsDefaultPages.map(d => ({ slug: d.slug, title: d.title, status: "PUBLISHED", isSystem: d.isSystem, seoTitle: null, seoDescription: null,
      sections: d.sections.map((s, i) => ({ type: s.type, sortOrder: i, visible: true, content: s.content })) })),
    settings: { ...DESIGN_DEFAULT_SETTINGS }
  };
}

export async function factoryReset(prisma: any, actorId?: string | null) {
  const backup = await saveSnapshot(prisma, { kind: "PRE_RESET", label: "Automatic backup before factory reset", actorId });
  const before = await prisma.sitePage.count();
  await prisma.$transaction(async (tx: any) => { await applyState(tx, factoryState()); }, { timeout: 60000 });
  const after = await prisma.sitePage.count();
  await saveSnapshot(prisma, { kind: "AUTO_DAILY", label: "Factory reset", actorId });
  return { backupId: backup.id, removedCustomPages: Math.max(0, before - after) };
}

export async function restoreSnapshot(prisma: any, id: string, actorId?: string | null) {
  const snap = await prisma.siteDesignSnapshot.findUnique({ where: { id } });
  if (!snap) return null;
  const backup = await saveSnapshot(prisma, { kind: "PRE_RESTORE", label: `Automatic backup before restoring ${snap.dateKey}`, actorId });
  await prisma.$transaction(async (tx: any) => { await applyState(tx, snap.state); }, { timeout: 60000 });
  await saveSnapshot(prisma, { kind: "AUTO_DAILY", label: `Restored from ${snap.dateKey}`, actorId });
  return { snapshot: snap, backupId: backup.id };
}

let timer: NodeJS.Timeout | null = null;
/** Debounced end-of-day capture, triggered after admin design edits. */
export function scheduleDailyCapture(prisma: any, actorId?: string | null) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; saveSnapshot(prisma, { kind: "AUTO_DAILY", actorId }).catch(e => console.error("Daily snapshot failed:", e?.message || e)); }, 2500);
}

export async function ensureInitialSnapshot(prisma: any) {
  if ((await prisma.siteDesignSnapshot.count()) === 0) await saveSnapshot(prisma, { kind: "INITIAL", label: "First recorded state" });
}
