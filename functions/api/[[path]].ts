interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
  SESSION_SECRET: string;
  R2_PUBLIC_BASE_URL?: string;
}
type Ctx = { request: Request; env: Env; params: Record<string, string>; waitUntil: (promise: Promise<unknown>) => void };
const json = (data: unknown, status = 200, headers: HeadersInit = {}) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff", ...headers } });
const cookieName = "sweet_admin";
function b64(bytes: ArrayBuffer) { return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""); }
async function sign(payload: string, secret: string) { const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return b64(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))); }
async function sessionToken(secret: string) { const payload = b64(new TextEncoder().encode(JSON.stringify({ exp: Date.now() + 8 * 60 * 60 * 1000, nonce: crypto.randomUUID() })).buffer); return `${payload}.${await sign(payload, secret)}`; }
async function isAdmin(request: Request, env: Env) {
  if (!env.SESSION_SECRET) return false;
  const token = (request.headers.get("Cookie") || "").split(";").map(part => part.trim()).find(part => part.startsWith(cookieName + "="))?.slice(cookieName.length + 1);
  if (!token) return false;
  const [payload, signature] = token.split("."); if (!payload || !signature) return false;
  try { if (await sign(payload, env.SESSION_SECRET) !== signature) return false; const raw = atob(payload.replace(/-/g, "+").replace(/_/g, "/")); return JSON.parse(raw).exp > Date.now(); } catch { return false; }
}
const authCookie = (token: string) => `${cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`;
const safeSlug = (value: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 120;
const productFields = "id,name,name_hi,slug,category,short_description,description,description_hi,price,show_price,unit,ingredients,shelf_life,contains_nuts,weights_json,badge,sort_order,enquiry_count,image_url,gallery,available,featured,published,created_at";
function validProduct(product: any) {
  if (!product || typeof product.name !== "string" || !product.name.trim() || product.name.length > 100 || typeof product.slug !== "string" || !safeSlug(product.slug) || typeof product.category !== "string" || !product.category.trim() || product.category.length > 80) return false;
  if (typeof product.image_url !== "string" || product.image_url.length > 2048 || !Array.isArray(product.gallery) || product.gallery.length > 12 || !product.gallery.every((item: unknown) => typeof item === "string" && item.length <= 2048)) return false;
  if (![0, 1].includes(Number(product.show_price)) || ![0, 1].includes(Number(product.available)) || ![0, 1].includes(Number(product.featured)) || ![0, 1].includes(Number(product.published)) || ![0, 1].includes(Number(product.contains_nuts || 0))) return false;
  if (product.price !== null && product.price !== "" && (!Number.isFinite(Number(product.price)) || Number(product.price) < 0 || Number(product.price) >= 100000000)) return false;
  try { const weights = typeof product.weights_json === "string" ? JSON.parse(product.weights_json || "[]") : product.weights_json; if (!Array.isArray(weights) || weights.length > 20 || !weights.every((weight: any) => weight && typeof weight.label === "string" && (weight.price === null || Number.isFinite(Number(weight.price)))) ) return false; } catch { return false; }
  return true;
}
function parseProduct(row: any) { let gallery: string[] = []; try { gallery = JSON.parse(row.gallery || "[]"); } catch {} let weights: unknown[] = []; try { weights = JSON.parse(row.weights_json || "[]"); } catch {} return { ...row, gallery, weights_json: JSON.stringify(weights) }; }
export async function onRequest(ctx: Ctx) {
  const { request, env } = ctx; const url = new URL(request.url); const path = url.pathname.replace(/^\/api\/?/, "").replace(/\/$/, ""); const method = request.method;
  if (!env.DB) return json({ error: "D1 database binding DB is not configured." }, 503);
  if (path === "login" && method === "POST") {
    const body = await request.json().catch(() => null) as any;
    if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD || !env.SESSION_SECRET) return json({ error: "Admin secrets are not configured in Cloudflare Pages settings." }, 503);
    if (!body || typeof body.username !== "string" || typeof body.password !== "string" || body.username !== env.ADMIN_USERNAME || body.password !== env.ADMIN_PASSWORD) return json({ error: "Incorrect username or password." }, 401);
    return json({ ok: true }, 200, { "Set-Cookie": authCookie(await sessionToken(env.SESSION_SECRET)) });
  }
  if (path === "logout" && method === "POST") return json({ ok: true }, 200, { "Set-Cookie": `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0` });
  if (path === "me" && method === "GET") return json({ authenticated: await isAdmin(request, env) });
  if (path === "settings" && method === "GET") {
    const rows = await env.DB.prepare("SELECT key,value FROM settings").all(); const settings = Object.fromEntries((rows.results || []).map((row: any) => [row.key, row.value]));
    return json({ settings: { ...settings, whatsapp: settings.whatsapp || "", shopName: settings.shopName || "SweetHouse – Indian Sweet Boutique", categories: settings.categories || "Traditional Mithai\nKaju Sweets\nMilk Sweets\nDry Fruit Sweets\nGift Boxes", festivalEnabled: settings.festivalEnabled ?? settings.offerEnabled ?? "0", festivalNotice: settings.festivalNotice ?? settings.offerText ?? "Festival orders are open" } });
  }
  if (path === "settings" && (method === "PUT" || method === "POST")) {
    if (!await isAdmin(request, env)) return json({ error: "Admin access is required." }, 401);
    const body = await request.json().catch(() => null) as any; if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Settings payload must be an object." }, 400);
    const allowed = ["whatsapp", "shopName", "tagline", "phone", "address", "mapsUrl", "mapsEmbed", "timings", "fssai", "instagram", "facebook", "offerText", "offerEnabled", "heroImage", "aboutText", "categories", "reviews", "bulkMessage", "logoUrl", "headline", "subline", "festivalNotice", "festivalEnabled", "productWhatsAppTemplate", "productWhatsAppTemplateHi", "generalWhatsAppTemplate", "generalWhatsAppTemplateHi", "showSearch", "trackEnquiries", "footerText", "themeAccent", "trustOne", "trustTwo", "trustThree", "hiddenCategories"];
    const incoming: Record<string, string> = {};
    for (const key of allowed) if (body[key] !== undefined) incoming[key] = String(body[key] ?? "").slice(0, ["aboutText", "categories", "reviews", "productWhatsAppTemplate", "productWhatsAppTemplateHi", "generalWhatsAppTemplate", "generalWhatsAppTemplateHi"].includes(key) ? 5000 : 2048);
    for (const [key, value] of Object.entries(body)) if (/^(weights|flags)_[a-z0-9-]{1,120}$/.test(key)) incoming[key] = String(value ?? "").slice(0, 2000);
    const whatsapp = String(incoming.whatsapp ?? "").replace(/[^0-9]/g, "").slice(0, 16); if (whatsapp.length && (whatsapp.length < 8 || whatsapp.length > 15)) return json({ error: "Enter a WhatsApp number with country code, digits only." }, 400);
    incoming.whatsapp = whatsapp; incoming.shopName = String(incoming.shopName ?? "SweetHouse – Indian Sweet Boutique").trim().slice(0, 100) || "SweetHouse – Indian Sweet Boutique";
    for (const [key, value] of Object.entries(incoming)) await env.DB.prepare("INSERT INTO settings(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP").bind(key, value).run();
    const rows = await env.DB.prepare("SELECT key,value FROM settings").all(); return json({ ok: true, settings: Object.fromEntries((rows.results || []).map((row: any) => [row.key, row.value])) });
  }
  if (path === "products" && method === "GET") {
    const admin = url.searchParams.get("admin") === "1"; if (admin && !await isAdmin(request, env)) return json({ error: "Admin access is required." }, 401);
    const result = admin ? await env.DB.prepare(`SELECT ${productFields} FROM products ORDER BY sort_order ASC, created_at DESC`).all() : await env.DB.prepare(`SELECT ${productFields} FROM products WHERE published=1 ORDER BY sort_order ASC, featured DESC, created_at DESC`).all();
    return json({ products: (result.results || []).map(parseProduct) }, 200, { "Cache-Control": "no-store, max-age=0" });
  }
  if (path === "products" && method === "POST") {
    if (!await isAdmin(request, env)) return json({ error: "Admin access is required." }, 401);
    const product = await request.json().catch(() => null) as any; if (!validProduct(product)) return json({ error: "Check required fields, URL slug, price, weights and image links." }, 400);
    try {
      const result = await env.DB.prepare("INSERT INTO products (name,name_hi,slug,category,short_description,description,description_hi,price,show_price,unit,ingredients,shelf_life,contains_nuts,weights_json,badge,sort_order,image_url,gallery,available,featured,published) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(product.name.trim(), String(product.name_hi || "").slice(0, 100), product.slug, product.category.trim(), String(product.short_description || "").slice(0, 180), String(product.description || "").slice(0, 5000), String(product.description_hi || "").slice(0, 5000), product.price === "" ? null : product.price, Number(product.show_price), String(product.unit || "per kg").slice(0, 40), String(product.ingredients || "").slice(0, 1000), String(product.shelf_life || "").slice(0, 200), Number(product.contains_nuts || 0), typeof product.weights_json === "string" ? product.weights_json : JSON.stringify(product.weights_json || []), String(product.badge || "").slice(0, 40), Number(product.sort_order || 0), product.image_url, JSON.stringify(product.gallery), Number(product.available), Number(product.featured), Number(product.published)).run();
      return json({ product: { ...product, id: result.meta.last_row_id, enquiry_count: 0 } }, 201);
    } catch (error) { return json({ error: String(error).includes("UNIQUE") ? "That URL slug is already used. Change the slug." : "Could not save product. Confirm the D1 migration was run." }, 400); }
  }
  const productMatch = path.match(/^products\/(\d+)$/);
  if (productMatch) {
    if (!await isAdmin(request, env)) return json({ error: "Admin access is required." }, 401); const id = Number(productMatch[1]);
    if (method === "DELETE") { await env.DB.prepare("DELETE FROM products WHERE id=?").bind(id).run(); return json({ ok: true }); }
    if (method === "PUT") {
      const product = await request.json().catch(() => null) as any; if (!validProduct(product)) return json({ error: "Check required fields, URL slug, price, weights and image links." }, 400);
      try {
        await env.DB.prepare("UPDATE products SET name=?,name_hi=?,slug=?,category=?,short_description=?,description=?,description_hi=?,price=?,show_price=?,unit=?,ingredients=?,shelf_life=?,contains_nuts=?,weights_json=?,badge=?,sort_order=?,image_url=?,gallery=?,available=?,featured=?,published=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
          .bind(product.name.trim(), String(product.name_hi || "").slice(0, 100), product.slug, product.category.trim(), String(product.short_description || "").slice(0, 180), String(product.description || "").slice(0, 5000), String(product.description_hi || "").slice(0, 5000), product.price === "" ? null : product.price, Number(product.show_price), String(product.unit || "per kg").slice(0, 40), String(product.ingredients || "").slice(0, 1000), String(product.shelf_life || "").slice(0, 200), Number(product.contains_nuts || 0), typeof product.weights_json === "string" ? product.weights_json : JSON.stringify(product.weights_json || []), String(product.badge || "").slice(0, 40), Number(product.sort_order || 0), product.image_url, JSON.stringify(product.gallery), Number(product.available), Number(product.featured), Number(product.published), id).run();
        return json({ product: { ...product, id } });
      } catch { return json({ error: "Could not update product. Check the migration and unique slug." }, 400); }
    }
  }
  const enquiryMatch = path.match(/^enquiry\/(\d+)$/);
  if (enquiryMatch && method === "POST") {
    const id = Number(enquiryMatch[1]); const settingsRows = await env.DB.prepare("SELECT value FROM settings WHERE key='trackEnquiries'").first() as any;
    if (settingsRows?.value === "0") return json({ ok: true, tracked: false });
    await env.DB.prepare("UPDATE products SET enquiry_count=enquiry_count+1 WHERE id=? AND published=1").bind(id).run(); return json({ ok: true, tracked: true });
  }
  if (path === "insights" && method === "GET") {
    if (!await isAdmin(request, env)) return json({ error: "Admin access is required." }, 401);
    const result = await env.DB.prepare("SELECT id,name,enquiry_count FROM products ORDER BY enquiry_count DESC, name ASC LIMIT 100").all(); const total = await env.DB.prepare("SELECT COALESCE(SUM(enquiry_count),0) AS total FROM products").first() as any;
    return json({ products: result.results || [], totalClicks: Number(total?.total || 0) });
  }
  if (path === "upload" && method === "POST") {
    if (!await isAdmin(request, env)) return json({ error: "Admin access is required." }, 401);
    if (!env.IMAGES) return json({ error: "R2 binding IMAGES is not configured." }, 503);
    const form = await request.formData().catch(() => null); const file = form?.get("file"); if (!(file instanceof File)) return json({ error: "Choose an image file." }, 400);
    if (file.size > 10 * 1024 * 1024) return json({ error: "Image must be 10 MB or smaller." }, 413);
    const types: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" }; if (!types[file.type]) return json({ error: "Use JPG, PNG, WebP or AVIF." }, 415);
    const key = `products/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${types[file.type]}`; await env.IMAGES.put(key, file.stream(), { httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" } });
    if (!env.R2_PUBLIC_BASE_URL) return json({ error: "Upload stored, but R2_PUBLIC_BASE_URL is missing. Configure the bucket's public/custom domain URL." }, 503);
    return json({ url: `${env.R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}` }, 201);
  }
  return json({ error: "API route not found." }, 404);
}
