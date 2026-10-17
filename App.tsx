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
import { configManager } from './src/config/configManager';
import { logService } from './src/services/logService';
import { LoginScreen } from './src/screens/LoginScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { TimetableScreen } from './src/screens/TimetableScreen';
import { GradesScreen } from './src/screens/GradesScreen';
import { AttendanceScreen } from './src/screens/AttendanceScreen';
import { LogsScreen } from './src/screens/LogsScreen';

type Tab = 'dashboard' | 'timetable' | 'grades' | 'attendance' | 'logs';

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentTab, setCurrentTab] = useState<Tab>('dashboard');

  // Easter Egg: 5 taps on 'Özet' reveals developer logs tab
  const [tapCount, setTapCount] = useState(0);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [devUnlocked, setDevUnlocked] = useState(false);
  const [errorCount, setErrorCount] = useState(0);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await configManager.initialize();
        const session = await AuthStorage.getSession();
        if (session.jwtToken && session.studentNo) {
          obsClient.setTokens(session.jwtToken, session.studentNo);
          setIsAuthenticated(true);
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
    setCurrentTab('dashboard');
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

  const handleLogout = async () => {
    await AuthStorage.clearSession();
    setIsAuthenticated(false);
    setCurrentTab('dashboard');
    setDevUnlocked(false);
  };

  if (initializing) {
    return (
      <View style={styles.splashContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <StatusBar style="light" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <StatusBar style="light" />
        <LoginScreen onLoginSuccess={() => setIsAuthenticated(true)} />
      </>
    );
  }

  const renderCurrentScreen = () => {
    switch (currentTab) {
      case 'dashboard':
        return <DashboardScreen onLogout={handleLogout} onNavigateTab={(tab) => setCurrentTab(tab as Tab)} />;
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

  const getHeaderTitle = () => {
    switch (currentTab) {
      case 'dashboard':
        return 'Genel Bakış';
      case 'timetable':
        return 'Haftalık Ders Programı';
      case 'grades':
        return 'Dönem Notları';
      case 'attendance':
        return 'Devamsızlık Durumu';
      case 'logs':
        return 'Sistem & Hata Günlüğü';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      
      {/* Top Header Bar */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{getHeaderTitle()}</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>Çıkış</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content Area */}
      <View style={styles.content}>
        {renderCurrentScreen()}
      </View>

      {/* Modern Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[styles.navItem, currentTab === 'dashboard' && styles.activeNavItem]}
          onPress={handleDashboardTap}
        >
          <Text style={styles.navIcon}>🏠</Text>
          <Text style={[styles.navLabel, currentTab === 'dashboard' && styles.activeNavLabel]}>
            Özet
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, currentTab === 'timetable' && styles.activeNavItem]}
          onPress={() => setCurrentTab('timetable')}
        >
          <Text style={styles.navIcon}>📅</Text>
          <Text style={[styles.navLabel, currentTab === 'timetable' && styles.activeNavLabel]}>
            Program
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, currentTab === 'grades' && styles.activeNavItem]}
          onPress={() => setCurrentTab('grades')}
        >
          <Text style={styles.navIcon}>📊</Text>
          <Text style={[styles.navLabel, currentTab === 'grades' && styles.activeNavLabel]}>
            Notlar
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, currentTab === 'attendance' && styles.activeNavItem]}
          onPress={() => setCurrentTab('attendance')}
        >
          <Text style={styles.navIcon}>⏱️</Text>
          <Text style={[styles.navLabel, currentTab === 'attendance' && styles.activeNavLabel]}>
            Devam
          </Text>
        </TouchableOpacity>

        {/* Easter Egg Dev Logs Tab */}
        {devUnlocked ? (
          <TouchableOpacity
            style={[styles.navItem, currentTab === 'logs' && styles.activeNavItem]}
            onPress={() => setCurrentTab('logs')}
          >
            <View style={styles.iconWithBadge}>
              <Text style={styles.navIcon}>🐞</Text>
              {errorCount > 0 ? (
                <View style={styles.errorBadge}>
                  <Text style={styles.errorBadgeText}>{errorCount > 9 ? '9+' : errorCount}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.navLabel, currentTab === 'logs' && styles.activeNavLabel]}>
              Günlük
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
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
    height: 52,
    backgroundColor: '#090d16',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
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
