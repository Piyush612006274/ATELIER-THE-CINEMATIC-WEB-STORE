export type SiteCopyEntry = { original: string; text: string; route: string; scope?: string };
export type SiteCopyMap = Record<string, SiteCopyEntry>;
export function siteCopyKey(route: string, text: string, scope = '') {
  let hash = 2166136261;
  for (const char of `${scope}\u0000${text.trim()}`) hash = Math.imul(hash ^ char.codePointAt(0)!, 16777619);
  return `${route}:${(hash >>> 0).toString(36)}`;
}
export function copyReplacement(entries: SiteCopyMap, route: string, original: string, scope = '') {
  const entry = entries[siteCopyKey(route, original, scope)];
  return entry && entry.original === original.trim() && entry.route === route && typeof entry.text === 'string' ? original.replace(original.trim(), entry.text) : original;
}
