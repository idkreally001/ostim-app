import { NativeModules, Platform } from 'react-native';

const { SystemCookieManager } = NativeModules;

export class AppCookieManager {
  /**
   * Get all cookies for a given URL.
   * On Android, this accesses android.webkit.CookieManager to read even HttpOnly cookies.
   */
  static async getCookies(url: string): Promise<string> {
    if (Platform.OS === 'android' && SystemCookieManager?.getCookies) {
      try {
        const cookies = await SystemCookieManager.getCookies(url);
        return cookies || '';
      } catch (err) {
        console.warn('[CookieManager] Failed to read native cookies:', err);
        return '';
      }
    }

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      return document.cookie || '';
    }

    return '';
  }

  /**
   * Extract a specific cookie value by name from the given URL.
   */
  static async getCookieValue(url: string, name: string): Promise<string | null> {
    const cookieString = await this.getCookies(url);
    if (!cookieString) return null;

    const pairs = cookieString.split(';');
    for (const pair of pairs) {
      const [key, ...valParts] = pair.trim().split('=');
      if (key && key.trim() === name) {
        return valParts.join('=').trim();
      }
    }
    return null;
  }

  /**
   * Clear all system cookies.
   */
  static async clearCookies(): Promise<boolean> {
    if (Platform.OS === 'android' && SystemCookieManager?.clearCookies) {
      try {
        return await SystemCookieManager.clearCookies();
      } catch (err) {
        return false;
      }
    }
    return true;
  }
}
