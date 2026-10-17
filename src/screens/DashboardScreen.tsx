import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { obsClient } from '../api/obsClient';
import { AuthStorage } from '../storage/authStorage';
import { StudentProfile, TimetableEntry } from '../types/models';

interface DashboardScreenProps {
  onLogout: () => void;
  onNavigateTab: (tab: string) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onLogout, onNavigateTab }) => {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [nextClass, setNextClass] = useState<TimetableEntry | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      // 1. Try local cache first for instant render
      const cached = await AuthStorage.getCachedProfile();
      if (cached && cached.firstName) {
        setProfile(cached);
        setLoading(false);
      }

      // 2. Fetch fresh profile and timetable
      const fresh = await obsClient.getProfile();
      setProfile(fresh);
      await AuthStorage.saveCachedProfile(fresh);

      const timetable = await obsClient.getTimetable();
      findNextClass(timetable);
    } catch (err: any) {
      console.warn('Dashboard fetch error:', err.message);
      if (err.message === 'SESSION_EXPIRED') {
        onLogout();
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const findNextClass = (schedule: TimetableEntry[]) => {
    if (!schedule || schedule.length === 0) return;
    const now = new Date();
    const jsDay = now.getDay();
    const currentDay = jsDay >= 1 && jsDay <= 5 ? jsDay - 1 : 0; // 0=Mon ... 4=Fri
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Look for classes today starting after current time
    const todayClasses = schedule
      .filter((c) => c.dayId === currentDay)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    const upcoming = todayClasses.find((c) => {
      const [h, m] = c.startTime.split(':').map(Number);
      return h * 60 + m >= currentMinutes;
    });

    if (upcoming) {
      setNextClass(upcoming);
    } else if (todayClasses.length > 0) {
      setNextClass(todayClasses[0]); // fallback to first class of today
    } else {
      setNextClass(schedule[0]); // fallback to first class in list
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading && !profile) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
    >
      {/* Header Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profile?.firstName ? profile.firstName[0] : 'Ö'}
            {profile?.lastName ? profile.lastName[0] : 'G'}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.name}>
            {profile?.firstName} {profile?.lastName}
          </Text>
          <Text style={styles.studentNo}>{profile?.studentNo}</Text>
          <Text style={styles.dept}>{profile?.department}</Text>
        </View>
        <View style={styles.gpaBadge}>
          <Text style={styles.gpaLabel}>AGNO</Text>
          <Text style={styles.gpaValue}>{profile?.gpa.toFixed(2) || '0.00'}</Text>
        </View>
      </View>

      {/* Next Upcoming Lecture Card */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Sıradaki Ders</Text>
      </View>
      {nextClass ? (
        <View style={styles.nextClassCard}>
          <View style={styles.timeBadge}>
            <Text style={styles.timeText}>{nextClass.startTime}</Text>
            <Text style={styles.endTimeText}>- {nextClass.endTime}</Text>
          </View>
          <View style={styles.nextClassInfo}>
            <Text style={styles.courseName}>{nextClass.courseName}</Text>
            <Text style={styles.courseCode}>{nextClass.courseCode}</Text>
            <View style={styles.roomRow}>
              <Text style={styles.roomBadge}>📍 {nextClass.classroom}</Text>
              {nextClass.instructor ? (
                <Text style={styles.instructorText}>{nextClass.instructor}</Text>
              ) : null}
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Bugün için planlanmış ders bulunmuyor.</Text>
        </View>
      )}

      {/* Quick Access Grid */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Hızlı Erişim</Text>
      </View>
      <View style={styles.grid}>
        <TouchableOpacity style={styles.gridCard} onPress={() => onNavigateTab('timetable')}>
          <Text style={styles.gridIcon}>📅</Text>
          <Text style={styles.gridTitle}>Haftalık Program</Text>
          <Text style={styles.gridDesc}>Tüm ders saatleri ve derslikler</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.gridCard} onPress={() => onNavigateTab('grades')}>
          <Text style={styles.gridIcon}>📊</Text>
          <Text style={styles.gridTitle}>Notlar & Simülatör</Text>
          <Text style={styles.gridDesc}>Vize, final ve GPA simülasyonu</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.gridCard} onPress={() => onNavigateTab('attendance')}>
          <Text style={styles.gridIcon}>⏱️</Text>
          <Text style={styles.gridTitle}>Devamsızlık</Text>
          <Text style={styles.gridDesc}>Kalan devamsızlık hakları</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.gridCard, styles.logoutCard]} onPress={onLogout}>
          <Text style={styles.gridIcon}>🚪</Text>
          <Text style={[styles.gridTitle, styles.logoutText]}>Çıkış Yap</Text>
          <Text style={styles.gridDesc}>Hesap oturumunu sonlandır</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e17',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#0a0e17',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 14,
  },
  profileCard: {
    backgroundColor: '#121826',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 20,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 2,
  },
  studentNo: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 2,
  },
  dept: {
    fontSize: 12,
    color: '#64748b',
  },
  gpaBadge: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  gpaLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#38bdf8',
    letterSpacing: 1,
  },
  gpaValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
    marginTop: 2,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  nextClassCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
    marginBottom: 24,
  },
  timeBadge: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    marginRight: 14,
  },
  timeText: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '700',
  },
  endTimeText: {
    color: '#64748b',
    fontSize: 11,
  },
  nextClassInfo: {
    flex: 1,
  },
  courseName: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  courseCode: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 6,
  },
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  roomBadge: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '600',
    marginRight: 10,
  },
  instructorText: {
    color: '#64748b',
    fontSize: 11,
  },
  emptyCard: {
    backgroundColor: '#121826',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 13,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: 24,
  },
  gridCard: {
    backgroundColor: '#121826',
    borderRadius: 16,
    padding: 16,
    width: '48%',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  gridIcon: {
    fontSize: 24,
    marginBottom: 10,
  },
  gridTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  gridDesc: {
    color: '#64748b',
    fontSize: 11,
    lineHeight: 15,
  },
  logoutCard: {
    borderColor: '#3f1c1c',
  },
  logoutText: {
    color: '#f87171',
  },
});
