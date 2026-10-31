# ITHub website

Plain HTML, CSS, and vanilla JavaScript, deployed with **Cloudflare Workers + Static Assets**. A small Worker handles contact enquiries. No framework, runtime packages, database, or bundler setup is required.

## Cloudflare dashboard setup

Connect the Git repository through the current **Workers** workflow. Set the Worker name to `ithub`, matching `wrangler.jsonc`.

| Dashboard field | Value |
| --- | --- |
| Build command | `node scripts/prepare-deploy.mjs` |
| Deploy command | `npx wrangler deploy` |
| Root directory | Repository root; leave the default value |

There is no Output directory field to fill in. `wrangler.jsonc` declares `assets.directory` as `./dist` and `worker/index.mjs` as the Worker entry point.

The build command only copies public files into `dist/`; it does not compile or transform the HTML, CSS, or JavaScript. Worker code, tests, documentation, and local secrets stay outside the public directory. Do not serve or upload the repository root as static assets.

This project uses Workers directly. Do not choose the legacy Pages workflow or use `wrangler pages` commands.

## Configure direct email delivery

The form uses Resend for delivery and Cloudflare Turnstile for spam protection.

1. In Resend, verify `notify.ithub.com.bd` and wait for the sending DNS records to be verified.
2. Create a Resend API key with sending access to that domain.
3. Create a Managed Turnstile widget and allow `ithub.com.bd`. Also allow the exact `workers.dev` hostname if you will test on the Worker URL. Keep hostname validation enabled.
4. In the Cloudflare **Worker**, go to **Settings → Variables and Secrets** and add the five entries below. They can all be encrypted Secrets. These must be runtime settings; build-only secrets are not available to the deployed contact handler.

| Name | Value |
| --- | --- |
| `RESEND_API_KEY` | Your Resend sending API key |
| `CONTACT_FROM` | `ITHub Website <website@notify.ithub.com.bd>` |
| `CONTACT_TO` | `ithub.com.bd@gmail.com`, or your preferred receiving address |
| `TURNSTILE_SITE_KEY` | Your widget's public site key |
| `TURNSTILE_SECRET_KEY` | Your widget's secret key |

5. Save and deploy the configuration changes. Retry the deployment if you added configuration after its first build.
6. Send a real enquiry from the deployed contact page. Confirm receipt in the destination inbox and check that Reply addresses the visitor.

The public site key is returned by `/api/contact-config`; no API key or secret key is returned to the browser. Without complete configuration, the form shows its email and WhatsApp fallback links and does not attempt delivery. Public deployments reject Cloudflare's dummy test keys.

The sender address uses your verified domain. The visitor's email is set as Reply-To. Sending a notification does not require a mailbox at the sender address, and the receiving mailbox can remain on Gmail.

## Deploy from the command line

Run from the repository root:

```sh
node scripts/prepare-deploy.mjs
npx wrangler deploy
```

The example Worker name is `ithub`; change `wrangler.jsonc` if your Cloudflare Worker has a different name.

Cloudflare serves matching static assets directly. Only `/api/*` is configured to run the Worker before asset lookup. Unknown API paths return JSON 404s. Missing website pages use the custom `404.html`. Directory pages keep their trailing-slash URLs.

Configure `ithub.com.bd` as a Worker custom domain after reviewing the deployment. Canonical URLs, the sitemap, and robots.txt use `https://ithub.com.bd`. `_headers` sets security headers and permits the Turnstile script and iframe. `_redirects` maps the old WordPress service URLs to the new service sections. Both files are supported by Workers Static Assets and included in `dist/`; `.assetsignore` keeps them from being publicly downloadable. Check for additional old URLs before switching the production domain.

## Preview locally

For a full preview using Cloudflare's runtime:

```sh
node scripts/prepare-deploy.mjs
npx wrangler dev --ip 127.0.0.1 --port 8080
```

Open `http://localhost:8080`. To test delivery locally, copy `.dev.vars.example` to `.dev.vars` and add your values there. Local secret files are ignored by Git and excluded from `dist/`. Never paste API keys into HTML or browser JavaScript. No local secret file is provided by default.

Cloudflare's official dummy Turnstile keys can be used on localhost for verification testing. Real email sending still requires a valid Resend key, a verified sender, and a recipient. A local test with real Resend credentials can send an actual email.

For a static-only preview, serve **dist**, not the repository root:

```sh
python3 -m http.server 8080 --bind 127.0.0.1 --directory dist
```

Static-only preview does not run the API. The contact form will show its fallback options. Security headers, redirects, and Cloudflare's 404 handling are not applied by Python's server.

## Checks

```sh
node tests/contact.test.mjs
node tests/worker.test.mjs
node --check assets/contact.js
node --check assets/main.js
node scripts/prepare-deploy.mjs
npx wrangler deploy --dry-run --outdir /tmp/ithub-worker-check
```

The backend tests mock the verification and email services. They send no real email. The dry run compiles and validates the deployment without publishing it. A real delivery check after domain verification and credential setup is still needed.

## Edit the site

- Each page is an ordinary `index.html` in its own directory.
- Shared styles: `assets/styles.css`.
- Navigation, workflow tabs, and product filters: `assets/main.js`.
- A small script in each page's head sets the mobile menu's initial collapsed state before rendering. Its exact SHA-256 hash is permitted in `_headers`; update that hash if you change the head script.
- Direct-send form behaviour: `assets/contact.js`.
- Worker routing: `worker/index.mjs`.
- Contact handlers: `lib/contact-submit.mjs` and `lib/contact-config.mjs`.
- Server-side validation and helpers: `lib/contact.mjs`.
- Optimised images and logo variants: `assets/images/`.
- The primary logo is `ithub-logo.svg`; dark-background and monochrome variants use `-dark` and `-mono`. The compact mark is `ithub-icon.svg`. Transparent PNG exports are included.
- Navigation and footer markup are repeated in the HTML files. Update all pages when changing shared links.
- Update `sitemap.xml` when adding or removing pages, then rerun the public-directory preparation command before deploying.

## Form behaviour

Enquiries are validated on the server, checked with Turnstile, and emailed as plain text. An off-screen field helps identify automated submissions. The form prevents double clicks and uses a stable email idempotency key when retrying the same enquiry. A success message appears only when Resend accepts the email and returns a message ID. Acceptance does not guarantee inbox delivery; DNS, provider limits, and recipient filtering still apply.

Failures preserve the visitor's entries, allow a fresh verification, and show direct email and WhatsApp alternatives. The form sends one notification to the configured recipient and no automatic acknowledgement email. There is no enquiry database. The privacy notice describes the submission and spam-protection services.

## Product availability

CampusControl is labelled **Early access**. Masjid Management and Amar Pirijpur are labelled **In development**. Add public URLs for the latter two when confirmed.

The CampusControl dashboard image comes from its public website and contains demonstration data. Other product artwork is illustrative. This website adds no advertising analytics.
