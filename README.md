# Motr

Vehicle maintenance tracker. React + Vite frontend, Firebase (Auth + Firestore) for accounts and data, Express backend that proxies Gemini Vision for odometer scanning.

## Architecture

- `src/` — React app (Vite)
- `server.js` — Express server: serves the built static bundle and exposes `/api/scan-odometer` which proxies Google Gemini Vision. The Gemini API key stays server-side.
- `firestore.rules` — security rules to deploy to your Firebase project.

In production a single Node process serves both the static files and the `/api/*` endpoints on the same port.

## Prerequisites

1. **Node.js 20+**
2. **Firebase project** (Spark / free plan is fine)
   - Enable **Authentication → Sign-in method → Google**
   - Create a **Firestore Database** (default database, production mode)
   - Deploy `firestore.rules` (Firebase Console → Firestore → Rules → paste & publish)
   - Add your deployment domain (and `localhost` for dev) to **Authentication → Settings → Authorized domains**
   - Copy the Web App config from **Project settings → General → Your apps**
3. **Gemini API key** from <https://aistudio.google.com/apikey>

## Local development

```bash
cp .env.example .env.local      # then fill in the values
npm install
npm run dev                     # vite on :3000, api on :8787 (vite proxies /api → :8787)
```

Open <http://localhost:3000>.

## Production build (manual)

```bash
npm run build                   # outputs dist/
npm start                       # node server.js on PORT (default 3000)
```

## Deploy to Coolify

1. **New Resource → Application → Public Repository** and point it at this repo.
2. Set **Build Pack** to `Dockerfile`.
3. Set **Port** to `3000`.
4. Add environment variables (mark the `VITE_*` ones as **Build Variable** so they are inlined at build time):

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

5. Deploy. Coolify will give you a `*.sslip.io` URL — add it to your Firebase **Authorized domains** before testing sign-in.
6. When you buy a real domain, point its DNS at the Coolify server and add it to Authorized domains too.

## Notes

- `GEMINI_API_KEY` is **server-only**. It never reaches the browser — calls go through `/api/scan-odometer`.
- The `VITE_FIREBASE_*` values are public by design; security is enforced by `firestore.rules` and the Auth authorized-domains list.
- The old `firebase-applet-config.json` (AI Studio's shared project) is no longer used and can be deleted.
