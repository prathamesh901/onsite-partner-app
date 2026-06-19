module.exports = ({ config }) => ({
  ...config,
  name: 'PB Partner',
  slug: 'printbuddy-partner',
  owner: 'prathamesh0901',
  version: '1.0.0',
  // ── OTA updates (EAS Update) ──────────────────────────────────────────────
  // runtimeVersion gates which native build an OTA update is allowed to run on.
  // The "fingerprint" policy hashes the native layer (native deps, config,
  // permissions, icons, SDK version), so it changes AUTOMATICALLY whenever a change
  // would require a new APK. An OTA only runs on a build whose fingerprint matches,
  // so a native change can never reach an incompatible old APK — no manual version
  // bump needed. Pure JS/asset changes keep the same fingerprint and ship over OTA.
  runtimeVersion: { policy: 'fingerprint' },
  updates: {
    url: 'https://u.expo.dev/a94ab98f-2a2a-461b-b187-c6d63b9dd48b', // == extra.eas.projectId
  },
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'printbuddy-partner',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#E8F4FA',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.printbuddy.partner',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#FFFFFF',
    },
    package: 'com.printbuddy.partner',
    googleServicesFile: './google-services.json',
    permissions: ['RECEIVE_BOOT_COMPLETED', 'VIBRATE'],
  },
  web: {
    bundler: 'metro',
    output: 'static',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#38BDF8',
        defaultChannel: 'default',
        sounds: [],
      },
    ],
  ],
  extra: {
    router: { origin: false },
    eas: { projectId: 'a94ab98f-2a2a-461b-b187-c6d63b9dd48b' },
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ujwnukabzpztykdwoxxo.supabase.co',
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || 'https://onsite-partner-backend.vercel.app',
  },
});
