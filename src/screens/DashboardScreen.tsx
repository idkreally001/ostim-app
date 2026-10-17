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
import { weatherService, WeatherInfo, LessonWeatherSummary } from '../services/weatherService';

interface DashboardScreenProps {
  onLogout: () => void;
  onNavigateTab: (tab: string) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onLogout, onNavigateTab }) => {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [nextClass, setNextClass] = useState<TimetableEntry | null>(null);
  const [nextClassDateText, setNextClassDateText] = useState<string>('');
  const [currentWeather, setCurrentWeather] = useState<WeatherInfo | null>(null);
  const [lessonWeather, setLessonWeather] = useState<LessonWeatherSummary | null>(null);
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

      // 3. Fetch campus weather
      weatherService.getCurrentWeather().then(setCurrentWeather);
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
    const jsDay = now.getDay(); // 0=Sun, 1=Mon ... 5=Fri
    const currentDayNo = jsDay >= 1 && jsDay <= 5 ? jsDay - 1 : 0; // 0=Mon ... 4=Fri
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Look for classes today starting after current time
    const todayClasses = schedule
      .filter((c) => c.dayId === currentDayNo)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    const upcoming = todayClasses.find((c) => {
      const [h, m] = c.startTime.split(':').map(Number);
      return h * 60 + m >= currentMinutes;
    });

    const targetClass = upcoming || todayClasses[0] || schedule[0];
    setNextClass(targetClass);

    // Compute formatted day/date text
    const dayNames = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'];
    const targetDayName = dayNames[targetClass.dayId] || targetClass.dayName || 'Bugün';

    const dateFormatted = now.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
    });
    setNextClassDateText(`${targetDayName}, ${dateFormatted}`);

    // Fetch lesson-specific weather forecast (1 hr before start)
    if (targetClass.startTime) {
      weatherService.getLessonForecast(targetClass.startTime).then(setLessonWeather);
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
      {/* Campus Weather Bar */}
      {currentWeather ? (
        <View style={styles.weatherBar}>
          <Text style={styles.weatherEmoji}>{currentWeather.emoji}</Text>
          <Text style={styles.weatherText}>
            OSTİM Kampüs: <Text style={styles.weatherTemp}>{currentWeather.temp}°C</Text> • {currentWeather.condition}
          </Text>
        </View>
      ) : null}

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
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Sıradaki Ders</Text>
        {nextClassDateText ? (
          <Text style={styles.sectionDate}>{nextClassDateText}</Text>
        ) : null}
      </View>

      {nextClass ? (
        <View style={styles.nextClassCard}>
          <View style={styles.cardTopRow}>
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

          {/* Pre-lesson Weather Forecast Widget */}
          {lessonWeather ? (
            <View style={styles.lessonWeatherRow}>
              <Text style={styles.lessonWeatherEmoji}>{lessonWeather.emoji}</Text>
              <Text style={styles.lessonWeatherText}>
                Ders Öncesi ({lessonWeather.periodText}):{' '}
                <Text style={styles.lessonWeatherBold}>{lessonWeather.temp}°C, {lessonWeather.condition}</Text>
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Planlanmış ders bulunmuyor.</Text>
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
          <Text style={styles.gridDesc}>Derslikler ve haftalık saatler</Text>
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
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#090d16',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 14,
  },
  weatherBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  weatherEmoji: {
    fontSize: 18,
    marginRight: 8,
  },
  weatherText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  weatherTemp: {
    color: '#f8fafc',
    fontWeight: '700',
  },
  profileCard: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 18,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 19,
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
  },
  name: {
    fontSize: 16,
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
    paddingVertical: 7,
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
    fontSize: 17,
    fontWeight: '800',
    color: '#f8fafc',
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  sectionDate: {
    fontSize: 12,
    color: '#38bdf8',
    fontWeight: '600',
  },
  nextClassCard: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 20,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeBadge: {
    backgroundColor: '#0b1120',
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
  lessonWeatherRow: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    flexDirection: 'row',
    alignItems: 'center',
  },
  lessonWeatherEmoji: {
    fontSize: 14,
    marginRight: 6,
  },
  lessonWeatherText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  lessonWeatherBold: {
    color: '#cbd5e1',
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginBottom: 20,
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
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    width: '48%',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  gridIcon: {
    fontSize: 22,
    marginBottom: 8,
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
});
