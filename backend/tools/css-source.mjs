import fs from "node:fs";
import path from "node:path";

/** Read imported global CSS in cascade order so source audits inspect the styles the app actually loads. */
export function loadGlobalCssParts(root) {
  const entryPath = path.join(root, "frontend/app/globals.css");
  const entry = fs.readFileSync(entryPath, "utf8");
  const imports = [...entry.matchAll(/@import\s+["\']\.\/([^"\']+)["\']\s*;/g)].map((m) => m[1]);
  if (!imports.length) return [entry];
  return imports.map((name) => fs.readFileSync(path.join(path.dirname(entryPath), name), "utf8"));
}
