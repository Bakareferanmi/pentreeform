# Deploy Pentreeform

The repository contains the implementation, not access to your Cloudflare, email, or payment accounts. Never commit API keys. Do not paste keys into chat; configure them with Wrangler or the provider dashboard.

## 1. Get the code

```sh
git clone https://github.com/Bakareferanmi/pentreeform.git
cd pentreeform
npm ci
npx wrangler login
npx wrangler d1 create pentreeform
```

Copy the returned database ID into `wrangler.jsonc` under `d1_databases`. Keep binding `DB`. The ID itself is not a password.

## 2. Configure application and email

In `wrangler.jsonc`:

- `APP_ORIGIN`: your exact public origin, for example `https://pentreeform.YOUR-SUBDOMAIN.workers.dev`, with no trailing slash. A custom domain can be added later.
- `EMAIL_FROM`: an address on a domain you own and have verified with Resend, e.g. `Pentreeform <notifications@yourdomain.com>`.
- Leave `REGISTRATION_OPEN` as `false` until configuration is complete.

In Resend, add the sending domain and publish its required DNS records. Keep your existing mailbox's MX records unless the provider explicitly requires a change for a separate subdomain. Confirm the sending domain verifies.

```sh
npx wrangler secret put RESEND_API_KEY
```

Configure a Resend webhook at `https://YOUR-APP/api/webhooks/resend`. Subscribe to `email.sent`, `email.delivered`, `email.bounced`, `email.complained`, and `email.failed`. Store its signing secret:

```sh
npx wrangler secret put RESEND_WEBHOOK_SECRET
```

The webhook uses signed payloads and a five-minute timestamp tolerance. Events are stored independently so callbacks arriving before the send response can still be reconciled.

## 3. Configure Turnstile

Create one Cloudflare Turnstile widget for the Pentreeform application hostname.
Set `TURNSTILE_SITE_KEY` in `wrangler.jsonc` and keep the secret key in Worker secrets.
Customer websites do not need a Cloudflare account, site key, or hostname entry.
New forms use a verification page hosted on the application's own origin.

Authentication uses action `auth`. Submission verification uses action `submission`
and binds Cloudflare's `cdata` to a random, expiring verification ticket. Tokens
are verified server-side against the application hostname. Existing customers who
already installed their own direct widget remain supported with their original
hostname validation.

Apply migration `0004_hosted_verification.sql` **before deploying this Worker**.
It adds an expiring queue for messages awaiting verification. Pending fields use
AES-GCM with a domain-separated key derived from the existing Turnstile secret.
No new credential is needed. Rotating that secret invalidates pending tickets.
Pending fields expire after ten minutes, are cleaned by the scheduled job, and
are erased immediately after successful verification. They never enter the inbox,
consume a submission allowance or queue an email until verification succeeds.

Normal HTML forms only need `action`, `method="POST"`, and named fields. They
redirect to Pentreeform for the brief verification and then show confirmation.
JSON clients must handle HTTP 202 with `verification_required: true`; that is not
a saved message. Open `verification_url`, or embed it with `?mode=embed`. An embed
posts `{type: 'pentreeform:verified', ticket, id}` only after the message is saved.
Check the event origin against the endpoint origin, the event source against the
iframe window, and the ticket against the URL. A closing window or timeout is not
success. Root and `www` versions of the registered website are both accepted;
unrelated subdomains, non-HTTPS origins and arbitrary redirects remain blocked.

## 4. Create the schema and deploy

```sh
npm test
npm run db:remote
npm run deploy
```

The single Worker serves the React frontend and `/api/*` and `/f/*`. The scheduled handler runs every minute to drain mail and clean expired records. This is not a static Pages-only deployment.

For local development, copy `.dev.vars.example` to `.dev.vars`, fill test credentials, use the exact local `APP_ORIGIN`, apply `npm run db:local`, and run `npm run dev:full`. The local site can display authentication, but a real Turnstile challenge must be configured to work for its hostname. Use provider test settings, not production payments.

## 5. Open registration for a controlled smoke test

