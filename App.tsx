import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthStorage } from './src/storage/authStorage';
import { obsClient } from './src/api/obsClient';
import { configManager } from './src/config/configManager';
import { LoginScreen } from './src/screens/LoginScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { TimetableScreen } from './src/screens/TimetableScreen';
import { GradesScreen } from './src/screens/GradesScreen';
import { AttendanceScreen } from './src/screens/AttendanceScreen';

type Tab = 'dashboard' | 'timetable' | 'grades' | 'attendance';

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentTab, setCurrentTab] = useState<Tab>('dashboard');

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await configManager.initialize();
        const session = await AuthStorage.getSession();
        if (session.jwtToken && session.studentNo) {
          obsClient.setTokens(session.jwtToken, session.studentNo);
          setIsAuthenticated(true);
        }
      } catch (err) {
        console.warn('Bootstrap error:', err);
      } finally {
        setInitializing(false);
      }
    };

    bootstrap();
  }, []);

  const handleLogout = async () => {
    await AuthStorage.clearSession();
    setIsAuthenticated(false);
    setCurrentTab('dashboard');
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
          onPress={() => setCurrentTab('dashboard')}
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0a0e17',
  },
  splashContainer: {
    flex: 1,
    backgroundColor: '#0a0e17',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    height: 54,
    backgroundColor: '#0a0e17',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
  },
  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1e293b',
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
    height: 64,
    backgroundColor: '#121826',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingBottom: 6,
    paddingTop: 6,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    marginHorizontal: 4,
  },
  activeNavItem: {
    backgroundColor: '#1e293b',
  },
  navIcon: {
    fontSize: 18,
    marginBottom: 2,
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
