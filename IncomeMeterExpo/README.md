# IncomeMeter mobile (Expo)

Offline-first phone app with the IncomeMeter web features. It can optionally sync with the IncomeMeter API on Azure.
All data lives in SQLite on the phone, so the app works with no account and no signal.

## Features

The app covers the web app's features:

| Area | What it does |
| --- | --- |
| Dashboard | Last 7 days vs the previous 7 days, and this month. Weekly, monthly and annual charts, stacked by work type, with the fiscal-year start taken from Settings. Per work type: £/h and £/mile, plus the split by income source. Today's routes. |
| Routes | **Start / End route** buttons (the web only has these in the API). List with status, date-range and work-type filters and sorting. Full create and edit form. CSV bulk import in the same format as the web. Detail screen with a **map of the driven path**. |
| Expenses | Filter by tax year and category, with totals per category. Receipt photos from the camera or library, with the date read from EXIF. **Read receipt (online)** uses the server's OCR to fill in merchant, total, litres and odometer. |
| Odometer | Readings with an optional dashboard photo; the online OCR can read the mileage from the photo. |
| Vehicles | All the web fields: CO2, purchase and disposal, finance, claim method and lock, pool b/f. DVLA lookup (online). **Assign by date**. |
| Work types | Work types with income source templates (default amount, required, order). The same three defaults as the API are seeded on first launch. |
| Tax report | A port of `TaxYearReportService` that runs on the phone. Per vehicle or combined: business %, apportioned expenses, capital allowances (AIA, FYA, WDA, balancing), flat-rate comparison, SA103F/SA103S boxes and warnings. CSV export through the share sheet. |
| Settings | Language (English / 繁體中文), currency, odometer unit, default chart period, fiscal-year start, GPS recording on/off, sync account. |

### GPS route recording and odometer autofill

When a route starts, the app records your position in the background. It uses an Android foreground-service notification, and on iOS the "Always" location permission.

It drops noisy fixes:

- accuracy worse than 50 m
- movement smaller than the GPS jitter while parked
- jumps that imply more than about 200 km/h

The points it keeps are stored with the route.

On **End route**, the end odometer is **pre-filled as start odometer + distance driven**, in the odometer unit you chose in Settings. The screen shows the GPS distance and the number of points, and you can still type over the value. The detail screen draws the route on a map.

- If you only allow "While using the app", recording continues while the app is open, and the app says so.
- If the app is killed or the phone restarts mid-route, recording resumes the next time the app opens.
- Tuning values are in `src/domain/geo.ts` (`TRACKING`).
- A unit test simulates a noisy 10-mile drive followed by 10 minutes parked, and checks the result is within 0.3 mi.

## Running it

Background location, the foreground service and the `incomemeter://` sign-in redirect all need native config. That means you need a **development build**; Expo Go can't do these.

```bash
cd IncomeMeterExpo
npm install
npx expo run:android          # local build, needs Android Studio / SDK
# or build in the cloud:
npx eas-cli@latest build --profile development --platform android
npx expo start --dev-client
```

Expo Go still works for most screens. Recording then only happens while the app is open, and for sync you paste an API token instead of signing in with Google.

**Android maps:** development and release builds need a Google Maps API key (Maps SDK for Android). Put it in `app.json` → `android.config.googleMaps.apiKey`. Only Expo Go ships with its own key. iOS uses Apple Maps and needs no key.

## Sync with Azure (optional)

1. Settings → **Server address**, e.g. `https://<your-app>.azurewebsites.net`.
2. **Sign in with Google.**
   - This opens the API's existing Google login in the browser.
   - The API sends you back to `incomemeter://auth?token=…`. The redirect is only allowed for that scheme; see `AuthController`.
   - The app then exchanges the 1-hour session token for a 365-day API token with a refresh token (`POST /api/tokens/generate`).
   - First-time users must register on the web app once.
3. Alternatively, generate an API token on the web (Settings → API tokens) and paste it.

How sync works (`src/sync/sync.ts`, `IncomeMeter.Api/Controllers/SyncController.cs`):

- The app creates records with ObjectId-shaped ids, so a record keeps the same id on the phone and in MongoDB.
- One request, `POST /api/sync`, does all of this:
  - pushes pending changes and tombstoned deletions
  - pushes new GPS points
  - returns everything changed on the server since the last sync
  - returns every server id, so records deleted on the web are removed from the phone
- Conflicts are resolved by last write wins on `updatedAt`.
- The server refuses ids that belong to another user.
- Photos are uploaded through the existing `POST /api/attachments/batch`, which also runs OCR and de-duplicates. The server may de-duplicate a photo to an id it already has; if so, the local photo record and its references are re-keyed to that id.
- Sync runs on launch, when the app comes to the foreground, 5 s after an edit, and from **Sync now**.

## Code map

```
index.ts                  registers the background GPS task, then loads Expo Router
src/app/                  screens (Expo Router)
src/db/                   SQLite store: JSON documents + dirty/tombstone flags, locations table
src/domain/               pure logic ported from the API: tax report, dashboard, vehicle assignment, CSV, GPS
src/services/             route lifecycle (start/end, odometer suggestion), seeding, attachments
src/tracking/tracker.ts   background location task and filtering
src/sync/                 API client (auth, refresh, OCR upload, DVLA) and sync engine
src/ui/                   components, i18n (en-GB / zh-HK), formatting
```

## Checks

```bash
npm run typecheck
npm test                  # domain unit tests (node:test via tsx)
npx expo-doctor
```
