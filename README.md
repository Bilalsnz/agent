# CaterScout Agent

A practical catering and group-dining research agent for the NEAR AI Agent Market task. It collects event requirements, discovers caterers through Google Places when configured, drafts vendor outreach, tracks replies and non-replies, and produces an evidence-first report.

## Current scope

- Event brief: location, date, guest count, dietary requirements, budget, and event type.
- Vendor discovery via Google Places API (requires `GOOGLE_MAPS_API_KEY`). No fabricated vendor records are returned when discovery is unavailable.
- Outreach drafts for each vendor, with a mailto fallback. Optional sending via Resend requires `RESEND_API_KEY` and a verified `RESEND_FROM` sender.
- Local reply tracking and report export in the browser.
- Prices and availability are marked confirmed only when a human records an actual vendor reply. No-reply vendors remain visible in the report.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. API routes run on Vercel, so for local API testing use `vercel dev` after installing the Vercel CLI, or deploy the repository to Vercel.

## Environment variables

- `GOOGLE_MAPS_API_KEY`: enables real caterer discovery through Google Places Text Search.
- `RESEND_API_KEY`: optional email sending through Resend.
- `RESEND_FROM`: verified sender identity, e.g. `CaterScout <events@yourdomain.com>`.

Never commit API keys. Set them in Vercel Project Settings → Environment Variables.

## Important accuracy rules

- Search results are leads, not confirmed availability.
- The agent never invents prices, dietary assurances, or availability.
- A vendor is only marked as quoted after a reply is recorded with evidence.
- Vendors who do not reply are included in the final report.
- Email sending should be used only for relevant, personalized requests. Verify the recipient and message before sending.

## Deployment

Import `Bilalsnz/agent` into Vercel. The static frontend is served from the repository root and files under `api/` are Vercel serverless functions.
