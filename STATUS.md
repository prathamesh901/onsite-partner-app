# PrintBuddy Partner — App Status

_Last updated: 2026-06-08_

---

## 1. What This Repo Is

React Native (Expo, managed workflow, TypeScript) mobile app called **PrintBuddy Partner**. It consumes the existing `onsite-partner-backend` REST API (hosted on Vercel) and contains no backend logic of its own.

---

## 2. Current State Per Screen

| Screen | Route | State |
|---|---|---|
| Login / OTP | `(auth)/login` | **Working.** Two-step: enter email → receive 6-digit code → verify. Error messages, loading states, and env-not-configured warning are implemented. |
| Pending Approval | `(pending)/pending` | **Working.** Shown when a user is authenticated but `status != 'approved'`. Displays rejection/suspension copy. Has a "Check again" button that re-polls `/api/auth/me`. Sign-out button present. |
| Kiosks Overview | `(app)/(tabs)/kiosks` | **Working.** FlatList of all assigned kiosks. Shows kiosk name, location, type badge (Standard / e-Stamp), online status dot, ink bars for each cartridge, combined paper bar with zone (Good / Low / Critical / Empty), and an alert count badge. Header row shows fleet-wide Online / Alerts / Offline counts. Polls every 5 s; pauses polling when the tab is not focused. Pull-to-refresh. Loading, error-with-retry, and empty states are all handled. |
| Kiosk Detail | `(app)/kiosk/[id]` | **Working.** Pushed as a full-screen card over the tabs when a kiosk card is tapped. Sections: hero card (status, model, serial, IP, page count), Ink Levels (per-cartridge bars), Paper (combined bar + per-tray chips + stocktake modal), Printer Health (door / jam / cartridge / tray chips), Active Alerts (list with Resolve button), Recent Activity (last 8 alerts newest-first). Polls every 5 s; pauses while the stocktake modal is open. Pull-to-refresh. |
| Stocktake Modal | inside Kiosk Detail | **Working.** Bottom sheet modal. Shows one tray row per installed tray (2 and/or 3). Each row has a numeric input and preset buttons (Empty / Half / Full with correct sheet values). Displays a running total. POSTs to `/api/refill` and refreshes the kiosk on success. Inputs do not reset while the modal is open (background polling is paused). |
| Alerts | `(app)/(tabs)/alerts` | **Placeholder.** Shows a "coming soon" card with a description. No data fetching. |
| Analytics | `(app)/(tabs)/analytics` | **Placeholder.** Shows a "coming soon" card. No data fetching. |
| Supplies | `(app)/(tabs)/supplies` | **Placeholder.** Shows a "coming soon" card. No data fetching. |
| Profile | `(app)/(tabs)/profile` | **Minimal but functional.** Shows email, display name, role badge, status badge, backend connection status, and a working Sign Out button. No edit functionality. |
| Admin | `(app)/(tabs)/admin` | **Placeholder.** Tab is hidden for non-admin users (`href: null`). Shows a "coming soon" card when accessed by admins. |

---

## 3. Architecture

### Route structure (Expo Router file-based)

```
app/
  _layout.tsx              Root Stack — mounts AuthProvider, gates navigation
  (auth)/login.tsx         Unauthenticated users land here
  (pending)/pending.tsx    Authenticated but not yet approved
  (app)/
    _layout.tsx            Authenticated Stack: (tabs) + kiosk/[id] as a card
    (tabs)/
      _layout.tsx          Bottom tab bar (Kiosks / Alerts / Analytics /
                             Supplies / Profile / Admin)
      kiosks.tsx
      alerts.tsx  analytics.tsx  supplies.tsx  profile.tsx  admin.tsx
    kiosk/[id].tsx         Kiosk detail (pushed over tabs)
```

The root `_layout.tsx` reads `{ loading, session, profile, profileError }` from `AuthContext` and calls `router.replace()` to redirect to the correct group. Navigation does not render until both `loading === false` and profile has settled (either a value or a confirmed error), preventing blank screens during auth init.

### Auth flow

1. User enters email → `supabase.auth.signInWithOtp()` sends a 6-digit code.
2. User enters code → `supabase.auth.verifyOtp()` creates a Supabase session.
3. `onAuthStateChange` fires; `AuthContext` calls `GET /api/auth/me` to load the user's role and approval status from the backend.
4. Root layout redirects to `(app)` if `status === 'approved'`, otherwise to `(pending)`.

Sessions are persisted in `expo-secure-store` (iOS keychain / Android keystore) via a chunked adapter that works around SecureStore's ~2 KB per-key limit. On web the fallback is `AsyncStorage`.

**Token attachment:** The Supabase access token is cached synchronously in a module-level variable (`setSessionToken` / `getSessionToken` in `lib/supabase.ts`) whenever auth state changes. The API client reads this cache directly — it never calls `supabase.auth.getSession()` — which avoids a deadlock that occurs when `getSession()` is called from inside an `onAuthStateChange` handler (Supabase holds an internal async lock during handler execution).

### API client (`lib/api.ts`)

- Attaches `Authorization: Bearer <token>` from the synchronous token cache on every request.
- 10-second `AbortController` timeout; throws `ApiError` on non-2xx responses.
- Parses JSON automatically; exposes `api.get / post / put / patch / delete`.

### Data model

