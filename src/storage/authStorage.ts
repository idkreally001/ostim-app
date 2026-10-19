import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StudentProfile, LmsSessionData, LmsCachedData } from '../types/models';

const KEY_JWT = 'ostim_auth_jwt_token';
const KEY_STUDENT_NO = 'ostim_auth_student_no';
const KEY_CACHED_PROFILE = '@ostim_cached_profile';

const KEY_LMS_SESSION = 'ostim_lms_session_data';
const KEY_CACHED_LMS_DATA = '@ostim_cached_lms_data';

export class AuthStorage {
  public static async saveSession(jwtToken: string, studentNo: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(KEY_JWT, jwtToken);
      await SecureStore.setItemAsync(KEY_STUDENT_NO, studentNo);
    } catch {
      // Fallback for web or environments where SecureStore isn't available
      await AsyncStorage.setItem(KEY_JWT, jwtToken);
      await AsyncStorage.setItem(KEY_STUDENT_NO, studentNo);
    }
  }

  public static async getSession(): Promise<{ jwtToken: string | null; studentNo: string | null }> {
    try {
      const jwtToken = await SecureStore.getItemAsync(KEY_JWT);
      const studentNo = await SecureStore.getItemAsync(KEY_STUDENT_NO);
      if (jwtToken && studentNo) return { jwtToken, studentNo };
    } catch {}

    const jwtToken = await AsyncStorage.getItem(KEY_JWT);
    const studentNo = await AsyncStorage.getItem(KEY_STUDENT_NO);
    return { jwtToken, studentNo };
  }

  public static async clearSession(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(KEY_JWT);
      await SecureStore.deleteItemAsync(KEY_STUDENT_NO);
    } catch {}
    await AsyncStorage.removeItem(KEY_JWT);
    await AsyncStorage.removeItem(KEY_STUDENT_NO);
    await AsyncStorage.removeItem(KEY_CACHED_PROFILE);
  }

  public static async saveCachedProfile(profile: StudentProfile): Promise<void> {
    await AsyncStorage.setItem(KEY_CACHED_PROFILE, JSON.stringify(profile));
  }

  public static async getCachedProfile(): Promise<StudentProfile | null> {
    const raw = await AsyncStorage.getItem(KEY_CACHED_PROFILE);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  // --- LMS Session Storage ---

  public static async saveLmsSession(session: LmsSessionData): Promise<void> {
    const dataStr = JSON.stringify(session);
    try {
      await SecureStore.setItemAsync(KEY_LMS_SESSION, dataStr);
    } catch {
      await AsyncStorage.setItem(KEY_LMS_SESSION, dataStr);
    }
  }

  public static async getLmsSession(): Promise<LmsSessionData | null> {
    let raw: string | null = null;
    try {
      raw = await SecureStore.getItemAsync(KEY_LMS_SESSION);
    } catch {}
    if (!raw) {
      raw = await AsyncStorage.getItem(KEY_LMS_SESSION);
    }
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  public static async clearLmsSession(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(KEY_LMS_SESSION);
    } catch {}
    await AsyncStorage.removeItem(KEY_LMS_SESSION);
    await AsyncStorage.removeItem(KEY_CACHED_LMS_DATA);
  }

  public static async saveCachedLmsData(data: LmsCachedData): Promise<void> {
    await AsyncStorage.setItem(KEY_CACHED_LMS_DATA, JSON.stringify(data));
  }

  public static async getCachedLmsData(): Promise<LmsCachedData | null> {
    const raw = await AsyncStorage.getItem(KEY_CACHED_LMS_DATA);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}

