interface Env { DB: D1Database }
type PageContext = { request: Request; env: Env; next: (request?: Request) => Promise<Response> };
const escapeHtml = (value: unknown) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const imageUrl = (url: string) => url.includes("res.cloudinary.com/") && url.includes("/upload/") ? url.replace("/upload/", "/upload/f_auto,q_auto,w_1200,c_limit/") : url;
export async function onRequest(context: PageContext) {
  const { request, env } = context; const url = new URL(request.url); const match = url.pathname.match(/^\/product\/([^/]+)\/?$/);
  if (!match && !/^\/admin(?:\/.*)?$/.test(url.pathname)) return context.next();
  const shellRequest = new Request(new URL("/index.html", url.origin), { method: "GET", headers: request.headers });
  const shell = await context.next(shellRequest);
  if (!match || !env.DB) { if (url.pathname.startsWith("/admin")) { const headers = new Headers(shell.headers); headers.set("Cache-Control", "no-store, max-age=0"); return new Response(shell.body, { status: shell.status, headers }); } return shell; }
  let slug = ""; try { slug = decodeURIComponent(match[1]); } catch { return shell; }
  try {
    const product = await env.DB.prepare("SELECT name,description,short_description,image_url,price,show_price,unit,available,category FROM products WHERE slug=? AND published=1 LIMIT 1").bind(slug).first() as any;
    if (!product) return shell;
    const shop = await env.DB.prepare("SELECT value FROM settings WHERE key='shopName'").first() as any;
    const shopName = String(shop?.value || "SweetHouse – Indian Sweet Boutique");
    const title = `${product.name} | ${shopName}`; const description = String(product.description || product.short_description || `Enquire about ${product.name} on WhatsApp.`).slice(0, 300); const image = imageUrl(String(product.image_url || ""));
    const html = await shell.text();
    const jsonLd = { "@context": "https://schema.org", "@type": "Product", name: product.name, description, image: image ? [image] : undefined, category: product.category, offers: product.price !== null && Number(product.show_price) ? { "@type": "Offer", price: Number(product.price), priceCurrency: "INR", availability: Number(product.available) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" } : undefined };
    const tags = `<meta property="og:type" content="product"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(url.origin + url.pathname)}">${image ? `<meta property="og:image" content="${escapeHtml(image)}">` : ""}<meta name="twitter:card" content="summary_large_image"><script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>`;
    const updated = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(title)}</title>`).replace(/<meta name="description" content="[^"]*"\s*\/?\s*>/i, `<meta name="description" content="${escapeHtml(description)}">`).replace(/<head>/i, `<head>${tags}`);
    const headers = new Headers(shell.headers); headers.set("Content-Type", "text/html; charset=utf-8"); headers.set("Cache-Control", "no-store, max-age=0"); return new Response(updated, { status: shell.status === 404 ? 200 : shell.status, headers });
  } catch { return shell; }
}
