import { Linking, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { logService } from './logService';
import { systemNative } from '../utils/systemNative';

export const CURRENT_APP_VERSION = '1.0.4';
export const GITHUB_REPO = 'idkreally001/ostim-app';

export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseName: string;
  releaseNotes: string;
  apkDownloadUrl?: string;
  publishedAt: string;
  htmlUrl: string;
}

/**
 * Compare semantic versions. Returns true if remote is strictly newer than current.
 * e.g., '1.0.1' > '1.0.0' => true
 */
function isRemoteNewer(remote: string, current: string): boolean {
  const clean = (v: string) => v.replace(/^v/i, '').trim();
  const remoteParts = clean(remote).split('.').map(p => parseInt(p, 10) || 0);
  const currentParts = clean(current).split('.').map(p => parseInt(p, 10) || 0);

  const maxLen = Math.max(remoteParts.length, currentParts.length);
  for (let i = 0; i < maxLen; i++) {
    const r = remoteParts[i] || 0;
    const c = currentParts[i] || 0;
    if (r > c) return true;
    if (r < c) return false;
  }
  return false;
}

class UpdateService {
  private cachedUpdate: UpdateInfo | null = null;
  private isChecking = false;

  /**
   * Check GitHub Releases API for the latest published release.
   */
  async checkForUpdates(): Promise<UpdateInfo | null> {
    if (this.isChecking) return this.cachedUpdate;
    this.isChecking = true;

    try {
      const url = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
      const response = await fetch(url, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          logService.info('UpdateService', 'Henüz GitHub üzerinde bir release yayınlanmamış.');
        } else {
          logService.warn('UpdateService', `GitHub API yanıtı: ${response.status}`);
        }
        return null;
      }

      const release = await response.json();
      const latestTag = release.tag_name || '';
      const hasUpdate = isRemoteNewer(latestTag, CURRENT_APP_VERSION);

      // Smart APK selection based on device ABI
      let apkDownloadUrl: string | undefined;
      if (Array.isArray(release.assets)) {
        const deviceAbi = await systemNative.getDeviceAbi();
        let bestAsset = null;

        if (deviceAbi.includes('arm64')) {
          bestAsset = release.assets.find(
            (asset: any) => asset.name && asset.name.includes('arm64-v8a') && asset.name.endsWith('.apk')
          );
        }

        if (!bestAsset) {
          bestAsset = release.assets.find(
            (asset: any) => asset.name && asset.name.includes('universal') && asset.name.endsWith('.apk')
          );
        }

        if (!bestAsset) {
          bestAsset = release.assets.find(
            (asset: any) => asset.name && asset.name.endsWith('.apk')
          );
        }

        if (bestAsset) {
          apkDownloadUrl = bestAsset.browser_download_url;
        }
      }

      const info: UpdateInfo = {
        hasUpdate,
        currentVersion: CURRENT_APP_VERSION,
        latestVersion: latestTag.replace(/^v/i, ''),
        releaseName: release.name || latestTag,
        releaseNotes: release.body || 'Hata düzeltmeleri ve performans iyileştirmeleri.',
        apkDownloadUrl: apkDownloadUrl || release.html_url,
        publishedAt: release.published_at || new Date().toISOString(),
        htmlUrl: release.html_url,
      };

      this.cachedUpdate = info;
      logService.info(
        'UpdateService',
        hasUpdate
          ? `Yeni sürüm bulundu: v${info.latestVersion} (Mevcut: v${CURRENT_APP_VERSION})`
          : `Uygulama güncel: v${CURRENT_APP_VERSION}`
      );

      return info;
    } catch (err: any) {
      logService.warn('UpdateService', 'Güncelleme kontrolü başarısız', err.message);
      return null;
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * In-App download with live progress percentage.
   * Directly triggers Android PackageInstaller on completion without leaving app.
   */
  async downloadAndInstallWithProgress(
    updateInfo: UpdateInfo,
    onProgress: (progress: { percent: number; writtenMb: number; totalMb: number }) => void
  ): Promise<boolean> {
    const apkUrl = updateInfo.apkDownloadUrl;
    if (!apkUrl || Platform.OS !== 'android') {
      await this.downloadAndInstall(updateInfo);
      return false;
    }

    try {
      const fileName = `ostim-app-v${updateInfo.latestVersion}.apk`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

      logService.info('UpdateService', `Uygulama içi indirme başlatıldı: ${fileName}`);

      // Check if already downloaded
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (fileInfo.exists && (fileInfo as any).size > 10 * 1024 * 1024) {
        logService.info('UpdateService', 'APK önbellekte mevcut, doğrudan kuruluyor.');
        const sizeMb = parseFloat(((fileInfo as any).size / (1024 * 1024)).toFixed(1));
        onProgress({ percent: 100, writtenMb: sizeMb, totalMb: sizeMb });
        return await systemNative.installApk(fileUri);
      }

      const downloadResumable = FileSystem.createDownloadResumable(
        apkUrl,
        fileUri,
        {},
        (downloadProgress) => {
          const written = downloadProgress.totalBytesWritten;
          const total = downloadProgress.totalBytesExpectedToWrite;
          const percent = total > 0 ? Math.min(100, Math.round((written / total) * 100)) : 0;
          onProgress({
            percent,
            writtenMb: parseFloat((written / (1024 * 1024)).toFixed(1)),
            totalMb: parseFloat((total / (1024 * 1024)).toFixed(1)),
          });
        }
      );

      const result = await downloadResumable.downloadAsync();
      if (result && result.uri) {
        logService.info('UpdateService', `APK başarıyla indi, paket yükleyici açılıyor: ${result.uri}`);
        onProgress({ percent: 100, writtenMb: 70.5, totalMb: 70.5 });
        return await systemNative.installApk(result.uri);
      } else {
        throw new Error('İndirme dosyası oluşturulamadı.');
      }
    } catch (err: any) {
      logService.error('UpdateService', 'Uygulama içi indirme hatası, tarayıcıya geçiliyor', err.message);
      await this.downloadAndInstall(updateInfo);
      return false;
    }
  }

  /**
   * Trigger direct APK download or browser opening.
   */
  async downloadAndInstall(updateInfo: UpdateInfo): Promise<void> {
    const targetUrl = updateInfo.apkDownloadUrl || updateInfo.htmlUrl;
    try {
      const canOpen = await Linking.canOpenURL(targetUrl);
      if (canOpen) {
        await Linking.openURL(targetUrl);
      } else {
        await Linking.openURL(updateInfo.htmlUrl);
      }
    } catch (err: any) {
      logService.error('UpdateService', 'Güncelleme bağlantısı açılamadı', err.message);
    }
  }

  getCachedUpdate(): UpdateInfo | null {
    return this.cachedUpdate;
  }
}

export const updateService = new UpdateService();
