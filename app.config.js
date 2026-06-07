module.exports = ({ config }) => ({
  ...config,
  name: 'PrintBuddy Partner',
  slug: 'printbuddy-partner',
  version: '1.0.0',
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
      backgroundColor: '#E8F4FA',
    },
    package: 'com.printbuddy.partner',
  },
  web: {
    bundler: 'metro',
    output: 'static',
  },
  plugins: ['expo-router', 'expo-secure-store'],
  extra: {
    router: { origin: false },
    eas: { projectId: 'your-eas-project-id' },
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ujwnukabzpztykdwoxxo.supabase.co',
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || 'https://onsite-partner-backend.vercel.app',
  },
});
