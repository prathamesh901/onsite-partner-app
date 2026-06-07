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
import { setSessionToken, supabase } from '../lib/supabase';
import { UserProfile } from '../lib/types';

interface AuthState {
  loading: boolean;
  session: Session | null;
  profile: UserProfile | null;
  profileError: string | null;
  signIn: (email: string) => Promise<void>;
  verifyOtp: (email: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

/** Unwrap /api/auth/me regardless of nesting shape. */
function unwrapProfile(raw: unknown): UserProfile | null {
  if (!raw || typeof raw !== 'object') {
    console.warn('[AuthContext] unwrapProfile: received non-object:', typeof raw, raw);
    return null;
  }
  const obj = raw as Record<string, unknown>;

  // DEBUG — remove once confirmed working
  console.log('[AuthContext] /api/auth/me raw response:', JSON.stringify(raw));

  if (obj.profile && typeof obj.profile === 'object') {
    console.log('[AuthContext] unwrapping from .profile key');
    return obj.profile as UserProfile;
  }
  if (obj.user && typeof obj.user === 'object') {
    console.log('[AuthContext] unwrapping from .user key');
    return obj.user as UserProfile;
  }
  if ('status' in obj) {
    console.log('[AuthContext] using bare response (has .status)');
    return obj as unknown as UserProfile;
  }

  console.warn('[AuthContext] /api/auth/me: unrecognised shape, returning as-is');
  return obj as unknown as UserProfile;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
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
      }
      return;
    }

    const token = activeSession.access_token;
    console.log('[AuthContext] loadProfile: token present =', Boolean(token));
    if (token) {
      console.log('[AuthContext] loadProfile: token prefix =', token.slice(0, 20) + '...');
    }

    try {
      console.log('[AuthContext] loadProfile: → calling GET /api/auth/me');
      const raw = await api.get('/api/auth/me');
      console.log('[AuthContext] loadProfile: ← GET /api/auth/me returned');

      const me = unwrapProfile(raw);
      console.log('[AuthContext] parsed profile:', JSON.stringify(me));

      if (mounted.current) {
        setProfile(me);
        setProfileError(null);
      }
    } catch (e: unknown) {
      const msg = e instanceof ApiError ? e.message : (e instanceof Error ? e.message : String(e));
      console.error('[AuthContext] loadProfile: GET /api/auth/me FAILED:', msg, e);
      if (mounted.current) {
        setProfile(null);
        setProfileError(msg);
      }
    } finally {
      // Belt-and-suspenders: log that we exited the try/catch regardless
      console.log('[AuthContext] loadProfile: finally block reached');
    }
  }, []);

  useEffect(() => {
    mounted.current = true;

    // Initial session check
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted.current) return;
      console.log('[AuthContext] initial getSession: has session =', Boolean(data.session));
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
        if (mounted.current) {
          console.log('[AuthContext] initial load complete — setLoading(false)');
          setLoading(false);
        }
      }
    });

    // Auth state changes (sign-in, sign-out, token refresh)
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted.current) return;
      console.log('[AuthContext] onAuthStateChange:', event, '— has session:', Boolean(newSession));

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
        if (mounted.current) {
          console.log('[AuthContext] auth state change settled — setLoading(false)');
          setLoading(false);
        }
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
      signIn,
      verifyOtp,
      signOut,
      refreshProfile,
    }),
    [loading, session, profile, profileError, signIn, verifyOtp, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an <AuthProvider>');
  return ctx;
}
