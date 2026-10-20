import AsyncStorage from '@react-native-async-storage/async-storage';
import { systemNative } from '../utils/systemNative';
import { TimetableEntry } from '../types/models';
import { logService } from './logService';

export interface NotificationSettings {
  enabled: boolean;
  leadMinutes: number; // e.g. 10, 15, 30, 60
  selectedDays: number[]; // 0=Mon ... 4=Fri
  soundEnabled: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  leadMinutes: 15,
  selectedDays: [0, 1, 2, 3, 4],
  soundEnabled: true,
};

const STORAGE_KEY = '@ostim_notification_settings';

class NotificationService {
  private cachedSettings: NotificationSettings = DEFAULT_SETTINGS;
  private isLoaded = false;

  async getSettings(): Promise<NotificationSettings> {
    if (this.isLoaded) return this.cachedSettings;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.cachedSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      }
    } catch (e: any) {
      logService.warn('NotificationService', 'Ayar yükleme hatası', e.message);
    }
    this.isLoaded = true;
    return this.cachedSettings;
  }

  async saveSettings(settings: NotificationSettings): Promise<void> {
    this.cachedSettings = settings;
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      logService.info('NotificationService', 'Bildirim ayarları güncellendi', settings);
    } catch (e: any) {
      logService.error('NotificationService', 'Ayar kaydetme hatası', e.message);
    }
  }

  /**
   * Pushes a single, deduplicated test notification.
   * Multiple triggers will update the single existing notification in place (Duolingo-style).
   */
  async sendTestNotification(): Promise<boolean> {
    const title = '🔔 Sıradaki Ders: Algoritmalar & Veri Yapıları';
    const message = '10:30\'da Başlıyor • Derslik: D-302 • Öğretim Üyesi: Dr. Öğr. Üyesi';
    logService.info('NotificationService', 'Test bildirimi tetiklendi (Single-slot)');
    return await systemNative.showLessonNotification(title, message);
  }

  /**
   * Sends or updates the reminder for an upcoming lecture.
   */
  async notifyUpcomingClass(entry: TimetableEntry): Promise<boolean> {
    const settings = await this.getSettings();
    if (!settings.enabled) return false;

    // Check day filter
    if (!settings.selectedDays.includes(entry.dayId)) {
      return false;
    }

    const title = `📚 Sıradaki Ders: ${entry.courseName || entry.courseCode}`;
    const instructorPart = entry.instructor ? ` • ${entry.instructor}` : '';
    const message = `${entry.startTime}'de Başlıyor • Derslik: ${entry.classroom}${instructorPart}`;

    return await systemNative.showLessonNotification(title, message);
  }

  async dismissNotification(): Promise<boolean> {
    return await systemNative.cancelLessonNotification();
  }

  async canScheduleExactAlarms(): Promise<boolean> {
    return await systemNative.canScheduleExactAlarms();
  }

  async openExactAlarmSettings(): Promise<boolean> {
    return await systemNative.openExactAlarmSettings();
  }
}

export const notificationService = new NotificationService();
