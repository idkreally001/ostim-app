import { Linking, Platform } from 'react-native';
import { logService } from './logService';

export const CURRENT_APP_VERSION = '1.0.2';
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

      // Find APK asset in release assets
      let apkDownloadUrl: string | undefined;
      if (Array.isArray(release.assets)) {
        const apkAsset = release.assets.find((asset: any) =>
          asset.name && asset.name.endsWith('.apk')
        );
        if (apkAsset) {
          apkDownloadUrl = apkAsset.browser_download_url;
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
