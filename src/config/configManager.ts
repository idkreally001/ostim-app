import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppRuntimeConfig, EncryptedPayload, decryptAppConfig } from '../crypto/configCrypto';
import embeddedPayload from './bundledPayload.json';

const CONFIG_CACHE_KEY = '@ostim_app_runtime_config_v1';

// Decrypt bundled payload if master key is available at build time
const getBundledConfig = (): AppRuntimeConfig => {
  const masterKey = process.env.EXPO_PUBLIC_APP_CONFIG_KEY;
  if (masterKey && embeddedPayload?.cipher) {
    try {
      return decryptAppConfig(embeddedPayload as EncryptedPayload, masterKey);
    } catch (e: any) {
      console.warn('[ConfigManager] Failed to decrypt bundled config.enc:', e.message);
    }
  }
  return {
    version: 1,
    obs: {
      baseUrl: process.env.EXPO_PUBLIC_OBS_BASE_URL || 'https://obs.ostimteknik.edu.tr/ProlizMobileAPI_V4/api',
      aesKey: process.env.EXPO_PUBLIC_OBS_AES_KEY || '',
      uniCode: process.env.EXPO_PUBLIC_OBS_UNI_CODE || 'OST',
      secret: process.env.EXPO_PUBLIC_OBS_SECRET || '',
      uniToken: process.env.EXPO_PUBLIC_OBS_UNI_TOKEN || '',
    },
    lms: {
      tokenUrl: process.env.EXPO_PUBLIC_LMS_TOKEN_URL || 'https://lmsclus.ostimteknik.edu.tr/login/token.php',
      serviceUrl: process.env.EXPO_PUBLIC_LMS_SERVICE_URL || 'https://lmsclus.ostimteknik.edu.tr/webservice/rest/server.php',
    },
  };
};

class ConfigManager {
  private currentConfig: AppRuntimeConfig = getBundledConfig();
  private isLoaded: boolean = false;

  public async initialize(): Promise<AppRuntimeConfig> {
    if (this.isLoaded) return this.currentConfig;

    // 1. Try loading cached config from local storage first (instant, works offline)
    try {
      const cached = await AsyncStorage.getItem(CONFIG_CACHE_KEY);
      if (cached) {
        this.currentConfig = JSON.parse(cached);
      }
    } catch (e) {
      console.warn('[ConfigManager] Failed to read cached config:', e);
    }

    this.isLoaded = true;

    // 2. Asynchronously fetch latest encrypted config from GitHub in background
    this.syncRemoteConfig().catch((err) => {
      console.log('[ConfigManager] Background remote config sync skipped or offline:', err.message);
    });

    return this.currentConfig;
  }

  public getConfig(): AppRuntimeConfig {
    return this.currentConfig;
  }

  public async syncRemoteConfig(): Promise<boolean> {
    const remoteUrl = process.env.EXPO_PUBLIC_REMOTE_CONFIG_URL;
    const masterKey = process.env.EXPO_PUBLIC_APP_CONFIG_KEY;

    if (
      !remoteUrl ||
      !masterKey ||
      remoteUrl.includes('CHANGE_THIS') ||
      remoteUrl.includes('username/ostim-app') ||
      masterKey.includes('CHANGE_THIS')
    ) {
      return false;
    }

    try {
      const res = await fetch(remoteUrl);

      if (!res.ok) {
        throw new Error(`Remote config HTTP error: ${res.status}`);
      }

      const payload: EncryptedPayload = await res.json();
      const decrypted = decryptAppConfig(payload, masterKey);

      if (decrypted && decrypted.version >= (this.currentConfig.version || 0)) {
        this.currentConfig = decrypted;
        await AsyncStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(decrypted));
        console.log(`[ConfigManager] Updated to remote config version ${decrypted.version}`);
        return true;
      }
    } catch (err: any) {
      console.warn('[ConfigManager] Could not fetch remote config:', err.message);
    }

    return false;
  }
}

export const configManager = new ConfigManager();
