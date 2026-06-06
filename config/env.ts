import Constants from 'expo-constants';

/**
 * Centralized runtime configuration.
 *
 * Values originate in `app.config.ts` (`extra`) which reads them from
 * `process.env.EXPO_PUBLIC_*` (your `.env` file). We read them here through
 * expo-constants so the rest of the app has a single typed import surface.
 */
type Extra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  apiBaseUrl?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const ENV = {
  SUPABASE_URL: extra.supabaseUrl ?? '',
  SUPABASE_ANON_KEY: extra.supabaseAnonKey ?? '',
  API_BASE_URL: extra.apiBaseUrl ?? '',
} as const;

/** True only when the Supabase anon key has actually been provided. */
export const isConfigured = Boolean(ENV.SUPABASE_URL && ENV.SUPABASE_ANON_KEY);

if (!isConfigured && __DEV__) {
  // eslint-disable-next-line no-console
  console.warn(
    '[PrintBuddy] Supabase is not fully configured. ' +
      'Paste your anon key into `.env` (EXPO_PUBLIC_SUPABASE_ANON_KEY) and restart with `npx expo start -c`.',
  );
}
