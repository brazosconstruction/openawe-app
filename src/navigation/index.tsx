import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

import { StorageService } from '../services/storage';
import PairingScreen from '../screens/PairingScreen';
import ChatScreen from '../screens/ChatScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { AppProvider, useApp } from '../contexts/AppContext';
import { useTheme } from '../contexts/ThemeContext';

export type RootStackParamList = {
  Pairing: undefined;
  Chat: undefined;
  Settings: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

function InnerNavigator() {
  const { isPaired } = useApp();
  const { theme, isDark } = useTheme();

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      primary: theme.colors.textPrimary,
      background: theme.colors.background,
      card: theme.colors.background,
      text: theme.colors.textPrimary,
      border: theme.colors.border,
      notification: theme.colors.accent,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.colors.background,
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.colors.border,
          },
          headerTintColor: theme.colors.textPrimary,
          headerTitleStyle: {
            fontWeight: '300',
            fontSize: 18,
            letterSpacing: 1.5,
            color: theme.colors.textPrimary,
          },
          cardStyleInterpolator: CardStyleInterpolators.forFadeFromCenter,
          gestureEnabled: true,
          cardStyle: { backgroundColor: theme.colors.background },
        }}
      >
        {!isPaired ? (
          <Stack.Screen
            name="Pairing"
            component={PairingScreen}
            options={{
              headerShown: false,
            }}
          />
        ) : (
          <>
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={{
                title: 'OPENAWE',
                headerRight: () => <SettingsButton />,
              }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{
                title: 'SETTINGS',
                presentation: 'modal',
                cardStyleInterpolator: CardStyleInterpolators.forVerticalIOS,
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function SettingsButton() {
  const navigation = useNavigation();
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      onPress={() => navigation.navigate('Settings' as never)}
      style={styles.settingsButton}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Feather name="settings" size={20} color={theme.colors.textSecondary} />
    </TouchableOpacity>
  );
}

export default function AppNavigator() {
  const [isLoading, setIsLoading] = useState(true);
  const [initialPaired, setInitialPaired] = useState(false);
  const { theme } = useTheme();

  const checkPairingStatus = useCallback(async () => {
    try {
      const storage = StorageService.getInstance();
      // Primary check: IS_PAIRED flag
      let paired = await storage.isPaired();

      // Fallback: if flag is missing but relay config exists + connected recently (< 24h), treat as paired
      if (!paired) {
        const relayConfig = await storage.getRelayConfig();
        const lastConnectedAt = await storage.getLastConnectedAt();
        const recentThreshold = 24 * 60 * 60 * 1000; // 24 hours
        if (relayConfig && lastConnectedAt && (Date.now() - lastConnectedAt) < recentThreshold) {
          paired = true;
          // Repair the IS_PAIRED flag
          await storage.storeRelayConfig(relayConfig);
        }
      }

      setInitialPaired(paired);
    } catch (error) {
      console.error('Failed to check pairing status:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkPairingStatus();
  }, [checkPairingStatus]);

  if (isLoading) {
    return <View style={[styles.loading, { backgroundColor: theme.colors.background }]} />;
  }

  return (
    <AppProvider initialPaired={initialPaired}>
      <InnerNavigator />
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
  },
  settingsButton: {
    paddingRight: 20,
    paddingLeft: 12,
  },
});
