import { Session } from '@supabase/supabase-js';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { api, ApiError } from '../lib/api';
import { registerForPushNotificationsAsync, sendTokenToBackend } from '../lib/notifications';
import { setSessionToken, supabase } from '../lib/supabase';
import { UserProfile } from '../lib/types';

interface AuthState {
  loading: boolean;
  session: Session | null;
  profile: UserProfile | null;
  profileError: string | null;
  /** Authenticated but no profile row yet — must complete the registration form. */
  needsRegistration: boolean;
  signIn: (email: string) => Promise<void>;
  verifyOtp: (email: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

/** Unwrap /api/auth/me regardless of nesting shape. */
function unwrapProfile(raw: unknown): UserProfile | null {
  if (!raw || typeof raw !== 'object') {
    console.warn('[AuthContext] /api/auth/me returned a non-object response');
    return null;
  }
  const obj = raw as Record<string, unknown>;

  if (obj.profile && typeof obj.profile === 'object') return obj.profile as UserProfile;
  if (obj.user && typeof obj.user === 'object') return obj.user as UserProfile;
  if ('status' in obj) return obj as unknown as UserProfile;

  console.warn('[AuthContext] /api/auth/me: unrecognised shape, returning as-is');
  return obj as unknown as UserProfile;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const mounted = useRef(true);

  /**
   * Fetch /api/auth/me and update profile state.
   * Never throws — always settles so callers can safely await it.
   */
  const loadProfile = useCallback(async (activeSession: Session | null) => {
    if (!activeSession) {
      if (mounted.current) {
        setProfile(null);
        setProfileError(null);
        setNeedsRegistration(false);
      }
      return;
    }

    try {
      const raw = await api.get('/api/auth/me') as any;

      // `registered:false` means authenticated but no profile row yet. Don't let
      // unwrapProfile mistake that response's {id,email} stub for a real profile —
      // route the user to the registration form instead.
      const registered = raw?.registered !== false;
      const me = registered ? unwrapProfile(raw) : null;

      if (mounted.current) {
        setProfile(me);
        setNeedsRegistration(!registered);
        setProfileError(null);
      }

      // Refresh push token on every approved startup — backend upsert is idempotent.
      if (me?.status === 'approved') {
        registerForPushNotificationsAsync()
          .then((token) => { if (token) sendTokenToBackend(token); })
          .catch(() => {});
      }
    } catch (e: unknown) {
      const msg = e instanceof ApiError ? e.message : (e instanceof Error ? e.message : String(e));
      console.error('[AuthContext] loadProfile: GET /api/auth/me failed:', msg);
      if (mounted.current) {
        setProfile(null);
        setNeedsRegistration(false);
        setProfileError(msg);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;

    // Initial session check
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted.current) return;
      // Cache token synchronously BEFORE any async work so the api client
      // can read it without calling getSession() again.
      setSessionToken(data.session);
      setSession(data.session);
      try {
        await loadProfile(data.session);
      } catch (e) {
        // loadProfile never throws, but be safe
        console.error('[AuthContext] unexpected error from loadProfile:', e);
      } finally {
        if (mounted.current) setLoading(false);
      }
    });

    // Auth state changes (sign-in, sign-out, token refresh)
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted.current) return;

      // Update the token cache immediately (synchronous) so the api client
      // has the token before the async loadProfile call begins.
      setSessionToken(newSession);
      setLoading(true);
      setSession(newSession);
      try {
        await loadProfile(newSession);
      } catch (e) {
        console.error('[AuthContext] unexpected error from loadProfile in listener:', e);
      } finally {
        if (mounted.current) setLoading(false);
      }
    });

    return () => {
      mounted.current = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    if (error) throw new Error(error.message);
  }, []);

  const verifyOtp = useCallback(async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: token.trim(),
      type: 'email',
    });
    if (error) throw new Error(error.message);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setProfileError(null);
    setNeedsRegistration(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    await loadProfile(session);
  }, [loadProfile, session]);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      profile,
      profileError,
      needsRegistration,
      signIn,
      verifyOtp,
      signOut,
      refreshProfile,
    }),
    [loading, session, profile, profileError, needsRegistration, signIn, verifyOtp, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an <AuthProvider>');
  return ctx;
}
