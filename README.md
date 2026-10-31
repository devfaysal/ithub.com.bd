# ITHub website

Plain HTML, CSS, and vanilla JavaScript, with a Cloudflare Pages Function for contact enquiries. No framework, runtime packages, database, or bundler is required.

## Prepare the public directory

```sh
node scripts/prepare-deploy.mjs
```

This copies only public website files into `dist/`. It does not compile or transform the website. Functions, tests, documentation, and local secrets stay outside the public directory. Do not deploy or serve the repository root when using local secrets.

## Configure direct email delivery

The form uses Resend for delivery and Cloudflare Turnstile for spam protection.

1. In Resend, verify the sending domain or subdomain and add its required DNS records. `notify.ithub.com.bd` is a suggested sending subdomain; use the domain you actually verify.
2. Create a Resend API key with sending access to that domain.
3. Create a Turnstile widget and allow your production website hostname. Add the exact Pages preview hostname too if you intend to test there. Keep hostname validation enabled.
4. In the Cloudflare Pages project, go to **Settings → Variables and Secrets → Add** and add the following five entries. They can all be encrypted Secrets, keeping the configuration out of the source repository. Configure Production and Preview separately as needed.

| Name | Value |
| --- | --- |
| `RESEND_API_KEY` | Your Resend sending API key |
| `CONTACT_FROM` | For example, `ITHub Website <website@notify.ithub.com.bd>`; the domain must be verified in Resend |
| `CONTACT_TO` | `ithub.com.bd@gmail.com`, or your preferred receiving address |
| `TURNSTILE_SITE_KEY` | Your widget's public site key |
| `TURNSTILE_SECRET_KEY` | Your widget's secret key |

5. Redeploy after adding or changing configuration.
6. Once DNS is verified, send a real enquiry from the deployed contact page. Check receipt in the destination inbox and check that Reply addresses the visitor.

The public site key is returned by `/api/contact-config`; no API key or secret key is returned to the browser. Without complete configuration, the form shows its email and WhatsApp fallback links and does not attempt delivery. Public deployments reject Cloudflare's dummy test keys.

The sender address uses your verified domain. The visitor's email is set as Reply-To. Sending a notification does not require a mailbox at the sender address, and the receiving mailbox can remain on Gmail.

## Deploy to Cloudflare Pages

Use **Git integration** or **Wrangler**. Dashboard drag-and-drop uploads do not deploy Pages Functions.

For Git integration:

- Framework preset: **None**
- Build command: `node scripts/prepare-deploy.mjs`
- Build output directory: `dist`
- Project root: this repository

For a CLI deployment, run from the repository root:

```sh
node scripts/prepare-deploy.mjs
npx wrangler@4 pages deploy dist --project-name ithub
```

The example project name is `ithub`; change `wrangler.jsonc` and the CLI argument if your Cloudflare Pages project has a different name. The `functions/` directory remains at the repository root and is bundled by Cloudflare separately from `dist/`.

`_routes.json` limits Function invocations to `/api/contact` and `/api/contact-config`. The website's HTML, CSS, JavaScript, and images continue to be served as static assets.

Configure `ithub.com.bd` as the custom domain after reviewing the Pages preview. Canonical URLs, the sitemap, and robots.txt use `https://ithub.com.bd`. `_headers` configures security headers and permits the Turnstile script and iframe. `_redirects` maps the old WordPress service URLs to the new service sections. Check for additional old URLs before switching the production domain.

## Preview locally

For a full preview using Cloudflare's runtime:

```sh
node scripts/prepare-deploy.mjs
npx wrangler@4 pages dev dist --ip 127.0.0.1 --port 8080
```

Open `http://localhost:8080`. To test delivery locally, copy `.dev.vars.example` to `.dev.vars` and add your values there. Local secret files are ignored by Git and excluded from `dist/`. Never paste API keys into HTML or browser JavaScript. No local secret file is provided by default.

Cloudflare's official dummy Turnstile keys can be used on localhost for verification testing. Real email sending still requires a valid Resend key, a verified sender, and a recipient. Any local test with real Resend credentials can send an actual email.

For a static-only preview, serve **dist**, not the repository root:

```sh
python3 -m http.server 8080 --bind 127.0.0.1 --directory dist
```

Static-only preview does not run the API. The contact form will show its fallback options. `_headers`, `_redirects`, and Cloudflare's 404 handling are not applied by Python's server.

## Checks

```sh
node tests/contact.test.mjs
node --check assets/contact.js
node --check assets/main.js
npx wrangler@4 pages functions build --outdir /tmp/ithub-functions-check
```

The backend tests mock the verification and email services. They send no real email. A real delivery check after domain verification is still needed.

## Edit the site

- Each page is an ordinary `index.html` in its own directory.
- Shared styles: `assets/styles.css`.
- Navigation, workflow tabs, and product filters: `assets/main.js`.
- Direct-send form behaviour: `assets/contact.js`.
- Contact endpoints: `functions/api/contact.js` and `functions/api/contact-config.js`.
- Server-side validation and helpers: `lib/contact.mjs`.
- Optimised images and logo variants: `assets/images/`.
- The primary logo is `ithub-logo.svg`; dark-background and monochrome variants use `-dark` and `-mono`. The compact mark is `ithub-icon.svg`. Transparent PNG exports are included. The previous logo remains in `ithub-logo.webp`.
- Navigation and footer markup are repeated in the HTML files. Update all pages when changing shared links.
- Update `sitemap.xml` when adding or removing pages, then rerun the public-directory preparation command before deploying.

## Form behaviour

Enquiries are validated on the server, checked with Turnstile, and emailed as plain text. An off-screen field helps identify automated submissions. The form prevents double clicks and uses a stable email idempotency key when retrying the same enquiry. A success message appears only when Resend accepts the email and returns a message ID. Acceptance does not guarantee inbox delivery; DNS, provider limits, and recipient filtering still apply.

Failures preserve the visitor's entries, allow a fresh verification, and show direct email and WhatsApp alternatives. The form sends one notification to the configured recipient and no automatic acknowledgement email. There is no enquiry database. The privacy notice describes the submission and spam-protection services.

## Product availability

CampusControl is labelled **Early access**. Masjid Management and Amar Pirijpur are labelled **In development**. Add public URLs for the latter two when confirmed.

The CampusControl dashboard image comes from its public website and contains demonstration data. Other product artwork is illustrative. This website adds no advertising analytics.
