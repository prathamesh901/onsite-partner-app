import * as Notifications from 'expo-notifications';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Colors, Radius, Spacing, Typography } from '../constants/theme';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { registerForPushNotificationsAsync, sendTokenToBackend } from '../lib/notifications';

// Show notifications even when the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { loading, session, profile, profileError, needsRegistration, refreshProfile, signOut } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const registeredToken = useRef<string | null>(null);
  const notifListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  const isApprovedUser = !loading && !!session && profile?.status === 'approved';

  // Register for push notifications once the user is approved.
  useEffect(() => {
    if (!isApprovedUser) return;

    let cancelled = false;
    (async () => {
      const token = await registerForPushNotificationsAsync();
      if (!token || cancelled) return;
      if (token !== registeredToken.current) {
        registeredToken.current = token;
        await sendTokenToBackend(token);
      }
    })();
    return () => { cancelled = true; };
  }, [isApprovedUser]);

  // Listen for foreground notification taps.
  useEffect(() => {
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, any> | undefined;
      if (!data) return;
      if (data.kiosk_id) {
        router.push(`/(app)/kiosk/${data.kiosk_id}` as any);
      } else if (data.screen === 'alerts') {
        router.replace('/(app)/(tabs)/alerts' as any);
      }
    });
    return () => {
      if (responseListener.current) responseListener.current.remove();
    };
  }, [router]);

  useEffect(() => {
    if (loading) return;
    SplashScreen.hideAsync();

    const group = segments[0];
    const isApproved = profile?.status === 'approved';

    if (!session) {
      // login and register both live in (auth); only the login screen is valid
      // without a session, so send anyone else (incl. a signed-out register) there.
      const onLogin = group === '(auth)' && segments[1] === 'login';
      if (!onLogin) router.replace('/(auth)/login');
      return;
    }

    // If profile failed to load, stay put — the error UI below handles it.
    if (profileError && !profile) return;

    // Authenticated but no profile row yet — must complete the registration form.
    if (needsRegistration) {
      const onRegister = group === '(auth)' && segments[1] === 'register';
      if (!onRegister) router.replace('/(auth)/register');
      return;
    }

    if (!isApproved) {
      if (group !== '(pending)') router.replace('/(pending)/pending');
      return;
    }

    if (group !== '(app)') router.replace('/(app)/(tabs)/kiosks');
  }, [loading, session, profile, profileError, needsRegistration, segments, router]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={[Typography.bodySecondary, { marginTop: Spacing.sm }]}>Loading…</Text>
      </View>
    );
  }

  // Profile fetch failed — show retry instead of blank screen.
  if (session && profileError && !profile) {
    return (
      <View style={styles.center}>
        <Text style={[Typography.h3, { textAlign: 'center' }]}>Couldn't load your profile</Text>
        <Text style={[Typography.bodySecondary, { textAlign: 'center', marginTop: Spacing.xs, paddingHorizontal: Spacing.xl }]}>
          {profileError}
        </Text>
        <TouchableOpacity style={styles.retryBtn} onPress={refreshProfile}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.signOutLink} onPress={signOut}>
          <Text style={[Typography.bodySecondary, { color: Colors.textMuted }]}>Sign out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(pending)" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.xl,
  },
  retryBtn: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  retryText: { color: Colors.white, fontWeight: '700' as const, fontSize: 15 },
  signOutLink: { marginTop: Spacing.md, padding: Spacing.sm },
});