Set `REGISTRATION_OPEN` to `true` and redeploy only once email, Turnstile, and database configuration are ready. You can keep this closed while finishing billing. The config endpoint reports whether the required registration settings exist; it cannot prove DNS verification or deliverability.

Test with an address you control:

1. Register, open the email verification link, sign in, then sign out and sign in again.
2. Create a form for your test site's exact HTTPS hostname. Test naked/www variants; both are accepted for the registered website.
3. Add the form endpoint to that website. No customer-side widget or security keys are required. Submit a message with a unique identifier.
4. Confirm the stored message and custom fields appear in the inbox before relying on email. Confirm the email arrives. Reply should target the submitter.
5. Confirm the signed delivery event changes `accepted` to `delivered`. Check spam/junk and the provider logs if the message is missing.
6. Confirm a second account cannot read, modify, delete, or export the first account's messages.
7. Test a bad origin, invalid security token, replayed idempotency key, Free form limit, and quota boundary on test accounts.
8. Test archive, message deletion, password reset, and session expiry.
9. Check laptop and phone layouts in real browsers. Run the included browser test suite when Chromium is available.

If a test fails, close registration again while fixing it.

## 6. Configure recurring payments

The adapter is Paystack. It is not connected to your merchant account. **Confirm your merchant can collect recurring USD payments first.** This capability is account-dependent. If unavailable, use another supported merchant/provider or agree separate local prices before enabling checkout.

Create monthly USD plans with these exact amounts in the provider's smallest currency units:

| Environment variable | USD/month | Amount |
| --- | --- | --- |
| `PAYSTACK_PLAN_STARTER` | 3 | 300 |
| `PAYSTACK_PLAN_PRO` | 7 | 700 |
| `PAYSTACK_PLAN_AGENCY` | 15 | 1500 |

Set each variable to its corresponding `PLN_...` code using `wrangler secret put VARIABLE_NAME`. Store `PAYSTACK_SECRET_KEY` the same way. Start with test-mode keys and plans.

Webhook URL: `https://YOUR-APP/api/webhooks/paystack`.

The server verifies the raw HMAC SHA-512 signature, then verifies successful transactions with Paystack. Client-side redirects alone never grant access. Amount, currency, customer email, and plan are checked against server configuration. Initial checkout references are generated and recorded server-side. Duplicate payment references cannot extend access twice.

Subscription lifecycle events fetch current provider state. Only verified payments extend the paid period. Cancellation does not remove already-paid access; it expires at period end. Customers manage their existing subscription with the dashboard button. Plan switching is intentionally restricted while a subscription is active; upgrades/proration are not implemented.

Test successful, failed, pending, duplicate, renewal, cancellation, and late/out-of-order callbacks before using live keys. Make a controlled real payment and verify cancellation on the actual merchant account before inviting paying customers.

## Google sign-in and sign-up

Both account screens include **Continue with Google**. They use a server-side authorization-code flow with PKCE, a browser-bound state cookie, a single-use database state record, a nonce, and signed ID-token validation using Google's public keys. Only `openid email profile` is requested. Provider access and refresh tokens are not stored.

1. In Google Cloud / Google Auth Platform, configure the consent screen and create an OAuth client of type **Web application**. Use test users while the consent screen is in testing mode.
2. Add the exact authorized redirect URI: `https://YOUR-APP/api/auth/google/callback`. For local testing, add `http://localhost:8787/api/auth/google/callback` separately. The configured `APP_ORIGIN` must match that deployment.
3. Store credentials as Worker secrets:

```sh
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npm run db:remote
npm run deploy
```

`0002_google_auth.sql` creates the identity and short-lived flow tables. Apply it before using Google login. Local copies of the credentials belong in `.dev.vars`, never committed source.

The Google button appears on sign-in and signup once both credentials are configured. Google signup also respects `REGISTRATION_OPEN`; Google login remains available to existing Google users when new registrations are closed.

Gmail and Google Workspace identities with verified email can activate immediately. Other Google email addresses still receive Pentreeform's local verification email before accepting form notifications; configure Resend for those accounts.

