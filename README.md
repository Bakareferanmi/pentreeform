# Pentreeform

A purple React dashboard and Cloudflare Workers backend for a public form submission service.

## Current implementation

- Registration, email verification, sign-in/out, password reset, expiring HttpOnly sessions
- Separate tenant data and server-side access checks
- Form creation, archiving, exact HTTPS hostname restrictions, verified account email as recipient
- JSON, URL-encoded, and multipart text submissions; custom fields preserved; file uploads rejected
- Turnstile, honeypot, rate limits, request-size limits, and submission idempotency
- Atomic account-wide monthly submission quotas and active form limits in SQLite triggers
- Submission storage and durable email outbox created together, before email is sent
- Bounded retries with stable Resend idempotency keys, signed delivery events, bounce/complaint suppression
- Free/paid retention, cursor pagination, read/unread, spam, deletion, and paid CSV export
- Paystack monthly plan checkout, server-verified payments, signed webhooks, duplicate protection, subscription management
- Responsive app, settings, documentation, and an isolated `/demo` with fictional local data

**Implemented and tested locally; not deployed or connected to live provider accounts.** Registration defaults to closed. See [deployment instructions](docs/DEPLOYMENT.md) for what must be configured. The frontend can no longer be deployed by itself as the live product; the Worker serves both the API and built assets.

## Pricing

Monthly USD prices. Limits are shared across the account, not per form.

| Plan | Price | Submissions/month | Active forms | History |
| --- | --- | --- | --- | --- |
| Free | $0 | 100 | 2 | 30 days |
| Starter | $3 | 1,000 | 5 | 6 months |
| Pro | $7 | 5,000 | 20 | 12 months |
| Agency | $15 | 15,000 | 50 | 12 months |

The server approximates 6/12-month retention as 183/366 days. Monthly usage resets on UTC calendar months; paid access expires one calendar month after the provider's payment timestamp. CSV export and custom redirects require a paid plan. Existing active forms are not automatically archived after a downgrade, but new form creation is blocked above the new limit. Paid plans do not bypass security or abuse controls.

Checkout is unavailable unless the configured Paystack merchant supports recurring USD payments and the actual provider plans match these prices. No exchange rate or naira prices have been invented. Availability of USD billing must be confirmed in the merchant account; a different provider or separately approved local prices may be needed.

## Local development

Node.js **22.13+** (Node 24 recommended) and npm.

```sh
npm ci
npm run build
npm run db:local
npm run dev:full
```

First replace the D1 database ID and copy `.dev.vars.example` to `.dev.vars`; see the setup guide. Open the Wrangler URL, usually `http://localhost:8787`. App origin must match exactly. Full-stack development serves the built frontend; rebuild after changing UI files.

For UI-only development:

```sh
npm run dev
```

Open `/?demo=1` on the Vite URL. `/demo`, `/demo/`, and `/#demo` also open the demo. The demo skips account and backend requests. The sign-in, loading, and backend setup screens include a demo button that opens it immediately without navigating to another route.

## Validation

```sh
npm test
npm run build
npx wrangler deploy --dry-run
```

Tests use real SQLite with the production schema and mocked email, security, and payment providers. They cover account flows, tenant separation, CSRF, verified recipients, limits, transactional outbox, idempotency, callbacks, suppression, reset/session revocation, payment verification, CSV escaping, and real/demo frontend wiring. They do **not** prove live provider delivery, Cloudflare operation, payment acceptance, or visual correctness in real browsers.

Optional browser checks: start Vite on port 5173, install Chromium with `npx playwright install chromium`, then run `npm run test:ui`. These exercise `/demo`. Browser rendering was unavailable in the build environment; run them on a laptop or CI before launch.

## Notes for the operator

- Use `/demo` only for fictional data. It stores sample data locally. The live app keeps its session in a cookie and loads data from D1.
- The inbox initially loads 100 messages. Search, filters, and summary counts cover loaded messages; load older pages as needed. CSV export streams all retained matching records from the server.
- Notifications go only to the verified account email. Additional recipient verification and team accounts are not included yet.
- Domain checks are defense in depth; Turnstile is mandatory on public submissions. Customer website hostnames must also be permitted in the operator's Turnstile configuration. This beta does not provision Turnstile domains automatically.
- Email acceptance, delivery to the recipient server, and inbox placement are different. Only a signed delivery event marks a notification delivered.
- Accepted messages are not automatically resent if a callback is missing. Provider retries are bounded to five attempts and the idempotency window.
- Archiving stops submissions but keeps historical messages. Deleting a submission removes its outbox record. Deletion cannot recall a message already sent or in flight.
- Scheduled retention deletes old messages. A downgrade to Free reduces retention to 30 days; export before downgrading.
- No file uploads, autoresponders, recipient changes, team roles, admin UI, or automatic naira billing are included in this release.
- Public registration should remain closed until the setup and live smoke tests in the deployment guide pass. Publish operator-specific privacy/terms and a support contact before charging customers.
