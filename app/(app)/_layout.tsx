import { Stack } from 'expo-router';

/**
 * Authenticated stack. The bottom-tab navigator lives in the (tabs) group;
 * the kiosk detail route is pushed on top of the tabs as a full-screen card.
 */
export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="kiosk/[id]" options={{ presentation: 'card' }} />
    </Stack>
  );
}
