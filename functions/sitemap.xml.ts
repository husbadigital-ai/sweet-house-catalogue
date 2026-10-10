interface Env { DB: D1Database }
export async function onRequest(context: { request: Request; env: Env }) {
  const origin = new URL(context.request.url).origin;
  const rows = context.env.DB ? await context.env.DB.prepare("SELECT slug,updated_at FROM products WHERE published=1 ORDER BY sort_order ASC").all().catch(() => ({ results: [] as any[] })) : { results: [] as any[] };
  const entries = [`<url><loc>${origin}/</loc></url>`, ...(rows.results || []).map((row: any) => `<url><loc>${origin}/product/${encodeURIComponent(row.slug)}</loc></url>`)].join("");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-store, max-age=0" } });
}
