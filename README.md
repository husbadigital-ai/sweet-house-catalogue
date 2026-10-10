# Sweet House Catalogue — Premium Feature Update

React + Vite + TypeScript frontend with Cloudflare Pages Functions and D1.

## Included in this update
- Premium warm maroon, antique-gold and ivory design.
- Public catalogue search, category filtering, stock-only filter and sorting.
- Product detail view with gallery thumbnails, image zoom, share/call actions and WhatsApp enquiries.
- Product gallery manager: paste multiple HTTPS image URLs, preview, reorder and remove.
- Per-product weight/price rows and product badge flags stored in the existing key/value `settings` table.
- Bestsellers and festival-special sections.
- Gift/bulk WhatsApp enquiry with occasion, quantity and requested date.
- Visit/contact section with address, timings, directions, phone and optional Google Maps embed.
- Admin settings for shop profile, offer banner, hero image, about text, FSSAI and social links.
- PWA manifest, cache-first static assets and offline fallback page.
- Admin login/authentication, product API, D1 binding and existing product rows preserved.

## Database safety
No tables are dropped or recreated. This update uses the existing `products.gallery` JSON column and existing `settings(key,value)` table; no D1 migration is required. Product weights and badges are stored as namespaced settings keys.

## Deploy from Codespaces
Upload the final ZIP to the repository root and commit it. Then use the single command provided with the delivery. It runs `npm ci`, `npm run build`, and pushes the update. Check Cloudflare Pages deployment status afterward.

## Notes
- The shop must fill its real shop details, phone, address, FSSAI number, map URLs and Cloudinary URLs in Admin Settings.
- Weight/price rows should be entered with one per line, e.g. `250g:200`; prices are not prefilled with invented values.
- Enquiry analytics are currently stored on the admin device's local browser, not centrally in D1.
