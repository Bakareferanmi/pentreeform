# Pentreeform

An interactive React frontend for an affordable form submission service. Based on the approved purple dashboard concept.

## Status

**Frontend preview, not a production form backend.** Sample submissions and workspace preferences are stored in this browser using localStorage. There is no account authentication, public submission API, email service, or payment processing yet. Do not enter real customer data. Form endpoint URLs are explicit placeholders.

## Run locally

Requires Node.js 20.19+ or 22.12+ and npm.

```sh
npm ci
npm run dev
```

Open the local URL shown in the terminal.

```sh
npm run build
npm run preview
```

## Included

- Responsive dashboard, inbox, and message detail view
- Search, form/date filters, unread and spam tabs
- Mark read/unread, move to spam/inbox, and confirmed deletion
- CSV export with spreadsheet formula escaping
- Form configuration and local sample submission generation
- Sample delivery records, workspace overview, documentation
- Editable workspace preferences and confirmed preview reset
- Accessible dialog focus management, keyboard controls, reduced-motion support
- Purple SVG identity and favicon inspired by the approved concept

## Approved pricing (monthly USD)

| Plan | Price | Account submissions/month | Active forms | History |
| --- | --- | --- | --- | --- |
| Free | $0 | 100 | 2 | 30 days |
| Starter | $3 | 1,000 | 5 | 6 months |
| Pro | $7 | 5,000 | 20 | 12 months |
| Agency | $15 | 15,000 | 50 | 12 months |

These are display plans only. The preview does not enforce account quotas or collect payments. CSV export and custom redirects are intended paid-plan features; export is available for demonstration.

## Deploy the frontend

Cloudflare Pages, Vercel, or Netlify can build this repository with `npm run build` and publish `dist`. No environment variables are needed for the preview. Deployment is separate from the backend work.

## Interaction checks

Run `npm test` to check the main React flows in a DOM environment without a browser.

## Browser checks

Start the development server on port 5173, then in another terminal:

```sh
npx playwright install chromium
npm run test:ui
```

Checks cover search, selection, form creation, sample submission, refresh persistence, CSV download, mobile navigation/detail, horizontal overflow, and runtime errors. Test data is isolated in a new browser context. Screenshots are saved to the OS temporary directory.

## Backend work before a public launch

1. Cloudflare Workers API and D1 migrations with tenant ownership enforced server-side.
2. Verified accounts, secure sessions, password reset, rate limits, and recipient verification.
3. Form endpoints accepting HTML and JSON submissions, input limits, honeypots, Turnstile, and abuse controls. Domain checks alone do not prevent abuse.
4. Persist submissions before enqueueing notification jobs. Add idempotency, bounded retries, and provider-signed delivery webhooks. Provider acceptance is different from delivery; delivery does not guarantee inbox placement.
5. Verified sender domain, correct Reply-To, bounce/complaint handling, and recipient suppression.
6. Subscription provider integration with signed webhooks, server-enforced quotas, retention, and usage alerts.
7. Backups, monitoring, privacy terms, data export/deletion, and recovery testing.

Do not open paid public registration until these are implemented and validated.
