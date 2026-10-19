import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthStorage } from './src/storage/authStorage';
import { obsClient } from './src/api/obsClient';
import { lmsClient } from './src/api/lmsClient';
import { configManager } from './src/config/configManager';
import { logService } from './src/services/logService';
import { LoginScreen } from './src/screens/LoginScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { TimetableScreen } from './src/screens/TimetableScreen';
import { GradesScreen } from './src/screens/GradesScreen';
import { AttendanceScreen } from './src/screens/AttendanceScreen';
import { LmsScreen } from './src/screens/LmsScreen';
import { LogsScreen } from './src/screens/LogsScreen';

type Portal = 'obs' | 'lms';
type ObsTab = 'dashboard' | 'timetable' | 'grades' | 'attendance' | 'logs';

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [activePortal, setActivePortal] = useState<Portal>('obs');

  const [isObsAuthenticated, setIsObsAuthenticated] = useState(false);
  const [isLmsAuthenticated, setIsLmsAuthenticated] = useState(false);

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
        Alert.alert('Geliştirici Modu Açıldı', 'Hata ve sistem günlükleri sekmesi aktif edildi.');
      }
    } else {
      setTapCount(1);
    }
    setLastTapTime(now);
  };

  const handleObsLogout = async () => {
    Alert.alert(
      'OBS Çıkışı',
      'Öğrenci Bilgi Sistemi (OBS) oturumunuzu kapatmak istiyor musunuz? (LMS oturumunuz açık kalacaktır)',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Çıkış Yap',
          style: 'destructive',
          onPress: async () => {
            await AuthStorage.clearSession();
            setIsObsAuthenticated(false);
            setObsTab('dashboard');
            setDevUnlocked(false);
          },
        },
      ]
    );
  };

  const handleLmsLogout = async () => {
    Alert.alert(
      'LMS Çıkışı',
      'Moodle LMS oturumunuzu kapatmak istiyor musunuz? (OBS oturumunuz açık kalacaktır)',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Çıkış Yap',
          style: 'destructive',
          onPress: async () => {
            await AuthStorage.clearLmsSession();
            lmsClient.clearSession();
            setIsLmsAuthenticated(false);
          },
        },
      ]
    );
  };

  if (initializing) {
    return (
      <View style={styles.splashContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <StatusBar style="light" />
      </View>
    );
  }

  // Neither portal is authenticated -> Show full login screen
  if (!isObsAuthenticated && !isLmsAuthenticated) {
    return (
      <>
        <StatusBar style="light" />
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
        />
      </>
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
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      {/* Modern Top Header with Portal Switcher */}
      <View style={styles.header}>
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

        {/* Right Logout Button (for active portal if authenticated) */}
        {isCurrentPortalAuthed ? (
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={activePortal === 'obs' ? handleObsLogout : handleLmsLogout}
          >
            <Text style={styles.logoutBtnText}>Çıkış</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerRightPlaceholder} />
        )}
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
        <View style={styles.bottomNav}>
          <TouchableOpacity
            style={[styles.navItem, obsTab === 'dashboard' && styles.activeNavItem]}
            onPress={handleDashboardTap}
          >
            <Text style={styles.navIcon}>🏠</Text>
            <Text style={[styles.navLabel, obsTab === 'dashboard' && styles.activeNavLabel]}>
              Özet
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, obsTab === 'timetable' && styles.activeNavItem]}
            onPress={() => setObsTab('timetable')}
          >
            <Text style={styles.navIcon}>📅</Text>
            <Text style={[styles.navLabel, obsTab === 'timetable' && styles.activeNavLabel]}>
              Program
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, obsTab === 'grades' && styles.activeNavItem]}
            onPress={() => setObsTab('grades')}
          >
            <Text style={styles.navIcon}>📊</Text>
            <Text style={[styles.navLabel, obsTab === 'grades' && styles.activeNavLabel]}>
              Notlar
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, obsTab === 'attendance' && styles.activeNavItem]}
            onPress={() => setObsTab('attendance')}
          >
            <Text style={styles.navIcon}>⏱️</Text>
            <Text style={[styles.navLabel, obsTab === 'attendance' && styles.activeNavLabel]}>
              Devam
            </Text>
          </TouchableOpacity>

          {/* Easter Egg Dev Logs Tab */}
          {devUnlocked ? (
            <TouchableOpacity
              style={[styles.navItem, obsTab === 'logs' && styles.activeNavItem]}
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
              <Text style={[styles.navLabel, obsTab === 'logs' && styles.activeNavLabel]}>
                Günlük
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090d16',
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
  logoutBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  logoutBtnText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '700',
  },
  headerRightPlaceholder: {
    width: 48,
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
});
