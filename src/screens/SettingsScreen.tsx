import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { CURRENT_APP_VERSION, GITHUB_REPO, updateService, UpdateInfo } from '../services/updateService';
import { logService, LogEntry } from '../services/logService';
import { AuthStorage } from '../storage/authStorage';
import { AppAlert } from '../utils/alertHelper';
import { FileHelper } from '../utils/fileHelper';
import { UpdateModal } from '../components/UpdateModal';

interface SettingsScreenProps {
  onClose: () => void;
  isObsAuthenticated: boolean;
  isLmsAuthenticated: boolean;
  onObsLogout?: () => void;
  onLmsLogout?: () => void;
  onFullLogout?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onClose,
  isObsAuthenticated,
  isLmsAuthenticated,
  onObsLogout,
  onLmsLogout,
  onFullLogout,
}) => {
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<string | null>(null);

  // Logs modal state
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logFilter, setLogFilter] = useState<'all' | 'error'>('all');

  useEffect(() => {
    setLogs(logService.getLogs());
    const unsub = logService.subscribe(() => {
      setLogs(logService.getLogs());
    });
    return unsub;
  }, []);

  const openUrl = async (url: string) => {
    try {
      const can = await Linking.canOpenURL(url);
      if (can) {
        await Linking.openURL(url);
      } else {
        AppAlert.alert('Hata', 'Bağlantı açılamadı: ' + url);
      }
    } catch (err: any) {
      AppAlert.alert('Hata', err.message);
    }
  };

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    try {
      const info = await updateService.checkForUpdates();
      setLastCheckTime(new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }));
      if (!info) {
        AppAlert.alert(
          'Güncelleme Kontrolü',
          'GitHub sunucusuna erişilemedi veya henüz bir sürüm yayınlanmamış.'
        );
      } else if (info.hasUpdate) {
        setUpdateInfo(info);
        setShowUpdateModal(true);
      } else {
        AppAlert.alert(
          'Uygulama Güncel',
          `Tebrikler! En güncel sürümü (v${CURRENT_APP_VERSION}) kullanıyorsunuz.`
        );
      }
    } catch (err: any) {
      AppAlert.alert('Hata', 'Güncelleme kontrolü sırasında sorun oluştu: ' + err.message);
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleClearCache = async () => {
    AppAlert.confirm(
      'Önbelleği Temizle',
      'Çevrimdışı kaydedilmiş ders programı, notlar ve devam durumu verileri temizlenecektir. Oturumunuz açık kalacaktır.',
      async () => {
        try {
          await Promise.all([
            AuthStorage.saveCachedTimetable([]),
            AuthStorage.saveCachedProfile(null as any),
            AuthStorage.saveCachedAttendance([]),
            AuthStorage.saveCachedTerms([]),
          ]);
          logService.info('Settings', 'Kullanıcı yerel önbelleği temizledi.');
          AppAlert.alert('Başarılı', 'Yerel çevrimdışı önbellek başarıyla temizlendi.');
        } catch (err: any) {
          AppAlert.alert('Hata', 'Önbellek temizlenemedi: ' + err.message);
        }
      },
      undefined,
      'Temizle',
      'İptal'
    );
  };

  const handleExportLogs = async () => {
    if (logs.length === 0) {
      AppAlert.alert('Bilgi', 'Dışa aktarılacak günlük kaydı yok.');
      return;
    }
    const content = logs
      .map(
        (l) =>
          `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.tag}] ${l.message} ${
            l.details ? l.details : ''
          }`
      )
      .join('\n');

    await FileHelper.exportAndShareFile('ostim_app_logs.txt', content, 'text/plain');
  };

  const filteredLogs = logFilter === 'error' ? logs.filter((l) => l.level === 'error') : logs;
  const errorCount = logs.filter((l) => l.level === 'error').length;

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>⚙️ Ayarlar & Hakkında</Text>
        <View style={styles.headerRightSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* App Info Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>OSTİM</Text>
          </View>
          <Text style={styles.appName}>Ostim Mobil</Text>
          <Text style={styles.appDesc}>
            OSTİM Teknik Üniversitesi Öğrenci Bilgi Sistemi (OBS) & Moodle LMS Asistanı
          </Text>
          <View style={styles.versionRow}>
            <View style={styles.versionBadge}>
              <Text style={styles.versionBadgeText}>Sürüm v{CURRENT_APP_VERSION}</Text>
            </View>
            <View style={styles.buildBadge}>
              <Text style={styles.buildBadgeText}>Build 2 (Android)</Text>
            </View>
          </View>
        </View>

        {/* Section 1: Update & Server */}
        <Text style={styles.sectionHeader}>GÜNCELLEME & DAĞITIM</Text>
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <View style={styles.cardRowLeft}>
              <Text style={styles.cardRowTitle}>GitHub Dağıtım Sunucusu</Text>
              <Text style={styles.cardRowSub}>
                {lastCheckTime ? `Son kontrol: ${lastCheckTime}` : 'Otomatik OTA güncelleme aktif'}
              </Text>
            </View>
            <View style={styles.statusDotRow}>
              <View style={styles.statusDotGreen} />
              <Text style={styles.statusDotText}>Bağlı</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.actionBtn, checkingUpdate && styles.actionBtnDisabled]}
            onPress={handleCheckUpdate}
            disabled={checkingUpdate}
            activeOpacity={0.8}
          >
            {checkingUpdate ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.actionBtnText}>🔄 Güncellemeleri Denetle</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Section 2: Open Source & Developer */}
        <Text style={styles.sectionHeader}>GELİŞTİRİCİ & KAYNAK KOD</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.navRow}
            onPress={() => openUrl(`https://github.com/${GITHUB_REPO}`)}
            activeOpacity={0.7}
          >
            <View style={styles.navRowLeft}>
              <Text style={styles.navRowIcon}>🐙</Text>
              <View>
                <Text style={styles.navRowTitle}>GitHub Deposu</Text>
                <Text style={styles.navRowSub}>github.com/{GITHUB_REPO}</Text>
              </View>
            </View>
            <Text style={styles.navRowArrow}>↗</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.navRow}
            onPress={() => openUrl(`https://github.com/${GITHUB_REPO}/releases`)}
            activeOpacity={0.7}
          >
            <View style={styles.navRowLeft}>
              <Text style={styles.navRowIcon}>🏷️</Text>
              <View>
                <Text style={styles.navRowTitle}>Sürüm Notları (Changelog)</Text>
                <Text style={styles.navRowSub}>Yayınlanan tüm APK ve sürümleri incele</Text>
              </View>
            </View>
            <Text style={styles.navRowArrow}>↗</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.navRow}
            onPress={() => openUrl(`https://github.com/${GITHUB_REPO}/issues`)}
            activeOpacity={0.7}
          >
            <View style={styles.navRowLeft}>
              <Text style={styles.navRowIcon}>💬</Text>
              <View>
                <Text style={styles.navRowTitle}>Hata & İstek Bildir (Issues)</Text>
                <Text style={styles.navRowSub}>Geri bildirim veya öneri paylaş</Text>
              </View>
            </View>
            <Text style={styles.navRowArrow}>↗</Text>
          </TouchableOpacity>
        </View>

        {/* Section 3: Logs & Diagnostics */}
        <Text style={styles.sectionHeader}>SİSTEM VE TANI GÜNLÜKLERİ</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.navRow}
            onPress={() => setShowLogsModal(true)}
            activeOpacity={0.7}
          >
            <View style={styles.navRowLeft}>
              <Text style={styles.navRowIcon}>📋</Text>
              <View>
                <Text style={styles.navRowTitle}>Sistem ve Hata Günlükleri</Text>
                <Text style={styles.navRowSub}>
                  {logs.length} toplam kayıt {errorCount > 0 ? `(${errorCount} hata)` : ''}
                </Text>
              </View>
            </View>
            <View style={styles.logBadgeContainer}>
              {errorCount > 0 ? (
                <View style={styles.errorPill}>
                  <Text style={styles.errorPillText}>{errorCount}</Text>
                </View>
              ) : null}
              <Text style={styles.navRowArrow}>→</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Section 4: Data & Cache */}
        <Text style={styles.sectionHeader}>VERİ VE ÖNBELLEK YÖNETİMİ</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.navRow} onPress={handleClearCache} activeOpacity={0.7}>
            <View style={styles.navRowLeft}>
              <Text style={styles.navRowIcon}>🧹</Text>
              <View>
                <Text style={styles.navRowTitle}>Çevrimdışı Önbelleği Temizle</Text>
                <Text style={styles.navRowSub}>Kayıtlı ders programı ve notları sıfırlar</Text>
              </View>
            </View>
            <Text style={styles.navRowArrow}>🗑️</Text>
          </TouchableOpacity>

          {isObsAuthenticated || isLmsAuthenticated ? (
            <>
              <View style={styles.divider} />

              {isObsAuthenticated && onObsLogout ? (
                <TouchableOpacity style={styles.navRow} onPress={onObsLogout} activeOpacity={0.7}>
                  <View style={styles.navRowLeft}>
                    <Text style={styles.navRowIcon}>🎓</Text>
                    <View>
                      <Text style={styles.navRowTitle}>Sadece OBS Oturumunu Kapat</Text>
                      <Text style={styles.navRowSub}>LMS oturumunuz açık kalır</Text>
                    </View>
                  </View>
                  <Text style={styles.logoutArrow}>🚪</Text>
                </TouchableOpacity>
              ) : null}

              {isLmsAuthenticated && onLmsLogout ? (
                <TouchableOpacity style={styles.navRow} onPress={onLmsLogout} activeOpacity={0.7}>
                  <View style={styles.navRowLeft}>
                    <Text style={styles.navRowIcon}>📚</Text>
                    <View>
                      <Text style={styles.navRowTitle}>Sadece LMS Oturumunu Kapat</Text>
                      <Text style={styles.navRowSub}>OBS oturumunuz açık kalır</Text>
                    </View>
                  </View>
                  <Text style={styles.logoutArrow}>🚪</Text>
                </TouchableOpacity>
              ) : null}

              {onFullLogout ? (
                <TouchableOpacity
                  style={[styles.navRow, styles.fullLogoutRow]}
                  onPress={onFullLogout}
                  activeOpacity={0.7}
                >
                  <View style={styles.navRowLeft}>
                    <Text style={styles.navRowIcon}>🛑</Text>
                    <View>
                      <Text style={[styles.navRowTitle, styles.fullLogoutText]}>
                        Tüm Oturumları Kapat (Tam Çıkış)
                      </Text>
                      <Text style={styles.navRowSub}>Tüm sistemlerden güvenle çıkış yap</Text>
                    </View>
                  </View>
                  <Text style={styles.fullLogoutArrow}>✕</Text>
                </TouchableOpacity>
              ) : null}
            </>
          ) : null}
        </View>

        {/* Section 5: License & Security Notice */}
        <Text style={styles.sectionHeader}>GÜVENLİK & LİSANS</Text>
        <View style={styles.card}>
          <View style={styles.securityItem}>
            <Text style={styles.securityTitle}>🔒 Sıfır Bilgi Güvenliği</Text>
            <Text style={styles.securityText}>
              Giriş kimlik bilgileriniz (şifreler, OBS JWT anahtarları ve MoodleSession çerezleri)
              hiçbir aracı sunucuya aktarılmaz. Yalnızca cihazınızda güvenli bir şekilde saklanır ve
              doğrudan resmi üniversite sunucularıyla haberleşir.
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.securityItem}>
            <Text style={styles.securityTitle}>📄 MIT Lisansı</Text>
            <Text style={styles.securityText}>
              Bu uygulama açık kaynaklı olup MIT lisansı kapsamında geliştirilmektedir. Üniversite
              öğrencilerine ders programı ve akademik takipleri için bağımsız bir kolaylık sunar.
            </Text>
          </View>
        </View>

        <View style={styles.footerSpacing} />
      </ScrollView>

      {/* GitHub Releases In-App Update Modal */}
      <UpdateModal
        visible={showUpdateModal}
        updateInfo={updateInfo}
        onDismiss={() => setShowUpdateModal(false)}
      />

      {/* Detailed Logs Modal */}
      <Modal
        visible={showLogsModal}
        animationType="slide"
        onRequestClose={() => setShowLogsModal(false)}
      >
        <View style={styles.modalLogsContainer}>
          <View style={styles.modalLogsHeader}>
            <TouchableOpacity onPress={() => setShowLogsModal(false)}>
              <Text style={styles.modalLogsClose}>✕ Kapat</Text>
            </TouchableOpacity>
            <Text style={styles.modalLogsTitle}>📋 Sistem Günlükleri</Text>
            <TouchableOpacity onPress={handleExportLogs}>
              <Text style={styles.modalLogsExport}>📤 Paylaş</Text>
            </TouchableOpacity>
          </View>

          {/* Filter Bar */}
          <View style={styles.logFiltersRow}>
            <TouchableOpacity
              style={[styles.filterChip, logFilter === 'all' && styles.filterChipActive]}
              onPress={() => setLogFilter('all')}
            >
              <Text style={[styles.filterChipText, logFilter === 'all' && styles.filterChipTextActive]}>
                Tümü ({logs.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, logFilter === 'error' && styles.filterChipActive]}
              onPress={() => setLogFilter('error')}
            >
              <Text
                style={[
                  styles.filterChipText,
                  logFilter === 'error' && styles.filterChipTextActive,
                ]}
              >
                Hatalar ({errorCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.clearLogsBtn}
              onPress={() => {
                logService.clear();
              }}
            >
              <Text style={styles.clearLogsText}>🗑️ Temizle</Text>
            </TouchableOpacity>
          </View>

          {/* Logs List */}
          <ScrollView style={styles.modalLogsScroll} contentContainerStyle={styles.modalLogsContent}>
            {filteredLogs.length === 0 ? (
              <View style={styles.emptyLogsBox}>
                <Text style={styles.emptyLogsText}>Kayıtlı günlük bulunmuyor.</Text>
              </View>
            ) : (
              filteredLogs.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.logEntry,
                    item.level === 'error' && styles.logEntryError,
                    item.level === 'warn' && styles.logEntryWarn,
                  ]}
                >
                  <View style={styles.logMetaRow}>
                    <Text style={styles.logLevel}>{item.level.toUpperCase()}</Text>
                    <Text style={styles.logContext}>[{item.tag}]</Text>
                    <Text style={styles.logTime}>{item.timestamp}</Text>
                  </View>
                  <Text style={styles.logMessage}>{item.message}</Text>
                  {item.details ? (
                    <Text style={styles.logData}>{item.details}</Text>
                  ) : null}
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  topHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  backBtnText: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '700',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  headerRightSpacer: {
    width: 60,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  heroCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  logoBadge: {
    backgroundColor: '#1d4ed8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 10,
  },
  logoBadgeText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 2,
  },
  appName: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  appDesc: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
    paddingHorizontal: 10,
  },
  versionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  versionBadge: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  versionBadgeText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  buildBadge: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  buildBadgeText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  sectionHeader: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 20,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardRowLeft: {
    flex: 1,
  },
  cardRowTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  cardRowSub: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  statusDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#064e3b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusDotGreen: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  statusDotText: {
    color: '#6ee7b7',
    fontSize: 11,
    fontWeight: '700',
  },
  actionBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  navRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  navRowIcon: {
    fontSize: 20,
  },
  navRowTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  navRowSub: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  navRowArrow: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#1e293b',
    marginVertical: 4,
  },
  logBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorPill: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  errorPillText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  logoutArrow: {
    color: '#f87171',
    fontSize: 14,
  },
  fullLogoutRow: {
    marginTop: 4,
  },
  fullLogoutText: {
    color: '#f87171',
    fontWeight: '700',
  },
  fullLogoutArrow: {
    color: '#f87171',
    fontSize: 16,
    fontWeight: '800',
  },
  securityItem: {
    paddingVertical: 4,
  },
  securityTitle: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  securityText: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 17,
  },
  footerSpacing: {
    height: 30,
  },
  modalLogsContainer: {
    flex: 1,
    backgroundColor: '#090d16',
    paddingTop: 40,
  },
  modalLogsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  modalLogsClose: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  modalLogsTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  modalLogsExport: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '700',
  },
  logFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  filterChipActive: {
    backgroundColor: '#2563eb',
  },
  filterChipText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  clearLogsBtn: {
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  clearLogsText: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: '700',
  },
  modalLogsScroll: {
    flex: 1,
  },
  modalLogsContent: {
    padding: 14,
    gap: 8,
  },
  emptyLogsBox: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyLogsText: {
    color: '#64748b',
    fontSize: 13,
  },
  logEntry: {
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  logEntryError: {
    backgroundColor: '#200e12',
    borderLeftColor: '#ef4444',
  },
  logEntryWarn: {
    backgroundColor: '#261b0c',
    borderLeftColor: '#f59e0b',
  },
  logMetaRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    marginBottom: 4,
  },
  logLevel: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  logContext: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '700',
  },
  logTime: {
    color: '#64748b',
    fontSize: 9,
    marginLeft: 'auto',
  },
  logMessage: {
    color: '#e2e8f0',
    fontSize: 12,
    lineHeight: 16,
  },
  logData: {
    marginTop: 4,
    color: '#94a3b8',
    fontSize: 10,
    fontFamily: 'monospace',
    backgroundColor: '#090d16',
    padding: 6,
    borderRadius: 4,
  },
});
