import 'react-native-get-random-values';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import AppNavigator from './src/navigation';
import {
  registerForPushNotifications,
  setupNotificationListeners,
} from './src/services/notifications';
import { RelayService } from './src/services/relay';

function ThemedApp() {
  const { isDark } = useTheme();

  useEffect(() => {
    let cleanupListeners: (() => void) | undefined;

    async function initNotifications() {
      const token = await registerForPushNotifications();

      if (token) {
        // Share token with relay service so it can forward it to the host
        RelayService.getInstance().setPushToken(token);
      }

      // Set up foreground / tap listeners
      cleanupListeners = setupNotificationListeners({
        onNotification: (notification) => {
          console.log('[App] Foreground notification:', notification.request.content.title);
        },
        onNotificationResponse: (response) => {
          // User tapped a notification — relay service will reconnect if needed
          console.log('[App] Notification tapped:', response.notification.request.content.data);
          RelayService.getInstance().reconnectIfNeeded();
        },
      });
    }

    initNotifications();

    return () => {
      cleanupListeners?.();
    };
  }, []);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppNavigator />
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  );
}
