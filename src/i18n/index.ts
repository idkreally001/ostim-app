import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import tr from '../locales/tr.json';
import en from '../locales/en.json';
import az from '../locales/az.json';
import ru from '../locales/ru.json';
import ar from '../locales/ar.json';
import fr from '../locales/fr.json';
import fa from '../locales/fa.json';

export type SupportedLanguage = 'tr' | 'en' | 'az' | 'ru' | 'ar' | 'fr' | 'fa';

export interface LanguageInfo {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
  isRtl?: boolean;
}

export const LANGUAGE_STORAGE_KEY = '@ostimone_language_v1';

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'tr', name: 'Türkçe', nativeName: 'Türkçe', flag: '🇹🇷' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'az', name: 'Azerbaijani', nativeName: 'Azərbaycan', flag: '🇦🇿' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', isRtl: true },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی', flag: '🇮🇷', isRtl: true },
];

const translations: Record<SupportedLanguage, Record<string, any>> = {
  tr,
  en,
  az,
  ru,
  ar,
  fr,
  fa,
};

/**
 * Checks whether a language code uses Right-to-Left (RTL) script.
 */
export function isRtl(lang: string): boolean {
  return lang === 'ar' || lang === 'fa';
}

/**
 * Detects the system language on iOS, Android, and Web platforms.
 * Uses system locale if it starts with 'az', 'en', 'ru', 'ar', 'fr', 'fa', else defaults to 'tr'.
 */
export function detectSystemLanguage(): SupportedLanguage {
  try {
    let locale = '';
    if (Platform.OS === 'ios') {
      locale =
        NativeModules.SettingsManager?.settings?.AppleLocale ||
        NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] ||
        '';
    } else if (Platform.OS === 'android') {
      locale = NativeModules.I18nManager?.localeIdentifier || '';
    }

    if (!locale && typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
      locale = Intl.DateTimeFormat().resolvedOptions().locale || '';
    }

    const lower = locale.toLowerCase().replace(/_/g, '-');
    const validCodes: SupportedLanguage[] = ['az', 'en', 'ru', 'ar', 'fr', 'fa'];

    for (const code of validCodes) {
      if (lower.startsWith(code)) {
        return code;
      }
    }
  } catch {
    // Default to 'tr' on any detection failure
  }
  return 'tr';
}

// Module-level tracking for standalone t() invocations outside React components
let currentGlobalLanguage: SupportedLanguage = 'tr';

/**
 * Resolves a nested key string (e.g. 'dashboard.greeting') with parameter interpolation.
 * Parameters can be provided as {{key}} or {key}.
 */
export function t(
  key: string,
  params?: Record<string, string | number>,
  langOverride?: SupportedLanguage
): string {
  const targetLang = langOverride || currentGlobalLanguage;
  const targetDict = translations[targetLang] || translations.tr;
  const fallbackDict = translations.tr;

  const resolvePath = (dict: Record<string, any>, path: string): any => {
    return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), dict);
  };

  let value = resolvePath(targetDict, key);
  if (value === undefined || value === null) {
    value = resolvePath(fallbackDict, key);
  }

  if (typeof value !== 'string') {
    return key;
  }

  if (params) {
    return value.replace(/\{\{\s*(\w+)\s*\}\}|\{\s*(\w+)\s*\}/g, (_match, p1, p2) => {
      const paramKey = p1 || p2;
      return params[paramKey] !== undefined ? String(params[paramKey]) : _match;
    });
  }

  return value;
}

export interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
  isRtl: boolean;
  currentLanguageInfo: LanguageInfo;
  languages: LanguageInfo[];
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'tr',
  setLanguage: async () => {},
  t: (key: string, params?: Record<string, string | number>) => t(key, params, 'tr'),
  isRtl: false,
  currentLanguageInfo: SUPPORTED_LANGUAGES[0],
  languages: SUPPORTED_LANGUAGES,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<SupportedLanguage>('tr');

  // Load persisted language or detect system language on startup
  useEffect(() => {
    const initLanguage = async () => {
      try {
        const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (saved && (saved in translations)) {
          const validLang = saved as SupportedLanguage;
          currentGlobalLanguage = validLang;
          setLanguageState(validLang);
          return;
        }

        const detected = detectSystemLanguage();
        currentGlobalLanguage = detected;
        setLanguageState(detected);
      } catch {
        const fallback = detectSystemLanguage();
        currentGlobalLanguage = fallback;
        setLanguageState(fallback);
      }
    };

    initLanguage();
  }, []);

  const changeLanguage = useCallback(async (newLang: SupportedLanguage) => {
    if (newLang in translations) {
      currentGlobalLanguage = newLang;
      setLanguageState(newLang);
      try {
        await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
      } catch (err) {
        console.warn('Failed to persist language preference:', err);
      }
    }
  }, []);

  const translate = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      return t(key, params, language);
    },
    [language]
  );

  const isCurrentRtl = useMemo(() => isRtl(language), [language]);

  const currentLanguageInfo = useMemo(() => {
    return SUPPORTED_LANGUAGES.find((item) => item.code === language) || SUPPORTED_LANGUAGES[0];
  }, [language]);

  const contextValue = useMemo<LanguageContextType>(
    () => ({
      language,
      setLanguage: changeLanguage,
      t: translate,
      isRtl: isCurrentRtl,
      currentLanguageInfo,
      languages: SUPPORTED_LANGUAGES,
    }),
    [language, changeLanguage, translate, isCurrentRtl, currentLanguageInfo]
  );

  return React.createElement(LanguageContext.Provider, { value: contextValue }, children);
};

/**
 * Custom React hook for consuming internationalization within components.
 */
export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
