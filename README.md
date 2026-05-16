# MOTR — صيانة سيارتك، ببساطة

Web-only car maintenance tracker. Capture the odometer with your phone's camera, log
fuel and service events, and get smart reminders before the next change is due. Live at
[motrs.uk](https://motrs.uk).

- **Stack**: React 19 + Vite 6 + TypeScript + Tailwind v4 · Firebase Auth + Firestore ·
  Express proxy for Google Gemini Vision (OCR) · jsPDF + html2canvas for PDF reports.
- **Languages**: Arabic (default, RTL) and English (LTR) with a live toggle.
- **No native app** — installable as a PWA from the browser.

## Repo layout

```
src/
  App.tsx           the 14-screen application (auth + Firestore wiring + all screens)
  LandingPage.tsx   public marketing page rendered at /
  i18n.tsx          ar/en dictionaries + <LanguageProvider> + useI18n() hook
  InstallPrompt.tsx PWA "Add to Home Screen" prompt
  VehicleSettings.tsx vehicle interval editor (oil/battery/tires/maintenance)
  lib/
    firebase.ts     env-driven init for Auth + Firestore
    gemini.ts       client-side wrapper around /api/scan-odometer
    reports.ts      lazy-loaded jsPDF + html2canvas report builder
    utils.ts        cn(), formatMileage(), calculateOilLife()
    seedDemo.ts     one-click demo data seeder
  types.ts          Vehicle + TimelineEvent + ServiceType
public/
  logo.svg / motr2.svg  brand marks
  manifest.webmanifest  PWA manifest
server.js           Express: serves dist/, proxies /api/scan-odometer with per-IP rate
                    limits (10/hr, 20/day) so a stray client can't drain the Gemini quota
firestore.rules     deny-by-default + per-collection validators
firebase.json       Firebase CLI config (rules deploy target)
.firebaserc         project ID pin (motr-6a2d3)
Dockerfile          single-stage prod image (npm run build, then node server.js)
```

## The 14 screens (from `flow.html` / `app.html`)

The app is split into five user paths, each a hop along a state machine inside
`App.tsx` driven by `activePage`. The screens are rebuilt from the Claude.ai/design
handoff — Light theme, Gulf-inspired palette (brand `#F26B1F`, ink `#0E2233`).

| # | Screen | activePage | Notes |
|---|---|---|---|
| 01 | Splash | shown for 1.6s | Brand-orange bleed + logo + "صيانة سيارتك. ببساطة." |
| 02 | SignIn | `signin` | Google + (disabled) Apple, orange band motif behind the headline |
| 03 | Onboarding | `onboarding` | Hero illustration with phone + OCR mockup, page dots, single CTA |
| 04 | AddCar | `add-car` | Preview header (car silhouette), info + nickname + fuel-grade pills |
| 05 | Home | `dashboard` | Dark hero card, orange next-maintenance CTA, fuel-avg tile, recent activity |
| 06 | Cars | `cars` | Header + counter strip + per-vehicle cards (band + tone) |
| 07 | CarDetails | `car-details` | Three in-page tabs: Details / Stats / History |
| 08 | OCR Scan | `camera` | Dark viewfinder, brand-orange corner brackets, white shutter button |
| 09 | OCR Result | `ocr-result` | Photo preview, diff-since-last, 4-action grid (fuel / oil / service / reading) |
| 10 | LogFuel | `log-fuel` | Ink total card with brand band, fuel-grade chips, sticky save |
| 11 | LogService | `log-service` | 3×2 service-type grid, fields, auto-reminder toggle |
| 12 | Timeline | `timeline` | Vertical spine + icon dots, filter chips, monthly-spend summary |
| 13 | Reminders | `alerts` | Urgent orange callout (mark-done / snooze) + قادم / لاحقاً sections |
| 14 | Settings | `profile` | Dark profile card with brand band, App / Cars / Data / About sections |

### Navigation flow

```
A.  Splash ──1.6s──> SignIn ──> Onboarding ──> AddCar ──> Home
B.  Home ──> Cars ──> CarDetails ──tab──> History (Timeline) / Stats / Details
C.  Home ──tabbar OCR──> Camera ──shutter──> OCR Result ──> LogFuel ──> Home
D.  OCR Result ──> LogService ──> Reminders (auto-created)
E.  Home ──tabbar Profile──> Settings (Notifications row routes to Reminders)
```

The bottom tab bar holds five tabs in design order (right→left in RTL):
**الرئيسية · سياراتي · [camera] · السجل · حسابي**. The Bell icon in the dashboard
header also opens Reminders and shows a red count badge for active alerts.

## Data model (Firestore)

- `users/{uid}` — per-user doc. Fields: `email`, `displayName`, `createdAt`,
  `counted` (true once we've credited the public user counter).
- `vehicles/{vehicleId}` — owned by `userId`. Includes `currentMileage` (auto-bumped to
  the latest captured reading) and interval fields per maintenance kind.
- `events/{eventId}` — owned by `userId`, linked to `vehicleId`. Optional `amount`,
  `liters`, `station`, `serviceCenter`, `location`, `imageUrl`, `notes`.
- `stats/public` — single doc, public read. Field: `userCount: number`. Incremented
  exactly once per new user via `setDoc({ userCount: increment(1) }, { merge: true })`.

`firestore.rules` enforces:
- default deny on everything
- per-collection validators (`isValidVehicle`, `isValidEvent`)
- owners-only on vehicles/events
- single-field whitelist updates on users (`displayName`, `counted`)
- public read on `stats/public`; only signed-in users can increment, by exactly 1

## Behavior the design alone doesn't say

- **Self-healing odometer.** On every load, an effect walks each vehicle, takes the max
  `mileage` across its events, and patches `vehicle.currentMileage` if higher. Same
  patch fires inside `saveEvent` and on the "فقط القراءة" OCR action.
- **Empty-dashboard fallback.** If `selectedVehicle` ever becomes null while vehicles
  exist (e.g. user bails out of AddCar), a guard effect picks `vehicles[0]`.
- **User-count backfill.** `onAuthStateChanged` checks `users/{uid}` — if missing,
  creates it with `counted: true` and increments `stats/public.userCount`; if it
  exists without `counted`, just sets the flag and increments. Idempotent.
- **OCR scan UI is a dark shell.** The shutter button triggers the hidden `<input
  type="file" capture="environment">` — the in-app viewfinder is decorative because
  the web can't show a non-modal native camera.
- **Snooze is session-only.** Mark-done in Reminders updates Firestore; the snooze
  pill on the orange callout just adds the alert key to a local `Set`. It resets on
  reload, on purpose.

## Bilingual + RTL

- `LanguageProvider` sets `<html lang>` and `<html dir>` based on the chosen locale and
  persists it in localStorage.
- Components prefer logical Tailwind utilities (`text-start`, `ms-*`, `me-*`) over
  literal `text-right` / `mr-*` so they flip with the document direction.
- Number-heavy cells use `dir="ltr"` so digits and units (`212,450 كم`) read left-to-
  right inside an otherwise RTL paragraph.
- Phone mockups on the landing always show Arabic content; the LTR/RTL fix uses
  `text-start` inside them so the mocked Arabic reads naturally regardless of page
  language.

## Prerequisites

1. **Node.js 20+**
2. **Firebase project** (Spark plan is fine)
   - Enable **Authentication → Google**
   - Create a **Firestore Database** (production mode)
   - Authorized domains: add `localhost`, your Coolify URL, and your real domain
3. **Gemini API key** from <https://aistudio.google.com/apikey>

## Local development

```bash
cp .env.example .env.local      # then fill in the values
npm install
npm run dev                     # vite :3000, express :8787 (vite proxies /api → :8787)
```

Open <http://localhost:3000>. The landing renders at `/`; the app at `/app`.

## Production build

```bash
npm run build                   # outputs dist/
npm start                       # node server.js on PORT (default 3000)
```

## Deploying Firestore rules

The Firebase Console can't pick up rule updates from a Coolify deploy — they live in
this repo as `firestore.rules` and need a separate push:

```bash
npx firebase login                       # one-time, opens browser
npx firebase deploy --only firestore:rules
```

`.firebaserc` already points at `motr-6a2d3`. Run this any time `firestore.rules`
changes; otherwise public reads (e.g. `stats/public` for the landing) and
`users/{uid}` writes (e.g. the `counted` marker) fall back to the default deny.

## Deploying the app (Coolify)

1. **New Resource → Application → Public Repository** → this repo, branch `main`.
2. **Build Pack**: `Dockerfile`. **Port**: `3000`.
3. Environment variables (mark `VITE_*` as Build Variable):

   | Variable | Build? | Runtime? |
   |---|---|---|
   | `GEMINI_API_KEY` | — | yes |
   | `VITE_FIREBASE_API_KEY` | yes | — |
   | `VITE_FIREBASE_AUTH_DOMAIN` | yes | — |
   | `VITE_FIREBASE_PROJECT_ID` | yes | — |
   | `VITE_FIREBASE_APP_ID` | yes | — |
   | `VITE_FIREBASE_STORAGE_BUCKET` | yes | — |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | yes | — |
   | `VITE_FIREBASE_DATABASE_ID` (optional) | yes | — |

4. Deploy. Coolify gives you a `*.sslip.io` URL — add it to Firebase Authorized
   domains, then test sign-in.
5. Point your real domain (e.g. `motrs.uk`) at the Coolify server via Cloudflare DNS
   and add it to Authorized domains.

## Performance + safety

- **Code splitting.** `App.tsx` and `LandingPage.tsx` are lazy-loaded from `main.tsx`
  via a path check. PDF generation dynamically imports `jspdf` + `html2canvas`. Vite
  `manualChunks` keeps Firebase, motion, charts, date-fns, and pdf libraries in
  separate vendor chunks.
- **Rate limiting.** `server.js` puts `/api/scan-odometer` behind two
  `express-rate-limit` middlewares (10 requests/hour and 20/day per IP) so the
  Gemini quota can't be drained.
- **No client secrets.** `GEMINI_API_KEY` is server-only. `VITE_FIREBASE_*` are public
  by design — security is enforced by `firestore.rules` and Auth's authorized-domain
  list.

## Changelog highlights

The repo's commit log is the authoritative changelog. Notable arcs:

- **App redesign (5 phases)** — `e7213c3` Splash/SignIn/Onboarding/AddCar →
  `bdbaf16` Cars + CarDetails + navbar restructure → `16aca2c` Camera/OCR/LogFuel/
  LogService → `2b49996` Settings dark profile → `ca65c63` Timeline vertical spine.
- **Landing rebuild** — `0507acb` from-scratch React landing matching the
  Claude.ai/design canvas, replacing the earlier iframe.
- **Bilingual + direction** — `ec60ff9` and `064c79e` audited every `text-end` /
  `ms-auto` and replaced with start-side logical utilities; mocks stay RTL.
- **Data integrity** — `debd7ef` + `45d7d03` make sure every captured reading bumps
  `vehicle.currentMileage` (live + backfill).
- **User counter** — `546243c` backfill on session restore, `2d47c8c` `counted`
  marker for users that existed before counting was wired, `a880de2` tile removed
  from the landing.

## License

Private project — all rights reserved © MOTR 2026.