An existing password account can use Google after one password confirmation. Apply `0005_google_account_linking.sql` before deploying this flow. After Google verifies the identity, a ten-minute, browser-bound request asks for the existing password. Confirmation connects Google to the same user ID, preserving its password, forms, messages, billing and verification state. Future logins can use either method. Requests expire, are single-use and rate-limited; password resets invalidate pending connections. Matching email text alone never links an account. An existing Google identity whose email changes is directed to support rather than silently changing notification recipients.

Test new signup, returning login, cancelled consent, stale state, same-email password accounts, and logout on the deployed domain. Automated tests use signed fixture tokens and mocked Google endpoints; actual consent and Google Cloud configuration still need a live smoke test.

## 7. Operational checks

- Confirm the scheduled handler is enabled and inspect errors in Cloudflare. An empty mail queue after a successful send is not proof of inbox placement.
- Inspect failed mail jobs without exposing message payloads or credentials. Outbox errors show generic provider status, not API keys.
- Check the Resend dashboard for rejected senders, bounces, complaints, suppressed recipients, quotas, and missing callbacks.
- Accepted messages are not re-sent simply because a webhook is delayed. Diagnose them in provider logs.
- D1 retention runs in bounded batches. Review privacy promises and current-plan retention before launch.
- Cloudflare backup availability depends on account settings. Export a database backup with `npx wrangler d1 export pentreeform --remote --output backup.sql`, store it securely, and rehearse restoration into a separate test database. Backups contain personal data and password hashes.
- Configure usage/spend notifications in provider dashboards and monitor database, email, and Worker quotas. Account usage alerts at 80% and 95% are queued automatically after accepted submissions. Apply migration `0003_usage_alerts.sql` before deploying this version of the Worker. Alerts use the verified account email, share the durable outbox and suppression rules, and are sent once per account, UTC month, allowance and threshold. Upgrading to a larger allowance enables new alerts for that allowance; a rollout that first sees an account above 95% sends only the 95% alert. Queued warnings are cancelled if a new month, a different allowance, or a later threshold makes them stale. Claim records survive email-job cleanup and are pruned after three months. Dashboard warnings use the account total and clear after a refreshed month reset or a sufficient upgrade.
- Publish your privacy policy, terms, retention rules, support contact, and refund policy. This repository's data information panel is not a legal policy.
- The owner administration dashboard is described below. A tested support/data-deletion process is still needed before a broader launch.

## Reference documentation

- https://developers.cloudflare.com/workers/static-assets/binding/
- https://developers.cloudflare.com/d1/worker-api/d1-database/#batch
- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- https://resend.com/docs/dashboard/webhooks/introduction
- https://resend.com/docs/dashboard/emails/idempotency-keys
- https://paystack.com/docs/payments/webhooks/
- https://paystack.com/docs/payments/subscriptions/
- https://paystack.com/docs/payments/verify-payments/
- https://paystack.com/docs/api/subscription/

## Keep the current Vercel frontend

When the frontend stays on `https://pentreeform.vercel.app`, keep that exact value as `APP_ORIGIN` in the Worker. After creating the D1 database and deploying the Worker, wire Vercel’s `/api/*` and `/f/*` paths to its actual HTTPS origin. Sessions, Google callbacks and email links then continue to use the public Vercel hostname.

```sh
npm run setup:deployment -- --public-origin https://pentreeform.vercel.app --worker-origin https://YOUR-WORKER.workers.dev --database-id YOUR-D1-UUID
```

This first command validates the values and prints a review without changing files. Add `--write` to save `wrangler.jsonc` and `vercel.json`. It preserves registration settings and does not accept or write API keys. Apply all D1 migrations and redeploy the Worker and frontend after saving the real values. External API and form responses must not be cached.

```sh
npm run check:deployment -- https://pentreeform.vercel.app
```

The checker verifies JSON responses from `/api/health` and `/api/config`, and a protected unauthenticated `/api/auth/me`. It rejects a static HTML response even when its HTTP status is 200. Health reports database/schema readiness and configuration flags; it cannot prove email delivery, Google account approval or successful payments.

