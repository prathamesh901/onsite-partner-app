# PrintBuddy Partner App

Expo (managed, TypeScript) React Native app for onsite partners to monitor HP printers across kiosk locations.

## Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- Expo Go app on your iOS or Android device (for development)

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment variables**

   The repo ships with a `.env` file pre-configured for the PrintBuddy backend:

   ```
   EXPO_PUBLIC_API_URL=https://onsite-partner-backend.vercel.app
   EXPO_PUBLIC_API_KEY=6cc70ae6b5cf799a7f430887dd62e962
   ```

   To point at a different backend, copy and edit the values:

   ```bash
   cp .env .env.local
   # edit EXPO_PUBLIC_API_URL and EXPO_PUBLIC_API_KEY
   ```

   All `EXPO_PUBLIC_*` variables are inlined at build time by Expo and safe to ship in a managed build.

## Running in Expo Go

```bash
npm start          # starts Metro + shows QR code
```

Scan the QR code with:
- **iOS**: Camera app → tap the notification
- **Android**: Expo Go app → scan QR

The app polls the API every **5 seconds** and pauses polling when backgrounded.

## Screens

| Screen | Path | Description |
|--------|------|-------------|
| Kiosks | `/` | Overview list with status, ink, paper, alert badges |
| Kiosk Detail | `/kiosk/[id]` | Hero card, ink bars, tray cards with refill, health chips, alerts |
| Alerts | `/alerts` | Filterable list; tap Resolve to mark alerts done |
| Analytics | `/analytics` | Per-kiosk page-count charts with range toggle |
| Profile | `/profile` | Placeholder (auth + push notifications coming later) |

## Building with EAS

1. **Install EAS CLI**

   ```bash
   npm install -g eas-cli
   eas login
   ```

2. **Configure EAS project**

   Edit `app.json` and set `extra.eas.projectId` to your EAS project ID, or run:

   ```bash
   eas init
   ```

3. **Build for iOS**

   ```bash
   eas build --platform ios --profile production
   ```

4. **Build for Android**

   ```bash
   eas build --platform android --profile production
   ```

5. **Submit to stores**

   ```bash
   eas submit --platform ios
   eas submit --platform android
   ```

   EAS handles code signing — you'll be prompted for your Apple/Google credentials on first run.

## API Reference

All requests include `x-api-key: <EXPO_PUBLIC_API_KEY>` header.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/kiosks` | All kiosks with paper levels and online flag |
| GET | `/api/kiosks/[id]` | Single kiosk with active alerts |
| GET | `/api/alerts` | Alerts (filter: `kiosk`, `type`, `severity`) |
| POST | `/api/alerts/[id]/resolve` | Mark alert resolved |
| GET | `/api/analytics/[id]?range=7d\|30d\|all` | Page-count time series |
| POST | `/api/refill` | `{ kiosk_id, tray_id, sheets_added }` |
| POST | `/api/trays/[kiosk_id]/[tray_id]/install` | Mark tray installed |

## Planned Features

- **Authentication** — partner login / JWT session
- **Push notifications** — low ink / paper jam alerts via Expo Notifications
