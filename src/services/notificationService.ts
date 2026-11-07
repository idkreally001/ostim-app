import { Platform, PermissionsAndroid } from 'react-native';
import { systemNative } from '../utils/systemNative';
import { TimetableEntry } from '../types/models';
import { logService } from './logService';
import { userSettingsStorage } from '../storage/userSettingsStorage';

export interface NotificationSettings {
  enabled: boolean;
  leadMinutes: number; // e.g. 10, 15, 20, 30, 45, 60, 90, custom
  selectedDays: number[]; // 0=Mon ... 6=Sun
  soundEnabled: boolean;
}

function getNextLessonTimestamp(dayId: number, startTimeStr: string, leadMinutes: number): number {
  const [hours, minutes] = startTimeStr.split(':').map(Number);
  const now = new Date();
  const currentJsDay = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const currentDayId = currentJsDay === 0 ? 6 : currentJsDay - 1; // 0=Mon, ..., 5=Sat, 6=Sun

  // Calculate day difference
  let daysDiff = (dayId - currentDayId + 7) % 7;

  const targetDate = new Date(now);
  targetDate.setDate(now.getDate() + daysDiff);
  targetDate.setHours(hours, minutes, 0, 0);

  // Subtract lead time
  const triggerTime = targetDate.getTime() - leadMinutes * 60 * 1000;

  // If this time has already passed today, advance to next week (+7 days)
  if (triggerTime <= Date.now()) {
    return triggerTime + 7 * 24 * 60 * 60 * 1000;
  }
  return triggerTime;
}

class NotificationService {
  async getSettings(): Promise<NotificationSettings> {
    const full = await userSettingsStorage.getSettings();
    return full.notifications;
  }

  async saveSettings(settings: NotificationSettings): Promise<void> {
    await userSettingsStorage.updateSettings({ notifications: settings });
    logService.info('NotificationService', 'Bildirim ayarları güncellendi', settings);
  }

  /**
   * Checks and requests runtime notification permission on Android 13+ (API 33+).
   */
  async checkAndRequestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    if (Platform.Version >= 33) {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          {
            title: 'Ders Bildirimi İzni',
            message: 'Ders saatlerinden önce hatırlatma bildirimleri alabilmek için bildirim izni vermeniz gerekir.',
            buttonPositive: 'İzin Ver',
            buttonNegative: 'Vazgeç',
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          logService.warn('NotificationService', 'POST_NOTIFICATIONS izni kullanıcı tarafından verilmedi.');
          return false;
        }
      } catch (err: any) {
        logService.error('NotificationService', 'İzin isteme hatası', err.message);
      }
    }

    return await systemNative.areNotificationsEnabled();
  }

  async areNotificationsEnabled(): Promise<boolean> {
    return await systemNative.areNotificationsEnabled();
  }

  async openNotificationSettings(): Promise<boolean> {
    return await systemNative.openNotificationSettings();
  }

  /**
   * Schedules exact system alarms for all weekly classes.
   * Deduplicates consecutive class hours to prevent multiple alerts for one lecture block.
   */
  async scheduleAllLessonAlarms(timetable: TimetableEntry[]): Promise<number> {
    const settings = await this.getSettings();
    if (!settings.enabled || !timetable || timetable.length === 0) {
      await systemNative.cancelAllLessonAlarms(200);
      return 0;
    }

    // Cancel previously scheduled alarms
    await systemNative.cancelAllLessonAlarms(200);

    // Group consecutive periods of the same course on the same day
    const uniqueClasses = new Map<string, TimetableEntry>();
    for (const entry of timetable) {
      if (!settings.selectedDays.includes(entry.dayId)) continue;
      const key = `${entry.courseCode}-${entry.dayId}`;
      const existing = uniqueClasses.get(key);
      if (!existing || entry.startTime.localeCompare(existing.startTime) < 0) {
        uniqueClasses.set(key, entry);
      }
    }

    let alarmIndex = 0;
    for (const entry of uniqueClasses.values()) {
      const triggerAtMillis = getNextLessonTimestamp(entry.dayId, entry.startTime, settings.leadMinutes);
      const title = `Yaklaşan Ders: ${entry.courseCode}`;
      const instructor = entry.instructor ? ` • ${entry.instructor}` : '';
      const message = `${entry.startTime}'de Başlıyor • Derslik: ${entry.classroom}${instructor}`;
      const alarmId = 1000 + alarmIndex;

      await systemNative.scheduleLessonAlarm(alarmId, triggerAtMillis, title, message);
      alarmIndex++;
    }

    logService.info('NotificationService', `${alarmIndex} ders hatırlatıcı alarmı kuruldu.`);
    return alarmIndex;
  }

  /**
   * Pushes a single immediate test notification.
   */
  async sendTestNotification(): Promise<boolean> {
    const hasPermission = await this.checkAndRequestPermissions();
    if (!hasPermission) {
      return false;
    }

    const title = 'Sıradaki Ders: Algoritmalar & Veri Yapıları';
    const message = "10:30'da Başlıyor • Derslik: D-302 • Öğretim Üyesi: Dr. Öğr. Üyesi";
    logService.info('NotificationService', 'Test bildirimi tetiklendi.');
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
