import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Colors, Radius, Spacing, Typography } from '../constants/theme';
import { AuthProvider, useAuth } from '../context/AuthContext';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { loading, session, profile, profileError, refreshProfile, signOut } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    SplashScreen.hideAsync();

    const group = segments[0];
    const isApproved = profile?.status === 'approved';

    if (!session) {
      if (group !== '(auth)') router.replace('/(auth)/login');
      return;
    }

    // If profile failed to load, stay put — the error UI below handles it.
    if (profileError && !profile) return;

    if (!isApproved) {
      if (group !== '(pending)') router.replace('/(pending)/pending');
      return;
    }

    if (group !== '(app)') router.replace('/(app)/kiosks');
  }, [loading, session, profile, profileError, segments, router]);

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
      <Stack.Screen name="kiosk" />
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
