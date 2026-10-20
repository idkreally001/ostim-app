import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'system' | 'dark' | 'light';

export interface ThemeColors {
  isDark: boolean;
  bg: string;
  card: string;
  cardAlt: string;
  cardBorder: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  headerBg: string;
  navBg: string;
  inputBg: string;
  inputBorder: string;
  primary: string;
  primarySubtle: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  statusBarStyle: 'light' | 'dark';
}

const darkColors: ThemeColors = {
  isDark: true,
  bg: '#090d16',
  card: '#111827',
  cardAlt: '#1e293b',
  cardBorder: '#1e293b',
  text: '#f8fafc',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  headerBg: '#090d16',
  navBg: '#111827',
  inputBg: '#0f172a',
  inputBorder: '#1e293b',
  primary: '#2563eb',
  primarySubtle: 'rgba(37, 99, 235, 0.15)',
  accent: '#38bdf8',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  statusBarStyle: 'light',
};

const lightColors: ThemeColors = {
  isDark: false,
  bg: '#f1f5f9',
  card: '#ffffff',
  cardAlt: '#f8fafc',
  cardBorder: '#e2e8f0',
  text: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  headerBg: '#ffffff',
  navBg: '#ffffff',
  inputBg: '#f8fafc',
  inputBorder: '#cbd5e1',
  primary: '#1d4ed8',
  primarySubtle: 'rgba(29, 78, 216, 0.1)',
  accent: '#0284c7',
  success: '#059669',
  warning: '#d97706',
  danger: '#dc2626',
  statusBarStyle: 'dark',
};

interface ThemeContextType {
  themeMode: ThemeMode;
  colors: ThemeColors;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'system',
  colors: darkColors,
  setThemeMode: () => {},
});

const THEME_STORAGE_KEY = '@ostim_theme_preference';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((saved) => {
      if (saved === 'dark' || saved === 'light' || saved === 'system') {
        setThemeModeState(saved as ThemeMode);
      }
    });
  }, []);

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
  };

  const isDark =
    themeMode === 'system' ? systemScheme !== 'light' : themeMode === 'dark';

  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ themeMode, colors, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