## Automatic welcome email

Apply migrations `0006_welcome_email.sql` and `0007_existing_account_welcome.sql` before deploying this Worker. Email/password accounts receive one welcome email after email verification; new Google accounts receive it when verified by Google or after local verification. The message includes a first-name greeting, the Pentreeform logo, a three-step setup checklist, and links to the workspace and Support. Both HTML and plain-text versions use the existing Resend sender.

The welcome claim is committed with account activation. A one-time migration includes existing accounts with no welcome job; repeat sign-ins do not resend it, and deleting old outbox entries cannot create another welcome. Sending uses the existing durable outbox, retry rules, provider idempotency key, bounce suppression, and signed delivery events. A welcome is cancelled if its recipient is no longer the verified account email.

This is a one-time account onboarding message. It does not subscribe users to a marketing campaign. The scheduled Worker queues up to five eligible existing verified accounts per minute without requiring sign-in. Existing unverified accounts receive their email after verification. Any account with an existing welcome job is skipped, including queued, accepted, failed, bounced and suppressed jobs; backfill eligibility is cleared atomically with the welcome claim and remains cleared after outbox cleanup. Template copy lives in `worker/welcome.js`; no additional provider account or API key is needed.

On Windows, `scripts/update-welcome-email.ps1 -Revision <commit-sha>` refreshes the complete source (including shared modules), installs locked dependencies, builds, applies database migrations, and deploys. It preserves `wrangler.jsonc`, Vercel settings, local environment files, and Worker secrets. The logo is served at `/email-logo.png` on the canonical frontend.

### One-time welcome resend with the founder signature

Migration `0008_welcome_signature_resend.sql` snapshots existing verified accounts for one additional welcome email signed Bakare Feranmi / Founder / Pentreeform. This is an explicitly requested resend, including accounts that already received the original email. New accounts created after this migration continue to receive only their normal welcome.

The scheduled Worker queues up to five snapshot recipients per minute, skips suppressed or unverified addresses, and waits while an original welcome is still queued or sending. Each refresh has its own outbox job and provider idempotency key. Its durable claim remains in `welcome_signature_resends` after outbox cleanup, so repeated deployments or cron runs cannot trigger another refresh. Current verified email ownership is checked again before sending. Apply all migrations before deploying the updated Worker, using the pinned welcome updater.

## Search and sharing metadata

`npm run build` first builds the Vite client, then prerenders the landing, Support, Privacy and Terms pages from the same React components. Each public URL has initial HTML content, its own title and description, an absolute canonical URL, Open Graph and X card tags, and appropriate JSON-LD. The client hydrates the public HTML while the signed-in app remains client-rendered. Lazy workspace loading is retained.

The canonical public origin comes from `vars.APP_ORIGIN` in `wrangler.jsonc`; the deployment configuration helper remains the way to change it. It is compiled into client metadata and used for static page tags, generated `robots.txt` and `sitemap.xml`. The sitemap includes only public pages. Account routes, legacy app routes and submission/API endpoints have `X-Robots-Tag: noindex, nofollow` on Vercel; app HTML also includes noindex. These are indexing hints and do not replace authentication.

`public/og-image.png` is a 1200×630 PNG containing only the approved logo on white. PNG logo, touch icon and 48px favicon variants accompany the original SVG favicon. Sharing URLs are absolute and never include sign-in, verification or reset tokens. No ratings, testimonials or unverified usage claims are added to structured data.

Vercel publishes these frontend changes through the existing Git deployment. A later Worker deployment includes the same generated static assets; no database migration or new secret is required for SEO. Run `npm run build` then `npm run test:seo` to validate the actual generated HTML and image dimensions. Once live, submit `/sitemap.xml` in Google Search Console. Search and social platforms may keep cached titles or images until they crawl again.

## Owner administration

`/admin` is a lazy-loaded, read-only dashboard for the single verified account identified by the Worker secret `ADMIN_USER_ID`. It lists registered users, verification, effective plans, monthly usage, active forms, sign-in methods and recorded last activity. Search supports literal name, email and workspace text; verification/plan filters and cursor pagination keep reports bounded. Individual reports show configuration and counts, never message contents, password hashes, OAuth subjects or session tokens. No user deletion, account impersonation or billing changes are exposed.

