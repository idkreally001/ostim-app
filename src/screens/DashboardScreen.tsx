import React, { useEffect, useState, useMemo } from 'react';
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
import { useTheme, ThemeColors } from '../theme/ThemeContext';

interface DashboardScreenProps {
  onLogout: () => void;
  onNavigateTab: (tab: string) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onLogout, onNavigateTab }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => getDashboardStyles(colors), [colors]);
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
      const [cached, cachedTimetable] = await Promise.all([
        AuthStorage.getCachedProfile(),
        AuthStorage.getCachedTimetable(),
      ]);
      if (cached && (cached.firstName || cached.studentNo)) {
        setProfile(cached);
        setLoading(false);
      }
      if (cachedTimetable && cachedTimetable.length > 0) {
        findNextClass(cachedTimetable);
      }

      // 2. Fetch fresh profile and timetable
      const fresh = await obsClient.getProfile();
      if (fresh) {
        setProfile(fresh);
        await AuthStorage.saveCachedProfile(fresh);
      }

      const timetable = await obsClient.getTimetable();
      findNextClass(timetable);
      if (timetable && timetable.length > 0) {
        await AuthStorage.saveCachedTimetable(timetable);
      }

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

  const displayName = profile?.firstName || profile?.lastName
    ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim()
    : (profile?.studentNo ? `Öğrenci #${profile.studentNo}` : 'Öğrenci');

  const greetingName = profile?.firstName
    ? profile.firstName.split(' ')[0]
    : 'Öğrenci';

  const avatarInitials = profile?.firstName && profile?.lastName
    ? `${profile.firstName[0].toUpperCase()}${profile.lastName[0].toUpperCase()}`
    : (profile?.firstName ? profile.firstName.slice(0, 2).toUpperCase() : 'ÖG');

  if (loading && !profile) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#60a5fa" />
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#60a5fa" />}
    >
      {/* Material You Header: Greeting & Campus Context */}
      <View style={styles.greetingHeader}>
        <View style={styles.greetingTextContainer}>
          <Text style={styles.greetingTitle}>Merhaba, {greetingName} 👋</Text>
          {currentWeather ? (
            <View style={styles.weatherChip}>
              <Text style={styles.weatherChipEmoji}>{currentWeather.emoji}</Text>
              <Text style={styles.weatherChipText}>
                OSTİM Kampüs <Text style={styles.weatherChipTemp}>{currentWeather.temp}°C</Text> • {currentWeather.condition}
              </Text>
            </View>
          ) : (
            <Text style={styles.greetingSubtitle}>OSTİM Teknik Üniversitesi</Text>
          )}
        </View>
      </View>

      {/* Material You Hero Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.profileMainRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{avatarInitials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.name} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.studentNo}>
              {profile?.studentNo ? `Öğrenci No: ${profile.studentNo}` : 'Numara Belirtilmedi'}
            </Text>
            <View style={styles.deptChip}>
              <Text style={styles.deptChipText} numberOfLines={1}>
                {profile?.department || 'Mühendislik Fakültesi'}
              </Text>
            </View>
          </View>

          {/* Elevated AGNO Container */}
          <View style={styles.gpaContainer}>
            <Text style={styles.gpaLabel}>AGNO</Text>
            <Text style={styles.gpaValue}>
              {typeof profile?.gpa === 'number' && !isNaN(profile.gpa) ? profile.gpa.toFixed(2) : '0.00'}
            </Text>
            {typeof profile?.termGpa === 'number' && profile.termGpa > 0 ? (
              <Text style={styles.termGpaText}>ANO: {profile.termGpa.toFixed(2)}</Text>
            ) : null}
          </View>
        </View>
      </View>

      {/* Next Upcoming Lecture Card */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Sıradaki Ders</Text>
        {nextClassDateText ? (
          <View style={styles.dateChip}>
            <Text style={styles.dateChipText}>{nextClassDateText}</Text>
          </View>
        ) : null}
      </View>

      {nextClass ? (
        <View style={styles.nextClassCard}>
          <View style={styles.classCardContent}>
            <View style={styles.classTopRow}>
              <View style={styles.timeChip}>
                <Text style={styles.timeText}>{nextClass.startTime}</Text>
                <Text style={styles.endTimeText}>- {nextClass.endTime}</Text>
              </View>
              <View style={styles.courseMeta}>
                <Text style={styles.courseName}>{nextClass.courseName}</Text>
                {nextClass.courseCode ? (
                  <Text style={styles.courseCode}>{nextClass.courseCode}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.chipsRow}>
              <View style={styles.classroomChip}>
                <Text style={styles.classroomChipText}>📍 {nextClass.classroom}</Text>
              </View>
              {nextClass.instructor ? (
                <View style={styles.instructorChip}>
                  <Text style={styles.instructorChipText} numberOfLines={1}>
                    👤 {nextClass.instructor}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Pre-lesson Weather Forecast Widget */}
          {lessonWeather ? (
            <View style={styles.lessonWeatherBar}>
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
          <Text style={styles.emptyIcon}>☕</Text>
          <Text style={styles.emptyText}>Bugün için planlanmış başka ders bulunmuyor.</Text>
        </View>
      )}

      {/* Quick Access Grid */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Hızlı Erişim</Text>
      </View>
      <View style={styles.grid}>
        <TouchableOpacity
          style={styles.gridCard}
          activeOpacity={0.75}
          onPress={() => onNavigateTab('timetable')}
        >
          <View style={[styles.gridIconCircle, { backgroundColor: 'rgba(56, 189, 248, 0.12)' }]}>
            <Text style={styles.gridIcon}>📅</Text>
          </View>
          <Text style={styles.gridTitle}>Haftalık Program</Text>
          <Text style={styles.gridDesc}>Ders saatleri ve derslikler</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.gridCard}
          activeOpacity={0.75}
          onPress={() => onNavigateTab('grades')}
        >
          <View style={[styles.gridIconCircle, { backgroundColor: 'rgba(168, 85, 247, 0.12)' }]}>
            <Text style={styles.gridIcon}>📊</Text>
          </View>
          <Text style={styles.gridTitle}>Dönem Notları</Text>
          <Text style={styles.gridDesc}>Vize, final ve başarı durumu</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.gridCard}
          activeOpacity={0.75}
          onPress={() => onNavigateTab('attendance')}
        >
          <View style={[styles.gridIconCircle, { backgroundColor: 'rgba(234, 179, 8, 0.12)' }]}>
            <Text style={styles.gridIcon}>⏱️</Text>
          </View>
          <Text style={styles.gridTitle}>Devamsızlık</Text>
          <Text style={styles.gridDesc}>Kalan devamsızlık hakları</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.gridCard}
          activeOpacity={0.75}
          onPress={() => onNavigateTab('lms')}
        >
          <View style={[styles.gridIconCircle, { backgroundColor: 'rgba(34, 197, 94, 0.12)' }]}>
            <Text style={styles.gridIcon}>📚</Text>
          </View>
          <Text style={styles.gridTitle}>Moodle LMS</Text>
          <Text style={styles.gridDesc}>Ödevler, teslimler ve dokümanlar</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const getDashboardStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: 12,
    fontSize: 14,
  },
  greetingHeader: {
    marginBottom: 16,
  },
  greetingTextContainer: {
    gap: 4,
  },
  greetingTitle: {
    fontSize: 23,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  greetingSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  weatherChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.card,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginTop: 4,
  },
  weatherChipEmoji: {
    fontSize: 14,
    marginRight: 6,
  },
  weatherChipText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  weatherChipTemp: {
    color: colors.text,
    fontWeight: '700',
  },
  profileCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: colors.isDark ? 0.15 : 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  profileMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primarySubtle,
    borderWidth: 1.5,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    color: colors.primary,
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  profileInfo: {
    flex: 1,
    marginRight: 12,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 3,
  },
  studentNo: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 5,
  },
  deptChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.cardAlt,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  deptChipText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  gpaContainer: {
    backgroundColor: colors.primarySubtle,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 74,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  gpaLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 1.2,
  },
  gpaValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
    marginVertical: 1,
  },
  termGpaText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionHeader: {
    marginBottom: 10,
    paddingHorizontal: 2,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.2,
  },
  dateChip: {
    backgroundColor: colors.primarySubtle,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  dateChipText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  nextClassCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: colors.isDark ? 0.12 : 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  classCardContent: {
    gap: 12,
  },
  classTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeChip: {
    backgroundColor: colors.primarySubtle,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    alignItems: 'center',
    marginRight: 14,
    minWidth: 80,
  },
  timeText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '800',
  },
  endTimeText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '500',
  },
  courseMeta: {
    flex: 1,
  },
  courseName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  courseCode: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  classroomChip: {
    backgroundColor: colors.isDark ? 'rgba(52, 211, 153, 0.12)' : 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: colors.isDark ? 'rgba(52, 211, 153, 0.25)' : 'rgba(16, 185, 129, 0.3)',
  },
  classroomChipText: {
    color: colors.isDark ? '#34d399' : '#059669',
    fontSize: 12,
    fontWeight: '600',
  },
  instructorChip: {
    backgroundColor: colors.cardAlt,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
  },
  instructorChipText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  lessonWeatherBar: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
  },
  lessonWeatherEmoji: {
    fontSize: 14,
    marginRight: 6,
  },
  lessonWeatherText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  lessonWeatherBold: {
    color: colors.text,
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 8,
  },
  emptyIcon: {
    fontSize: 28,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  gridCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 16,
    width: '48%',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  gridIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  gridIcon: {
    fontSize: 20,
  },
  gridTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  gridDesc: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 15,
  },
});
