const base = (process.env.ATELIER_API_BASE || "http://localhost:4000/api").replace(/\/$/, "");

async function get(path) {
  const r = await fetch(`${base}${path}`);
  const text = await r.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  return { r, body };
}

try {
  const health = await get("/health");
  console.log(`HEALTH_HTTP=${health.r.status}`);
  console.log(`HEALTH_OK=${health.body?.ok ? "YES" : "NO"}`);

  const products = await get("/products");
  console.log(`PRODUCTS_HTTP=${products.r.status}`);
  console.log(`PRODUCTS_COUNT=${Array.isArray(products.body) ? products.body.length : 0}`);

  const ai = await get("/ai/status");
  console.log(`AI_STATUS_HTTP=${ai.r.status}`);
  console.log(`GEMINI_CONFIGURED=${ai.body?.chatConfigured ? "YES" : "NO"}`);
  console.log(`GEMINI_MODEL=${ai.body?.chatModel || ""}`);
  console.log(`VTON_CONFIGURED=${ai.body?.tryOnConfigured ? "YES" : "NO"}`);

  if (health.r.ok && products.r.ok && ai.r.ok) process.exit(0);
  process.exit(1);
} catch (e) {
  console.error(`SMOKE_ERROR=${e?.message || e}`);
  process.exit(2);
}
