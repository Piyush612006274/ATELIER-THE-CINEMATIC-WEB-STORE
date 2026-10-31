export function siteThemeVariables(theme: Record<string, any> = {}) {
  const background = String(theme.background || theme.dark || "#080a09");
  const text = String(theme.text || theme.paper || "#f1eee7");
  return {
    "--site-background": background,
    "--site-surface": String(theme.surface || theme.brown || "#101311"),
    "--site-text": text,
    "--site-muted": String(theme.muted || "#a6a69d"),
    "--site-accent": String(theme.accent || "#d7ff55"),
    "--site-header": String(theme.headerBackground || background),
    "--site-footer": String(theme.footerBackground || background),
    "--c-ink": background, "--c-ink-2": String(theme.surface || "#101311"),
    "--c-paper": text, "--c-muted": String(theme.muted || "#a6a69d"),
    "--c-soft": text, "--c-acid": String(theme.accent || "#d7ff55"),
    "--c-serif": String(theme.headingFont || "Georgia, serif"),
    "--c-sans": String(theme.bodyFont || "Arial, sans-serif"),
  };
}

export const designProperties = ["background", "color", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "borderRadius", "borderWidth", "borderColor", "minHeight", "gap", "align", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "opacity", "buttonBackground", "buttonColor"];
export function sectionDesign(style: Record<string, any> = {}) {
  const variables: Record<string, string> = {};
  const properties: string[] = [];
  for (const key of designProperties) {
    const value = style[key];
    if (value == null || value === "" || (key === "fontSize" && !Number(value))) continue;
    properties.push(key);
    variables[`--design-${key}`] = /^(padding|borderRadius|borderWidth|minHeight|gap|fontSize|letterSpacing)/.test(key) ? `${Number(value) || 0}px` : String(value);
  }
  if (style.color) variables["--c-paper"] = String(style.color);
  if (style.background && style.background !== "transparent") variables["--c-ink"] = String(style.background);
  if (style.buttonBackground) variables["--c-acid"] = String(style.buttonBackground);
  return { variables, properties: properties.join(" ") };
}
