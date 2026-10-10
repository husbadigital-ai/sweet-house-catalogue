# SweetHouse – Indian Sweet Boutique

Mobile-first catalogue website and phone-first admin PWA. The existing React + Vite frontend, Cloudflare Pages Functions API, D1 database, session-cookie login, and current image storage binding are retained. This is an incremental update, not a new backend.

## Important: existing D1 database

**Do not run `schema.sql` on the live database.** Before deploying the updated API, run `migration_001_catalogue_enhancements.sql` exactly once in Cloudflare Dashboard → D1 → `sweet-house-db` → Console. The migration is additive: it adds product fields, indexes and default settings; it does not drop tables or delete existing products. It also carries old `weights_<slug>` and `flags_<slug>` settings into the new product fields.

If Cloudflare's D1 console reports an error, stop and resolve it before pushing the application code. Do not rerun a migration that already completed because SQLite `ALTER TABLE ADD COLUMN` operations are intentionally one-time.

## Deploy from Codespaces (phone-friendly)

1. Upload this ZIP to the GitHub repository root and commit the ZIP file.
2. In Codespaces terminal, extract it without pushing the new code yet:

```bash
git pull --ff-only && unzip -o sweethouse-catalogue-mobile-upgrade.zip -d . && rm -f sweethouse-catalogue-mobile-upgrade.zip
```

3. Open `migration_001_catalogue_enhancements.sql` in the Codespaces file explorer, copy its complete contents, paste them into Cloudflare Dashboard → D1 → `sweet-house-db` → Console, and run them once. Wait for success before deploying the matching API.
4. Back in Codespaces terminal, run the build and push:

```bash
npm ci && npm run build && git add -A && git commit -m "Upgrade SweetHouse catalogue and admin PWA" && git push
```

Cloudflare Pages should deploy from the GitHub push. Confirm the GitHub Actions build is green and the Cloudflare Pages deployment is successful before checking the live site.

## Required Cloudflare bindings and secrets

- D1 binding `DB` → existing `sweet-house-db` database.
- R2 binding `IMAGES` → existing image bucket, only if using the existing upload control.
- Secret `ADMIN_USERNAME`.
- Secret `ADMIN_PASSWORD`.
- Secret `SESSION_SECRET` (use a long random secret; never put it in frontend code or GitHub source).
- Optional variable `R2_PUBLIC_BASE_URL` for the existing R2 upload route.

No new payment, customer account, or checkout secret is required. WhatsApp number and templates are edited in Admin → Settings.

## What's included

- Maroon / saffron / cream design system, mobile-first product grid and responsive admin bottom navigation.
- `/product/:slug` details route with gallery, swipe navigation, zoom, weights, ingredient/shelf-life notes, share, sticky WhatsApp enquiry bar, SEO metadata and server-rendered Open Graph tags.
- English/Hindi toggle; product Hindi name/description fall back to English when blank.
- Editable homepage, notice, trust strip, categories, contact/map/timings, footer and WhatsApp templates.
- Product search only when enabled or when the catalogue has more than 40 products; no public sort or stock-only filters.
- Admin product CRUD, image URL paste/preview/reorder, upload via existing R2 binding, stock toggle, quick price edit, duplicate, up/down ordering, category guard, D1 enquiry counters and insights.
- PWA manifests for the public catalogue and admin route, offline shell, API `no-store` behaviour, dynamic product sitemap and robots.txt.

## Validation checklist

- Open at 360px, 390px, tablet and desktop widths; ensure no horizontal overflow.
- Visit `/admin` directly and confirm the existing username/password still works.
- Edit a product and check EN/HI names, multiple images, image ordering, price/weight options, sold-out state, badges and publish toggle.
- Open `/product/<slug>` directly; test image swipe/zoom, share, weight price changes and WhatsApp message contents.
- Test products with no price, no Hindi copy, no gallery, and out-of-stock status.
- Verify the WhatsApp URL contains the configured number and encoded message.
- Save Settings and confirm the public page reflects changes without a redeploy.
- Check `/sitemap.xml`, `/robots.txt`, offline fallback and the install prompt on a supported browser.
- Confirm product enquiry counts increase in Admin → Insights.

## Database schema files

- `schema.sql` is for a fresh database only.
- `migration_001_catalogue_enhancements.sql` is for the existing live database.