The app only displays data. All business logic — paper capacity, ink thresholds, alert creation, stocktake maths — lives in the backend. The app does not re-derive any of it. The one resolution helper (`resolvePaper()` in the detail screen) handles the different field names the two endpoints use (`paper_total` on the list endpoint vs `trays` on the detail endpoint) while reading hardware capacity from `tray_config` supplied by the backend.

---

## 4. What Works End-to-End (Confirmed on Device)

- Email OTP login through to the approved home screen
- Redirect logic: pending users stay on the pending screen; approved users reach the Kiosks tab
- Kiosks Overview: live list with ink bars, paper bar (correct `of 800` denominator for standard kiosks), alert count, 5 s polling
- Kiosk Detail: all six sections render with real data; back navigation works
- Paper bar on detail shows the same denominator as the overview (both read hardware capacity from the backend)
- Stocktake modal: open, enter counts (or tap presets), confirm → POST to `/api/refill` → data refreshes; inputs do not reset while the modal is open
- Resolve alert button: POSTs to `/api/alerts/{id}/resolve` and refreshes the kiosk
- Sign out: clears session, returns to login

---

## 5. Known Issues / TODO

- **Paper zone thresholds** are computed client-side in `resolvePaper()` as a fallback when the backend does not return a `zone` field. If the backend already returns a zone string, that is used directly and the client-side thresholds are irrelevant.
- **Profile screen is read-only.** No way to edit name or notification preferences yet.
- **Admin tab is a placeholder.** Admins can see it but it does nothing.
- **Alerts / Analytics / Supplies tabs are placeholders.** Tapping them shows a "coming soon" card.
- **No push notifications.** The app does not register a push token or handle incoming notifications.
- **No EAS build config.** `eas.json` has not been created; the app has never been built as a standalone binary.
- **`app.config.js`** — converted from `.ts` to plain CommonJS to avoid an Expo CLI parse error on some environments. Works correctly.
- **Debug logs from auth and API client** have been cleaned up; detail-screen paper debug logs removed in the most recent commit.

---

## 6. Remaining Work to Ship

### Feature screens (not started beyond placeholders)
- **Alerts** — list of fleet-wide active/resolved alerts, filter by severity/kiosk, resolve from here
- **Analytics** — page-count trends per kiosk and per fleet, date-range filter
- **Supplies** — consumables log, paper refill history, cartridge install log
- **Admin** — user approval queue, kiosk assignment management

### Other
- **Push notifications** — register Expo push token, handle incoming notifications for alerts and low-supply events
- **Profile editing** — allow the user to update their display name
- **EAS build setup** — create `eas.json`, configure iOS bundle ID and Android package name, add `EXPO_PUBLIC_SUPABASE_ANON_KEY` as an EAS secret
- **App store submission** — Apple App Store (requires paid Apple Developer account) and Google Play

---

## 7. How to Run

### Prerequisites

- Node.js 18+
- Expo Go on a physical device (iOS or Android) — most features require a real device due to `expo-secure-store`

### Setup

```bash
git clone <repo>
cd onsite-partner-app
npm install
```

Create a `.env` file at the project root (copy from `.env.example`):

```
EXPO_PUBLIC_SUPABASE_URL=https://ujwnukabzpztykdwoxxo.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<paste Supabase anon key here>
EXPO_PUBLIC_API_BASE_URL=https://onsite-partner-backend.vercel.app
```

The Supabase anon key is in the Supabase dashboard → Project Settings → API → "anon public".

### Start

```bash
npx expo start -c      # -c clears Metro cache; always use after env changes
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS).

---

## 8. Recent Changes

| Commit | What and why |
|---|---|
| `fix: use tray_config hardware capacity in detail paper bar` | The per-tray `capacity` field in the detail endpoint's `trays` payload is the last-stocktake total, not the installed hardware maximum. Fixed `resolvePaper()` to prefer `tray_config.trayN.capacity` (the authoritative hardware capacity the backend uses for `paper_total.total_capacity`), so the detail and overview bars now show the same denominator. Removed paper debug logs. |
| `fix: paper card missing + stocktake inputs resetting every poll` | Two bugs: (1) Paper section was rendered conditionally on `kiosk.paper_total`, which is undefined on the detail endpoint — fixed to render unconditionally with a fallback message. (2) Stocktake inputs were resetting every 5 s because the `trays` array was a new reference each render; fixed with a `stocktakeOpenRef` that pauses polling while the modal is open, and a `wasVisible` ref that only resets inputs on the closed→open transition. |
| `fix: eliminate getSession() deadlock in api client` | After the route restructure, auth worked but the app hung indefinitely on the kiosk list. Cause: the API client was calling `await supabase.auth.getSession()` inside `onAuthStateChange` handler code, which deadlocks because Supabase holds an async lock during handler execution. Fixed with a synchronous module-level token cache: `AuthContext` writes synchronously, `api.ts` reads synchronously. |
| `fix: nest tabs in (tabs) group, move kiosk detail into (app) stack` | Expo Router could not resolve the route `kiosk` because the detail screen was at the repo root rather than inside the authenticated `(app)` group. Restructured: `(app)/_layout.tsx` is now a Stack with `(tabs)` and `kiosk/[id]` as children; all tab screens moved to `(app)/(tabs)/`. |
| `fix: loadProfile hangs forever — timeout + finally + error fallback UI` | `loadProfile()` had no `finally` block so `setLoading(false)` was never called on error. Added `AbortController` 10 s timeout to every API fetch; added `try/finally` at both `loadProfile` call sites; added an error fallback UI in the root layout for the `session + profileError` case. |
