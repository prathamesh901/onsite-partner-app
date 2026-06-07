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
import { supabase } from '../lib/supabase';
import { UserProfile } from '../lib/types';

interface AuthState {
  /** True until the initial session + profile load completes. */
  loading: boolean;
  /** Current Supabase session (null when signed out). */
  session: Session | null;
  /** Profile from GET /api/auth/me (null until loaded / when signed out). */
  profile: UserProfile | null;
  /** Error from the last profile fetch, if any. */
  profileError: string | null;

  /** Send a 6-digit email OTP code to the given address. */
  signIn: (email: string) => Promise<void>;
  /** Verify the 6-digit code for an email; establishes the session on success. */
  verifyOtp: (email: string, token: string) => Promise<void>;
  /** Sign out and clear the persisted session. */
  signOut: () => Promise<void>;
  /** Re-fetch the profile from the backend. */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

/** Unwrap the /api/auth/me response regardless of nesting shape. */
function unwrapProfile(raw: unknown): UserProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  // DEBUG — remove once confirmed working
  console.log('[AuthContext] /api/auth/me raw response:', JSON.stringify(raw));

  // Handle { profile: { ... } } or { user: { ... } } envelope
  if (obj.profile && typeof obj.profile === 'object') {
    console.log('[AuthContext] unwrapping from .profile key');
    return obj.profile as UserProfile;
  }
  if (obj.user && typeof obj.user === 'object') {
    console.log('[AuthContext] unwrapping from .user key');
    return obj.user as UserProfile;
  }

  // Bare object — check it has at least a status field
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

  const loadProfile = useCallback(async (activeSession: Session | null) => {
    if (!activeSession) {
      setProfile(null);
      setProfileError(null);
      return;
    }

    // DEBUG: confirm the token that will be sent
    const token = activeSession.access_token;
    console.log('[AuthContext] loadProfile: access_token present =', Boolean(token));
    if (token) {
      console.log('[AuthContext] loadProfile: token prefix =', token.slice(0, 20) + '...');
    }

    try {
      const raw = await api.get('/api/auth/me');
      const me = unwrapProfile(raw);
      console.log('[AuthContext] parsed profile =', JSON.stringify(me));
      if (mounted.current) {
        setProfile(me);
        setProfileError(null);
      }
    } catch (e) {
      console.error('[AuthContext] /api/auth/me error:', e);
      if (mounted.current) {
        setProfile(null);
        setProfileError(e instanceof ApiError ? e.message : 'Failed to load profile');
      }
    }
  }, []);

  // Initial load + subscribe to auth changes.
  useEffect(() => {
    mounted.current = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted.current) return;
      setSession(data.session);
      await loadProfile(data.session);
      if (mounted.current) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted.current) return;
      console.log('[AuthContext] onAuthStateChange event =', event, 'has session =', Boolean(newSession));

      // Keep loading=true while the profile fetch is in-flight to prevent
      // RootNavigator from routing with session+null-profile (→ pending screen).
      setLoading(true);
      setSession(newSession);
      await loadProfile(newSession);
      if (mounted.current) setLoading(false);
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
    // onAuthStateChange fires → sets loading=true → fetches profile → sets loading=false
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
