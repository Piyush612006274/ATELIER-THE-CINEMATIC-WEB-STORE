import { promises as fs } from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";
const EXT = /\.(jpe?g|png|webp|avif)$/i;

async function walk(dir: string, rel: string, out: { url: string; name: string; folder: string }[]) {
  let entries: import("node:fs").Dirent[] = [];
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const abs = path.join(dir, e.name); const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) await walk(abs, r, out);
    else if (EXT.test(e.name)) out.push({ url: "/images/" + r.split("/").map(encodeURIComponent).join("/"), name: e.name, folder: rel || "images" });
  }
}

/** Lists every existing image under public/images so admins can pick one instead of typing paths. */
export async function GET() {
  const out: { url: string; name: string; folder: string }[] = [];
  await walk(path.join(process.cwd(), "public", "images"), "", out);
  out.sort((a, b) => a.folder.localeCompare(b.folder) || a.name.localeCompare(b.name));
  return Response.json({ images: out }, { headers: { "Cache-Control": "no-store" } });
}
