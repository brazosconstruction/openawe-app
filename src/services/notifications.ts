/**
 * notifications.ts — Push notification service for OpenAwe
 *
 * - Requests permissions on launch
 * - Gets the Expo push token
 * - Registers the token with the host via relay so the host can wake
 *   the app when a message arrives while the app is backgrounded
 * - Sets up foreground notification handler
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PUSH_TOKEN_KEY = '@openawe/push_token';

// How notifications look when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Request push notification permissions and return the Expo push token.
 * Returns null if permission is denied or token retrieval fails.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    // Android: set up notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Messages',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FFFFFF',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[notifications] Push permission denied');
      return null;
    }

    // Expo push token (works in Expo Go and standalone builds)
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'openawe', // matches slug in app.json
    });

    const token = tokenData.data;
    console.log('[notifications] Push token:', token);

    // Cache locally
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    return token;
  } catch (err) {
    console.error('[notifications] Failed to get push token:', err);
    return null;
  }
}

/** Retrieve the cached push token (no network call) */
export async function getCachedPushToken(): Promise<string | null> {
  return AsyncStorage.getItem(PUSH_TOKEN_KEY);
}

/**
 * Set up listeners for notifications received while the app is running
 * or tapped from the system tray.
 *
 * onNotification: called when a notification arrives in foreground
 * onNotificationResponse: called when user taps a notification
 */
export function setupNotificationListeners(opts: {
  onNotification?: (notification: Notifications.Notification) => void;
  onNotificationResponse?: (response: Notifications.NotificationResponse) => void;
}): () => void {
  const sub1 = Notifications.addNotificationReceivedListener((notification) => {
    opts.onNotification?.(notification);
  });

  const sub2 = Notifications.addNotificationResponseReceivedListener((response) => {
    opts.onNotificationResponse?.(response);
  });

  return () => {
    sub1.remove();
    sub2.remove();
  };
}
