import { NativeModules, Platform, Linking } from 'react-native';

const { SystemNativeModule } = NativeModules;

export const systemNative = {
  /**
   * Installs an APK file directly using Android PackageInstaller intent.
   * If on Android, triggers the native system installer modal immediately.
   */
  async installApk(fileUriString: string): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    if (SystemNativeModule?.installApk) {
      try {
        return await SystemNativeModule.installApk(fileUriString);
      } catch (err: any) {
        console.warn('SystemNativeModule.installApk failed, falling back:', err);
      }
    }

    try {
      await Linking.openURL(fileUriString);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Displays a single notification with fixed ID 1001.
   * Multiple calls update the existing notification without tray spam (Duolingo-style).
   */
  async showLessonNotification(title: string, message: string): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    if (SystemNativeModule?.showLessonNotification) {
      try {
        return await SystemNativeModule.showLessonNotification(title, message);
      } catch (err) {
        console.warn('showLessonNotification failed:', err);
        return false;
      }
    }
    return false;
  },

  /**
   * Dismisses the single lesson reminder notification.
   */
  async cancelLessonNotification(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    if (SystemNativeModule?.cancelLessonNotification) {
      try {
        return await SystemNativeModule.cancelLessonNotification();
      } catch {
        return false;
      }
    }
    return false;
  },

  /**
   * Checks if app is allowed to schedule exact alarms (Android 12+).
   */
  async canScheduleExactAlarms(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    if (SystemNativeModule?.canScheduleExactAlarms) {
      try {
        return await SystemNativeModule.canScheduleExactAlarms();
      } catch {
        return false;
      }
    }
    return true;
  },

  /**
   * Opens Android Settings page for Exact Alarms permission.
   */
  async openExactAlarmSettings(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    if (SystemNativeModule?.openExactAlarmSettings) {
      try {
        return await SystemNativeModule.openExactAlarmSettings();
      } catch {
        return false;
      }
    }
    return false;
  },
};