On Windows, run `scripts/update-admin.ps1 -Revision <full-commit-sha>` from the configured project folder. It asks for your existing account email, resolves exactly one verified account in your remote D1 database, updates the complete source, builds, applies pending migrations, writes its ID to `ADMIN_USER_ID` and deploys the Worker. Your deployment configuration and existing secrets are preserved. Vercel receives the frontend through the Git deployment. Migration `0009_admin_analytics.sql` must be applied before the updated Worker serves authenticated requests.

To configure manually, retrieve only your verified account ID from D1 and run `npx wrangler secret put ADMIN_USER_ID`, entering that 32-character ID at the value prompt. Authorization is rechecked server-side for every report; client `isAdmin` only controls the workspace navigation link. Other accounts receive 403, unauthenticated requests receive 401, and an unset or malformed owner ID grants nobody access. To revoke access, delete the secret with `npx wrangler secret delete ADMIN_USER_ID`. To transfer access, replace it with another existing verified account's ID. Refresh the signed-in app after changing ownership. API responses use no-store and noindex; `/admin` is excluded from the sitemap and contains no account data in prerendered HTML.

### Metric definitions and history

- Overview defaults to excluding the owner account; the inclusion toggle applies consistently to account, usage, form, signup, activity, submission, delivery and plan totals. User search always includes all accounts.
- Total users means all registered accounts; verified users and adoption steps are reported separately. Activation means a verified account with a form and at least one counted submission in monthly usage. The current month uses UTC. Expired paid plans are reported as Free. No revenue is inferred from plan names.
- A verified authenticated application request records one activity row per user per UTC day, with a last-seen write at most once every five minutes. Requests to `/api/admin/*` do not record product activity. This is authenticated product usage, not anonymous visitor tracking or a real-time online count. Activity starts at rollout; historical activity is not fabricated. Daily activity rows expire after 120 days, while last-seen stays with the account.
- Migration 0009 seeds daily submission counters from messages still retained at migration time. New counters survive message deletion and retention cleanup. Older deleted submissions cannot be reconstructed; daily historical counts can be incomplete before rollout. These saved-message counts include messages later marked spam. Monthly usage follows the existing quota counter.
- Email reports cover all email types in retained outbox records within the selected date range. Attempted jobs exclude queued, suppressed and cancelled jobs. Accepted messages remain unconfirmed until a signed delivery webhook reports delivery; failures, bounces and complaints stay distinct. The confirmation percentage is confirmed delivered divided by attempted jobs, not a universal inbox-placement rate. Outbox cleanup can remove jobs older than 30 days, so longer ranges are incomplete.
- Connection badges show configured bindings, not an independent provider health check. Dashboard refreshes once per minute while visible and displays the report timestamp. Local report timestamps use Lagos time, while daily series use UTC.

Account activity dates and aggregate retention are described in the public privacy policy. Server authorization, migration preservation, retained counts, filters and safe account reports are covered by `tests/admin.test.js`; UI routing and denial handling are covered by `tests/admin-ui.cjs`. The Windows updater's native execution still requires the operator's authenticated Wrangler environment.


The admin updater invokes the project's installed Wrangler CLI through Node for its owner lookup, keeping SQL away from npm's extra Windows command-shell boundary. Failed queries and malformed JSON print their captured output before stopping; no source, migrations, secrets or deployment are changed at that stage. If Cloudflare rejects a lookup, use that displayed error to diagnose authentication, permissions or the configured database. A generic lookup failure alone does not identify the cause.

`npm run test:admin-updater` exercises the real PowerShell lookup section against a synthetic local CLI: SQL argument preservation, readable failures, invalid JSON and owner validation. It requires PowerShell (`powershell.exe` on Windows or `pwsh` elsewhere), or a `POWERSHELL_BIN` path; the tests skip when no runtime is installed. These tests do not contact Cloudflare or deploy anything.
