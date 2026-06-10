import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import Constants from 'expo-constants';

import { api } from './api';

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Push notifications require a physical device.
  if (!Device.isDevice) {
    console.log('[Push] Skipping — not a physical device (simulator/Expo Go).');
    return null;
  }

  // Request / check permissions.
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.log('[Push] Permission not granted.');
    return null;
  }

  // Android: ensure a notification channel exists.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#38BDF8',
    });
  }

  // Get Expo push token.
  const projectId: string | undefined =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    console.log('[Push] No EAS projectId configured — skipping token registration.');
    return null;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenData.data;
  } catch (err) {
    console.log('[Push] getExpoPushTokenAsync failed:', err);
    return null;
  }
}

export async function sendTokenToBackend(token: string): Promise<void> {
  try {
    await api.post('/api/push/register', { expo_push_token: token });
    console.log('[Push] Token registered with backend.');
  } catch (err) {
    // Non-fatal — app still works without push.
    console.log('[Push] Failed to register token with backend:', err);
  }
}
