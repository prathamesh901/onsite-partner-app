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
    try {
      const me = await api.get<UserProfile>('/api/auth/me');
      if (mounted.current) {
        setProfile(me);
        setProfileError(null);
      }
    } catch (e) {
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

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted.current) return;
      setSession(newSession);
      await loadProfile(newSession);
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
    // onAuthStateChange will fire and load the profile.
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
