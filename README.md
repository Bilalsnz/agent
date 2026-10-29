# CaterScout Agent

CaterScout is an evidence-first group dining research workspace built for the NEAR AI Agent Market catering and group-dining task.

## Live product

- App: https://agent-beta-orcin.vercel.app/
- Repository: https://github.com/Bilalsnz/agent

## Workflow

1. **Describe the event.** Set location, date, guest count, event type, dietary needs, budget, currency, and practical notes.
2. **Discover leads.** Search OpenStreetMap without an API key, or use Google Places when `GOOGLE_MAPS_API_KEY` is configured. The search covers a wider local radius and prioritizes caterers and listings with published contact details. For Toronto searches, CaterScout also adds a small curated directory of contact details published on official catering business websites, with source links recorded for verification.
3. **Verify the contact.** Use website, map, phone, WhatsApp, or email links. Use **Edit details** to add or correct a vendor's contact information.
4. **Send the inquiry.** Prepare a tailored inquiry, copy it into WhatsApp or another channel, open a mail draft, or send through Resend if configured. Sending email requires a verified vendor email and an explicit confirmation.
5. **Track what happened.** Record the response status, actual stated price, availability/dietary details, and an evidence reference. Quoted status requires a price; the app warns if a quote has no evidence reference.
6. **Export the evidence.** Download JSON or CSV, or print the report / save it as PDF. The report retains leads, recorded replies, prices, contact timestamps, follow-up times, and non-responses.

## Accuracy rules

- A map listing is a lead, not proof the vendor is available or can serve the group.
- Prices, availability, and dietary accommodations are not inferred from search results.
- Only a price entered from a vendor's actual response is counted as a quote.
- Mark **No reply** only after checking the channel used and following up as appropriate.
- A 48-hour reminder is a follow-up prompt, not automatic proof of non-response.
- Verify that a contact belongs to the intended business before sending an inquiry.

## Data and limitations

- Event and vendor records are stored in the current browser's local storage. They do not automatically sync across devices or browsers. Export JSON regularly as a backup.
- The app does not currently read incoming vendor email automatically. A user records responses from email, phone, WhatsApp, or other channels.
- OpenStreetMap coverage varies by area, and many listings have no published phone, website, or email. Toronto searches include a limited curated set of official business contact pages as a supplement, not a guarantee of complete coverage. Recheck every contact and service area before outreach.
- Optional Resend email sending requires `RESEND_API_KEY` and a verified `RESEND_FROM` address in Vercel.
- Optional Google Places discovery requires `GOOGLE_MAPS_API_KEY`. The default OpenStreetMap path requires no paid API key.

## Environment variables

- `GOOGLE_MAPS_API_KEY`: optional Google Places Text Search.
- `RESEND_API_KEY`: optional outbound email sending.
- `RESEND_FROM`: verified sender identity, for example `CaterScout <events@yourdomain.com>`.

Never commit API keys. Add them through Vercel Project Settings → Environment Variables.

## Run locally

```bash
npm install
npm run dev
```

The static frontend is built with Vite. API routes run as Vercel serverless functions; use `vercel dev` for local API route testing.

## Verification

GitHub Actions checks JavaScript syntax and builds the production bundle on pushes to `main` and pull requests.

## Deployment

Import `Bilalsnz/agent` into Vercel. The repository includes `vercel.json` and the build workflow. Confirm that Vercel is connected to the `main` branch and check deployment status after each push.
