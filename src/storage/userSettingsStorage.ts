import AsyncStorage from '@react-native-async-storage/async-storage';
import { logService } from '../services/logService';

export interface AppUserSettings {
  schemaVersion: number;
  themeMode: 'system' | 'dark' | 'light';
  language: string; // 'tr' | 'en' | 'az' | 'ru' | 'ar' | 'fr' | 'fa'
  isSimulatorEnabled: boolean;
  notifications: {
    enabled: boolean;
    leadMinutes: number; // custom duration in minutes
    selectedDays: number[]; // 0=Mon ... 6=Sun
    soundEnabled: boolean;
  };
}

const SETTINGS_KEY = '@ostimone_user_settings_v2';
const LEGACY_THEME_KEY = '@ostim_theme_mode';
const LEGACY_NOTIF_KEY = '@ostim_notification_settings';
const LEGACY_SIMULATOR_KEY = '@ostim_tool_agno_simulator';

export const DEFAULT_USER_SETTINGS: AppUserSettings = {
  schemaVersion: 2,
  themeMode: 'system',
  language: 'tr',
  isSimulatorEnabled: true,
  notifications: {
    enabled: false,
    leadMinutes: 15,
    selectedDays: [0, 1, 2, 3, 4, 5], // Mon - Sat default
    soundEnabled: true,
  },
};

class UserSettingsStorage {
  private cachedSettings: AppUserSettings = { ...DEFAULT_USER_SETTINGS };
  private isLoaded: boolean = false;
  private loadPromise: Promise<AppUserSettings> | null = null;

  /**
   * Initializes and loads user settings from persistent storage.
   * Seamlessly migrates legacy v1 keys if upgrading from older versions.
   */
  public async getSettings(): Promise<AppUserSettings> {
    if (this.isLoaded) return this.cachedSettings;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(SETTINGS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          this.cachedSettings = {
            ...DEFAULT_USER_SETTINGS,
            ...parsed,
            notifications: {
              ...DEFAULT_USER_SETTINGS.notifications,
              ...(parsed.notifications || {}),
              // Ensure Saturday (5) is included if days array only had 0..4
              selectedDays: Array.isArray(parsed.notifications?.selectedDays)
                ? parsed.notifications.selectedDays
                : DEFAULT_USER_SETTINGS.notifications.selectedDays,
            },
          };
        } else {
          // Check and migrate legacy keys
          await this.migrateLegacySettings();
        }
      } catch (e: any) {
        logService.warn('UserSettingsStorage', 'Failed to load settings:', e.message);
      } finally {
        this.isLoaded = true;
        this.loadPromise = null;
      }
      return this.cachedSettings;
    })();

    return this.loadPromise;
  }

  private async migrateLegacySettings() {
    try {
      const [legacyTheme, legacyNotif, legacySim] = await Promise.all([
        AsyncStorage.getItem(LEGACY_THEME_KEY),
        AsyncStorage.getItem(LEGACY_NOTIF_KEY),
        AsyncStorage.getItem(LEGACY_SIMULATOR_KEY),
      ]);

      const migrated: AppUserSettings = { ...DEFAULT_USER_SETTINGS };

      if (legacyTheme === 'light' || legacyTheme === 'dark' || legacyTheme === 'system') {
        migrated.themeMode = legacyTheme;
      }

      if (legacyNotif) {
        try {
          const parsedNotif = JSON.parse(legacyNotif);
          migrated.notifications = {
            ...DEFAULT_USER_SETTINGS.notifications,
            ...parsedNotif,
          };
        } catch {}
      }

      if (legacySim !== null) {
        migrated.isSimulatorEnabled = legacySim === 'true';
      }

      this.cachedSettings = migrated;
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(migrated));
      logService.info('UserSettingsStorage', 'Successfully migrated legacy settings to v2 store.');
    } catch (err: any) {
      logService.warn('UserSettingsStorage', 'Legacy migration skipped:', err.message);
    }
  }

  /**
   * Persists partial or full settings updates safely.
   */
  public async updateSettings(partial: Partial<AppUserSettings>): Promise<AppUserSettings> {
    const current = await this.getSettings();
    const updated: AppUserSettings = {
      ...current,
      ...partial,
      notifications: partial.notifications
        ? { ...current.notifications, ...partial.notifications }
        : current.notifications,
    };

    this.cachedSettings = updated;
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    } catch (e: any) {
      logService.error('UserSettingsStorage', 'Failed to save settings:', e.message);
    }
    return updated;
  }
}

export const userSettingsStorage = new UserSettingsStorage();
