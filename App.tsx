import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Modal,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthStorage } from './src/storage/authStorage';
import { obsClient } from './src/api/obsClient';
import { lmsClient } from './src/api/lmsClient';
import { configManager } from './src/config/configManager';
import { logService } from './src/services/logService';
import { AppAlert } from './src/utils/alertHelper';
import { LoginScreen } from './src/screens/LoginScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { TimetableScreen } from './src/screens/TimetableScreen';
import { GradesScreen } from './src/screens/GradesScreen';
import { AttendanceScreen } from './src/screens/AttendanceScreen';
import { LmsScreen } from './src/screens/LmsScreen';
import { LogsScreen } from './src/screens/LogsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { updateService, UpdateInfo } from './src/services/updateService';
import { UpdateModal } from './src/components/UpdateModal';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';

type Portal = 'obs' | 'lms';
type ObsTab = 'dashboard' | 'timetable' | 'grades' | 'attendance' | 'logs';

function AppContent() {
  const { colors } = useTheme();
  const [initializing, setInitializing] = useState(true);
  const [activePortal, setActivePortal] = useState<Portal>('obs');

  const [isObsAuthenticated, setIsObsAuthenticated] = useState(false);
  const [isLmsAuthenticated, setIsLmsAuthenticated] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  const [obsTab, setObsTab] = useState<ObsTab>('dashboard');

  // Easter Egg: 5 taps on 'Özet' reveals developer logs tab
  const [tapCount, setTapCount] = useState(0);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [devUnlocked, setDevUnlocked] = useState(false);
  const [errorCount, setErrorCount] = useState(0);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await configManager.initialize();

        // 1. Check OBS session
        const obsSession = await AuthStorage.getSession();
        if (obsSession.jwtToken && obsSession.studentNo) {
          obsClient.setTokens(obsSession.jwtToken, obsSession.studentNo);
          setIsObsAuthenticated(true);
        }

        // 2. Check LMS session
        const lmsSession = await AuthStorage.getLmsSession();
        if (lmsSession?.sesskey && lmsSession?.moodleSession) {
          lmsClient.setSession(lmsSession);
          setIsLmsAuthenticated(true);
          // If only LMS is authenticated, start on LMS portal
          if (!obsSession.jwtToken) {
            setActivePortal('lms');
          }
        }
      } catch (err: any) {
        logService.error('App Bootstrap', 'Başlatma hatası', err.message);
      } finally {
        setInitializing(false);
      }
    };

    bootstrap();

    // Check for OTA updates from GitHub Releases in background
    updateService.checkForUpdates().then((info) => {
      if (info && info.hasUpdate) {
        setUpdateInfo(info);
        setShowUpdateModal(true);
      }
    });

    const unsub = logService.subscribe(() => {
      setErrorCount(logService.getErrorCount());
    });
    return unsub;
  }, []);

  const handleDashboardTap = () => {
    setObsTab('dashboard');
    const now = Date.now();
    if (now - lastTapTime < 1500) {
      const nextCount = tapCount + 1;
      setTapCount(nextCount);
      if (nextCount >= 5 && !devUnlocked) {
        setDevUnlocked(true);
        AppAlert.alert('Geliştirici Modu Açıldı', 'Hata ve sistem günlükleri sekmesi aktif edildi.');
      }
    } else {
      setTapCount(1);
    }
    setLastTapTime(now);
  };

  const handleObsLogout = async () => {
    AppAlert.confirm(
      'OBS Oturumunu Kapat',
      'Öğrenci Bilgi Sistemi (OBS) oturumunuzu kapatmak istiyor musunuz? (LMS oturumunuz açık kalacaktır)',
      async () => {
        await AuthStorage.clearSession();
        obsClient.clearTokens();
        setIsObsAuthenticated(false);
        setObsTab('dashboard');
        setDevUnlocked(false);
        if (isLmsAuthenticated) {
          setActivePortal('lms');
        }
      },
      undefined,
      'Çıkış Yap',
      'İptal'
    );
  };

  const handleLmsLogout = async () => {
    AppAlert.confirm(
      'LMS Oturumunu Kapat',
      'Moodle LMS oturumunuzu kapatmak istiyor musunuz? (OBS oturumunuz açık kalacaktır)',
      async () => {
        await AuthStorage.clearLmsSession();
        lmsClient.clearSession();
        setIsLmsAuthenticated(false);
        if (isObsAuthenticated) {
          setActivePortal('obs');
        }
      },
      undefined,
      'Çıkış Yap',
      'İptal'
    );
  };

  const handleFullLogout = async () => {
    AppAlert.confirm(
      'Tüm Oturumları Kapat',
      'Hem OBS hem de LMS oturumlarınızı kapatıp ana giriş ekranına dönmek istiyor musunuz?',
      async () => {
        await Promise.all([AuthStorage.clearSession(), AuthStorage.clearLmsSession()]);
        obsClient.clearTokens();
        lmsClient.clearSession();
        setIsObsAuthenticated(false);
        setIsLmsAuthenticated(false);
        setObsTab('dashboard');
        setDevUnlocked(false);
        setActivePortal('obs');
      },
      undefined,
      'Tam Çıkış Yap',
      'İptal'
    );
  };

  if (initializing) {
    return (
      <View style={[styles.splashContainer, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color="#2563eb" />
        <StatusBar style={colors.statusBarStyle} />
      </View>
    );
  }

  // Neither portal is authenticated -> Show full login screen
  if (!isObsAuthenticated && !isLmsAuthenticated) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
        <StatusBar style={colors.statusBarStyle} />
        <LoginScreen
          initialPortal={activePortal}
          isObsAuthenticated={isObsAuthenticated}
          isLmsAuthenticated={isLmsAuthenticated}
          onObsLoginSuccess={() => {
            setIsObsAuthenticated(true);
            setActivePortal('obs');
          }}
          onLmsLoginSuccess={() => {
            setIsLmsAuthenticated(true);
            setActivePortal('lms');
          }}
          onContinueToPortal={(p) => setActivePortal(p)}
          onOpenSettings={() => setShowSettings(true)}
        />

        {/* Settings Modal (available even before logging in) */}
        <Modal
          visible={showSettings}
          animationType="slide"
          onRequestClose={() => setShowSettings(false)}
        >
          <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
            <StatusBar style={colors.statusBarStyle} />
            <SettingsScreen
              onClose={() => setShowSettings(false)}
              isObsAuthenticated={false}
              isLmsAuthenticated={false}
            />
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    );
  }

  const renderObsScreen = () => {
    switch (obsTab) {
      case 'dashboard':
        return (
          <DashboardScreen
            onLogout={handleObsLogout}
            onNavigateTab={(tab) => {
              if (tab === 'lms') {
                setActivePortal('lms');
              } else {
                setObsTab(tab as ObsTab);
              }
            }}
          />
        );
      case 'timetable':
        return <TimetableScreen />;
      case 'grades':
        return <GradesScreen />;
      case 'attendance':
        return <AttendanceScreen />;
      case 'logs':
        return <LogsScreen />;
    }
  };

  const isCurrentPortalAuthed = activePortal === 'obs' ? isObsAuthenticated : isLmsAuthenticated;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <StatusBar style={colors.statusBarStyle} />

      {/* Modern Top Header with Portal Switcher */}
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.cardBorder }]}>
        {/* Left University Mini Logo */}
        <View style={styles.logoBadgeMini}>
          <Text style={styles.logoBadgeMiniText}>OSTİM</Text>
        </View>

        {/* Center Portal Switcher Segment */}
        <View style={styles.portalSegment}>
          <TouchableOpacity
            style={[styles.portalBtn, activePortal === 'obs' && styles.portalBtnActive]}
            onPress={() => setActivePortal('obs')}
          >
            <Text style={styles.portalBtnIcon}>🎓</Text>
            <Text style={[styles.portalBtnText, activePortal === 'obs' && styles.portalBtnTextActive]}>
              OBS
            </Text>
            <View
              style={[
                styles.portalDot,
                { backgroundColor: isObsAuthenticated ? '#10b981' : '#64748b' },
              ]}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.portalBtn, activePortal === 'lms' && styles.portalBtnActive]}
            onPress={() => setActivePortal('lms')}
          >
            <Text style={styles.portalBtnIcon}>📚</Text>
            <Text style={[styles.portalBtnText, activePortal === 'lms' && styles.portalBtnTextActive]}>
              LMS
            </Text>
            <View
              style={[
                styles.portalDot,
                { backgroundColor: isLmsAuthenticated ? '#10b981' : '#64748b' },
              ]}
            />
          </TouchableOpacity>
        </View>

        {/* Right Header Actions: Quick Logout & Settings Gear */}
        <View style={styles.headerRightGroup}>
          {isCurrentPortalAuthed ? (
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={() => {
                if (isObsAuthenticated && isLmsAuthenticated) {
                  setShowLogoutModal(true);
                } else if (activePortal === 'obs') {
                  handleObsLogout();
                } else {
                  handleLmsLogout();
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.logoutBtnText}>
                🚪 {activePortal === 'obs' ? 'OBS' : 'LMS'}
              </Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.settingsHeaderBtn}
            onPress={() => setShowSettings(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.settingsHeaderIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Area */}
      <View style={styles.content}>
        {activePortal === 'obs' ? (
          isObsAuthenticated ? (
            renderObsScreen()
          ) : (
            <LoginScreen
              initialPortal="obs"
              isObsAuthenticated={isObsAuthenticated}
              isLmsAuthenticated={isLmsAuthenticated}
              onObsLoginSuccess={() => {
                setIsObsAuthenticated(true);
                setActivePortal('obs');
              }}
              onLmsLoginSuccess={() => {
                setIsLmsAuthenticated(true);
                setActivePortal('lms');
              }}
              onContinueToPortal={(p) => setActivePortal(p)}
            />
          )
        ) : isLmsAuthenticated ? (
          <LmsScreen onSessionChange={(connected) => setIsLmsAuthenticated(connected)} />
        ) : (
          <LoginScreen
            initialPortal="lms"
            isObsAuthenticated={isObsAuthenticated}
            isLmsAuthenticated={isLmsAuthenticated}
            onObsLoginSuccess={() => {
              setIsObsAuthenticated(true);
              setActivePortal('obs');
            }}
            onLmsLoginSuccess={() => {
              setIsLmsAuthenticated(true);
              setActivePortal('lms');
            }}
            onContinueToPortal={(p) => setActivePortal(p)}
          />
        )}
      </View>

      {/* Bottom Navigation Bar (Visible when in OBS portal and authenticated) */}
      {activePortal === 'obs' && isObsAuthenticated ? (
        <View style={[styles.bottomNav, { backgroundColor: colors.navBg, borderTopColor: colors.cardBorder }]}>
          <TouchableOpacity
            style={[styles.navItem, obsTab === 'dashboard' && [styles.activeNavItem, { backgroundColor: colors.cardAlt }]]}
            onPress={handleDashboardTap}
          >
            <Text style={styles.navIcon}>🏠</Text>
            <Text style={[styles.navLabel, { color: colors.textMuted }, obsTab === 'dashboard' && [styles.activeNavLabel, { color: colors.primary }]]}>
              Özet
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, obsTab === 'timetable' && [styles.activeNavItem, { backgroundColor: colors.cardAlt }]]}
            onPress={() => setObsTab('timetable')}
          >
            <Text style={styles.navIcon}>📅</Text>
            <Text style={[styles.navLabel, { color: colors.textMuted }, obsTab === 'timetable' && [styles.activeNavLabel, { color: colors.primary }]]}>
              Program
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, obsTab === 'grades' && [styles.activeNavItem, { backgroundColor: colors.cardAlt }]]}
            onPress={() => setObsTab('grades')}
          >
            <Text style={styles.navIcon}>📊</Text>
            <Text style={[styles.navLabel, { color: colors.textMuted }, obsTab === 'grades' && [styles.activeNavLabel, { color: colors.primary }]]}>
              Notlar
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, obsTab === 'attendance' && [styles.activeNavItem, { backgroundColor: colors.cardAlt }]]}
            onPress={() => setObsTab('attendance')}
          >
            <Text style={styles.navIcon}>⏱️</Text>
            <Text style={[styles.navLabel, { color: colors.textMuted }, obsTab === 'attendance' && [styles.activeNavLabel, { color: colors.primary }]]}>
              Devam
            </Text>
          </TouchableOpacity>

          {/* Easter Egg Dev Logs Tab */}
          {devUnlocked ? (
            <TouchableOpacity
              style={[styles.navItem, obsTab === 'logs' && [styles.activeNavItem, { backgroundColor: colors.cardAlt }]]}
              onPress={() => setObsTab('logs')}
            >
              <View style={styles.iconWithBadge}>
                <Text style={styles.navIcon}>🐞</Text>
                {errorCount > 0 ? (
                  <View style={styles.errorBadge}>
                    <Text style={styles.errorBadgeText}>{errorCount > 9 ? '9+' : errorCount}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.navLabel, { color: colors.textMuted }, obsTab === 'logs' && [styles.activeNavLabel, { color: colors.primary }]]}>
                Günlük
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {/* Multi-Portal Logout Modal */}
      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.logoutModalOverlay}>
          <View style={styles.logoutModalCard}>
            <View style={styles.logoutModalHeader}>
              <Text style={styles.logoutModalTitle}>🚪 Oturum Yönetimi</Text>
              <TouchableOpacity onPress={() => setShowLogoutModal(false)}>
                <Text style={styles.logoutModalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.logoutModalSub}>
              Hangi oturumunuzu kapatmak istiyorsunuz?
            </Text>

            <TouchableOpacity
              style={styles.logoutOptionCard}
              onPress={() => {
                setShowLogoutModal(false);
                handleObsLogout();
              }}
            >
              <Text style={styles.logoutOptionIcon}>🎓</Text>
              <View style={styles.logoutOptionInfo}>
                <Text style={styles.logoutOptionTitle}>Sadece OBS'den Çıkış Yap</Text>
                <Text style={styles.logoutOptionDesc}>LMS (Moodle) oturumunuz açık kalır.</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.logoutOptionCard}
              onPress={() => {
                setShowLogoutModal(false);
                handleLmsLogout();
              }}
            >
              <Text style={styles.logoutOptionIcon}>📚</Text>
              <View style={styles.logoutOptionInfo}>
                <Text style={styles.logoutOptionTitle}>Sadece LMS'den Çıkış Yap</Text>
                <Text style={styles.logoutOptionDesc}>OBS oturumunuz açık kalır.</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.logoutOptionCard, styles.logoutFullCard]}
              onPress={() => {
                setShowLogoutModal(false);
                handleFullLogout();
              }}
            >
              <Text style={styles.logoutOptionIcon}>🛑</Text>
              <View style={styles.logoutOptionInfo}>
                <Text style={[styles.logoutOptionTitle, styles.logoutFullTitle]}>
                  Tüm Oturumları Kapat (Tam Çıkış)
                </Text>
                <Text style={styles.logoutOptionDesc}>Her iki sistemden de tamamen çıkış yapılır.</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.logoutCancelBtn}
              onPress={() => setShowLogoutModal(false)}
            >
              <Text style={styles.logoutCancelBtnText}>Vazgeç</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* GitHub Releases In-App Update Modal */}
      <UpdateModal
        visible={showUpdateModal}
        updateInfo={updateInfo}
        onDismiss={() => setShowUpdateModal(false)}
      />

      {/* Settings & About Modal */}
      <Modal
        visible={showSettings}
        animationType="slide"
        onRequestClose={() => setShowSettings(false)}
      >
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
          <StatusBar style={colors.statusBarStyle} />
          <SettingsScreen
            onClose={() => setShowSettings(false)}
            isObsAuthenticated={isObsAuthenticated}
            isLmsAuthenticated={isLmsAuthenticated}
            onObsLogout={() => {
              setShowSettings(false);
              handleObsLogout();
            }}
            onLmsLogout={() => {
              setShowSettings(false);
              handleLmsLogout();
            }}
            onFullLogout={() => {
              setShowSettings(false);
              handleFullLogout();
            }}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090d16',
    paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight || 28) : 0,
  },
  splashContainer: {
    flex: 1,
    backgroundColor: '#090d16',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    height: 56,
    backgroundColor: '#090d16',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoBadgeMini: {
    backgroundColor: '#1d4ed8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  logoBadgeMiniText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1,
  },
  portalSegment: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  portalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 9,
    gap: 6,
  },
  portalBtnActive: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  portalBtnIcon: {
    fontSize: 14,
  },
  portalBtnText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  portalBtnTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  portalDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoutBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  logoutBtnText: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: '700',
  },
  settingsHeaderBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  settingsHeaderIcon: {
    fontSize: 15,
  },
  content: {
    flex: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    height: 62,
    backgroundColor: '#111827',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingBottom: 4,
    paddingTop: 4,
    paddingHorizontal: 4,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    marginHorizontal: 2,
    paddingVertical: 4,
  },
  activeNavItem: {
    backgroundColor: '#1e293b',
  },
  iconWithBadge: {
    position: 'relative',
    alignItems: 'center',
  },
  navIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  errorBadge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  errorBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  activeNavLabel: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  logoutModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logoutModalCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#334155',
  },
  logoutModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  logoutModalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  logoutModalClose: {
    color: '#94a3b8',
    fontSize: 18,
    padding: 4,
  },
  logoutModalSub: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 16,
  },
  logoutOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  logoutOptionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  logoutOptionInfo: {
    flex: 1,
  },
  logoutOptionTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  logoutOptionDesc: {
    color: '#64748b',
    fontSize: 11,
  },
  logoutFullCard: {
    borderColor: '#7f1d1d',
    backgroundColor: '#200e12',
  },
  logoutFullTitle: {
    color: '#f87171',
  },
  logoutCancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  logoutCancelBtnText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
});
