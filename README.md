# PrintBuddy Partner App

Expo (managed, TypeScript, Expo Router) mobile app for onsite partners and admins
to monitor HP printers across kiosk locations. It consumes an existing backend
REST API and authenticates with **Supabase email OTP**.

> **Status:** Foundation only. Auth, navigation gating, theme and base components
> are in place. Feature screens (Kiosks, Alerts, Analytics, Supplies, Admin) are
> currently navigable placeholders and will be built incrementally.

## Prerequisites

- Node.js 18+
- Expo Go app (iOS/Android) for development

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment** — copy the example file and paste your key:

   ```bash
   cp .env.example .env
   ```

   Then open `.env` and **paste your Supabase anon key** into:

   ```
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<paste here>
   ```

   Find it in the Supabase dashboard → **Project Settings → API → "anon public"**.
   The Supabase URL and API base URL are already filled in.

   > After editing `.env`, restart with a clean cache: `npx expo start -c`.
   > `.env` is git-ignored; never commit your keys.

## Running in Expo Go

```bash
npm start          # or: npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS). On first launch
you'll see the **login screen**; enter an email to receive a 6-digit code, then
verify it to sign in.

## Architecture

| Concern | Location |
|---|---|
| Runtime config (URLs, keys) | `app.config.ts` → `config/env.ts` |
| Supabase client (session in SecureStore) | `lib/supabase.ts` |
| API client (auto `Bearer` token, JSON, errors) | `lib/api.ts` |
| Auth state (session, profile, OTP, sign out) | `context/AuthContext.tsx` |
| Theme tokens | `constants/theme.ts` |
| Base components | `components/` (`Screen`, `Card`, `StatusDot`, `Badge`, `PrimaryButton`) |

### Navigation (auth-gated route groups)

```
app/
  _layout.tsx        Root: providers + auth gating
  (auth)/login       Email-OTP login          ← no session
  (pending)/pending  Awaiting approval        ← session, status != 'approved'
  (app)/             Bottom tabs              ← session + status == 'approved'
    kiosks, alerts, analytics, supplies, profile
    admin            (only shown when profile.role == 'admin')
```

The root navigator reads `session` + `profile.status` from `AuthContext` and
redirects to the correct group. Tab visibility for **Admin** is driven by
`profile.role`.

### Using the API client

All future screens should call through the shared client, which attaches the
current Supabase session token automatically:

```ts
import { api } from '../lib/api';

const kiosks = await api.get('/api/kiosks');
await api.post(`/api/alerts/${id}/resolve`);
```

## Backend

- Base URL: `https://onsite-partner-backend.vercel.app`
- Auth: Supabase (`https://ujwnukabzpztykdwoxxo.supabase.co`), email OTP
- Every request sends `Authorization: Bearer <supabase access token>`
- Profile/role/status come from `GET /api/auth/me`

## Building with EAS

```bash
npm install -g eas-cli
eas login
eas init                       # sets extra.eas.projectId
eas build --platform ios --profile production
eas build --platform android --profile production
```

Set `EXPO_PUBLIC_SUPABASE_ANON_KEY` (and the others) as EAS secrets / build-time
env vars so they're inlined into the production build.
