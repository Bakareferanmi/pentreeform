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
- Add an operator administration interface and a tested support/data-deletion process before a broader launch. Those are not part of this backend release.

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
