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
  bg: '#0c1017',
  card: '#161c28',
  cardAlt: '#1e2638',
  cardBorder: 'rgba(255, 255, 255, 0.08)',
  text: '#f8fafc',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  headerBg: '#10141e',
  navBg: '#10141e',
  inputBg: '#161c28',
  inputBorder: 'rgba(255, 255, 255, 0.12)',
  primary: '#60a5fa',
  primarySubtle: 'rgba(96, 165, 250, 0.15)',
  accent: '#38bdf8',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  statusBarStyle: 'light',
};

const lightColors: ThemeColors = {
  isDark: false,
  bg: '#f4f6fa',
  card: '#ffffff',
  cardAlt: '#f1f5f9',
  cardBorder: '#e2e8f0',
  text: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#64748b',
  headerBg: '#ffffff',
  navBg: '#ffffff',
  inputBg: '#ffffff',
  inputBorder: '#cbd5e1',
  primary: '#2563eb',
  primarySubtle: 'rgba(37, 99, 235, 0.12)',
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
