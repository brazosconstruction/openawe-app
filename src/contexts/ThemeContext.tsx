import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkTheme, lightTheme, Theme } from '../constants/theme';

export type ThemePreference = 'dark' | 'light' | 'system';

const STORAGE_KEY = 'openawe_theme_preference';

interface ThemeContextValue {
  theme: Theme;
  preference: ThemePreference;
  isDark: boolean;
  setPreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: darkTheme,
  preference: 'dark',
  isDark: true,
  setPreference: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('dark');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'dark' || stored === 'light' || stored === 'system') {
          setPreferenceState(stored);
        }
      })
      .catch(() => {
        // silently ignore; keep default
      })
      .finally(() => setLoaded(true));
  }, []);

  const setPreference = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
    AsyncStorage.setItem(STORAGE_KEY, pref).catch(() => {});
  }, []);

  const isDark =
    preference === 'dark' ||
    (preference === 'system' && systemScheme === 'dark') ||
    // When system scheme is null (no detection), default to dark
    (preference === 'system' && systemScheme == null);

  const theme = isDark ? darkTheme : lightTheme;

  if (!loaded) {
    // Render with default dark theme until preference is loaded from storage
    return (
      <ThemeContext.Provider value={{ theme: darkTheme, preference: 'dark', isDark: true, setPreference: () => {} }}>
        {children}
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={{ theme, preference, isDark, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export default ThemeContext;
