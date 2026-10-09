# Sweet House Catalogue — Phone-only deployment

A premium responsive Indian sweet catalogue built with React + TypeScript + Vite, Cloudflare Pages Functions, D1 and R2. Includes product CRUD, secure cookie sessions, Cloudinary/public-image URL option, direct R2 image upload, browser-side WebP compression, upload progress, product WhatsApp links, and installable PWA support.

## Important status
This is the source package. It has **not** been deployed to your Cloudflare account and cannot be honestly described as production-tested until the required account resources, secrets, database and bucket URL are configured and manual checks pass. Cloudflare service free allowances and payment verification can vary by account/region; do not enable paid billing without checking.

## Files
- `src/` — React frontend and admin
- `functions/api/[[path]].ts` — Cloudflare Pages server API
- `schema.sql` — D1 schema
- `public/manifest.webmanifest`, `public/sw.js` — PWA files

## Deploy from a phone
1. Create a GitHub repository. Upload the ZIP contents (the files inside the folder, not the ZIP) to the repository root using GitHub's website.
2. In Cloudflare Dashboard, Workers & Pages → Create → Pages → Connect to Git. Select the repo and branch `main`.
3. Build settings: framework preset **Vite**, build command `npm run build`, output directory `dist`. Save and deploy. Pages Functions are deployed from the root `functions/` folder when Git integration is used.
4. In Cloudflare Dashboard, create a D1 database. Open its Console and run the complete `schema.sql` contents.
5. Create an R2 bucket. Configure public access or a custom domain for image delivery. Use the resulting public HTTPS base URL (not the S3 API endpoint) for `R2_PUBLIC_BASE_URL`.
6. In Pages project → Settings → Bindings, add:
   - D1 database binding variable name: `DB`
   - R2 bucket binding variable name: `IMAGES`
   Save and redeploy.
7. In Pages project → Settings → Variables and Secrets, add secrets for Production (and Preview if needed):
   - `ADMIN_USERNAME`: choose your own username
   - `ADMIN_PASSWORD`: create a unique long password; never put it in GitHub
   - `SESSION_SECRET`: a random secret at least 32 characters
   Add `R2_PUBLIC_BASE_URL`: your public R2 custom-domain/base URL, e.g. `https://images.yourdomain.example` (without a trailing slash). Save and redeploy.
8. Open `https://YOUR-PROJECT.pages.dev/admin`, log in, and add a product.

## Cloudinary option
In Admin → Image link, paste a public HTTPS Cloudinary delivery URL, ideally with Cloudinary transformations such as `f_auto,q_auto,w_1200`. Direct uploads use R2. This choice is per product. External image URLs are not copied to R2.

## PWA install
Open the deployed site over HTTPS on Android Chrome. Use the visible Install app button if offered, or Chrome menu ⋮ → Install app / Add to Home screen. The same installed app includes `/admin`. PWA installation availability varies by browser.

## Security and limits
- Password and signing secret must exist only as Cloudflare server-side secrets.
- This starter compares the configured admin username/password on the server and issues an HMAC-signed, HttpOnly, Secure, SameSite=Strict cookie with an 8-hour expiry. Rotate secrets to revoke sessions. Add Cloudflare WAF/rate limiting rules before a public production launch; this starter does not implement a distributed login rate limiter.
- R2 uploads accept JPEG, PNG, WebP and AVIF up to 10 MB. The browser attempts WebP conversion and downsizes to 1800 px before uploading.
- For direct R2 uploads, the bucket must have public delivery enabled or a custom domain, and `R2_PUBLIC_BASE_URL` must match it. Do not expose R2 API credentials.
- Public product listing returns published products only. Admin create/update/delete and uploads require a valid session.
- Product image files are not automatically deleted from R2 when a product is deleted; periodically clean unused images from the bucket.
- Shop name and WhatsApp number are stored in D1 from Admin → Save shop settings, so customer enquiry buttons work across devices. Enter the WhatsApp number with country code and digits only.
- Starter product detail URLs use `/?product=slug`; this keeps hosting rewrite needs simple.
- No cart, checkout or payments are included.
- Verify the service's current plan limits, account/card requirements and commercial terms in your own dashboard before committing to it.

## Manual launch checklist
- [ ] Open homepage and verify D1 products appear.
- [ ] Log in to `/admin`; try a wrong password and confirm it is rejected.
- [ ] Add a product with a Cloudinary URL, publish it, refresh and confirm persistence.
- [ ] Upload an image and verify progress, preview and public image URL.
- [ ] Edit, unpublish and delete a test product.
- [ ] Test search, category filter, product detail URL and mobile layout.
- [ ] Set the WhatsApp number in Admin, then test product enquiry message on a phone with WhatsApp.
- [ ] Install the PWA on Android Chrome and open the catalogue.
- [ ] Confirm admin secrets are only Cloudflare secrets and not committed to GitHub.
