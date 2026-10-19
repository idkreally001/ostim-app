import { Platform, Linking } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { AppAlert } from './alertHelper';
import { logService } from '../services/logService';

export class FileHelper {
  /**
   * Export text content (e.g. CSV, ICS, JSON) to a file and share/download it.
   */
  static async exportAndShareFile(
    filename: string,
    content: string,
    mimeType: string = 'text/csv'
  ): Promise<void> {
    try {
      // 1. Web Implementation: Blob download via anchor tag
      if (Platform.OS === 'web') {
        if (typeof document !== 'undefined') {
          const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.setAttribute('href', url);
          link.setAttribute('download', filename);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          logService.info('FileHelper', `Dosya indirildi (Web): ${filename}`);
        }
        return;
      }

      // 2. Android / iOS Implementation: Write to cacheDirectory and trigger native share sheet
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType,
          dialogTitle: `${filename} dosyasını kaydet veya paylaş`,
        });
        logService.info('FileHelper', `Dosya başarıyla paylaşıldı (Native): ${filename}`);
      } else {
        AppAlert.alert('Başarılı', `${filename} cihazınıza kaydedildi.`);
      }
    } catch (err: any) {
      logService.error('FileHelper', `Dosya dışa aktarma hatası: ${filename}`, err.message);
      AppAlert.alert('Dosya Hatası', `Dosya oluşturulurken bir hata oluştu: ${err.message}`);
    }
  }

  /**
   * Download a remote file (with optional auth headers like MoodleSession) and open it.
   */
  static async downloadAndOpenFile(
    url: string,
    filename: string,
    headers: Record<string, string> = {}
  ): Promise<void> {
    try {
      // 1. Web Implementation: Open in new tab
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
        return;
      }

      // 2. Android / iOS Implementation: Download authenticated file and open via Share Sheet / Viewer
      const safeFilename = filename.replace(/[/\\?%*:|"<>]/g, '_');
      const destination = `${FileSystem.cacheDirectory}${safeFilename}`;

      logService.info('FileHelper', `Dosya indiriliyor: ${safeFilename}`);

      const downloadResult = await FileSystem.downloadAsync(url, destination, {
        headers,
      });

      if (downloadResult.status !== 200) {
        logService.warn('FileHelper', `İndirme HTTP ${downloadResult.status} döndü. Web tarayıcısına yönlendiriliyor.`);
        await Linking.openURL(url);
        return;
      }

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(downloadResult.uri, {
          dialogTitle: safeFilename,
        });
      } else {
        AppAlert.alert('İndirildi', `${safeFilename} başarıyla indirildi.`);
      }
    } catch (err: any) {
      logService.warn('FileHelper', `Native indirme başarısız, tarayıcıda açılıyor: ${err.message}`);
      // Graceful fallback to Linking.openURL
      try {
        await Linking.openURL(url);
      } catch {
        AppAlert.alert('Hata', 'Dosya açılamadı.');
      }
    }
  }
}
