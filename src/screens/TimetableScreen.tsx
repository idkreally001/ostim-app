import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { obsClient } from '../api/obsClient';
import { AuthStorage } from '../storage/authStorage';
import { AppAlert } from '../utils/alertHelper';
import { FileHelper } from '../utils/fileHelper';
import { TimetableEntry } from '../types/models';
import { useTheme } from '../theme/ThemeContext';

const DAYS = [
  { id: 0, label: 'Pzt' },
  { id: 1, label: 'Sal' },
  { id: 2, label: 'Çar' },
  { id: 3, label: 'Per' },
  { id: 4, label: 'Cum' },
];

export const TimetableScreen: React.FC = () => {
  const { colors } = useTheme();
  const [schedule, setSchedule] = useState<TimetableEntry[]>([]);
  const [isOffline, setIsOffline] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number>(() => {
    const day = new Date().getDay(); // 1=Mon ... 5=Fri
    return day >= 1 && day <= 5 ? day - 1 : 0;
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTimetable = async (isPullToRefresh = false) => {
    if (!isPullToRefresh) {
      // 1. Instant offline cache load
      const cached = await AuthStorage.getCachedTimetable();
      if (cached && cached.length > 0) {
        setSchedule(cached);
        setLoading(false);
      }
    }

    try {
      if (isPullToRefresh) setRefreshing(true);
      const data = await obsClient.getTimetable();
      if (data && data.length > 0) {
        setSchedule(data);
        setIsOffline(false);
        await AuthStorage.saveCachedTimetable(data);
      }
    } catch (err: any) {
      console.warn('Failed to load timetable:', err.message);
      setIsOffline(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTimetable();
  }, []);

  const exportCsv = async () => {
    if (schedule.length === 0) {
      AppAlert.alert('Bilgi', 'Dışa aktarılacak ders bulunamadı.');
      return;
    }

    const dayMap: Record<number, string> = {
      0: 'Pazartesi',
      1: 'Salı',
      2: 'Çarşamba',
      3: 'Perşembe',
      4: 'Cuma',
    };

    const rows = [
      ['Gün', 'Başlangıç', 'Bitiş', 'Ders Kodu', 'Ders Adı', 'Derslik', 'Öğretim Elemanı'],
      ...schedule.map((item) => [
        `"${dayMap[item.dayId] || item.dayName || ''}"`,
        `"${item.startTime}"`,
        `"${item.endTime}"`,
        `"${item.courseCode}"`,
        `"${item.courseName.replace(/"/g, '""')}"`,
        `"${item.classroom.replace(/"/g, '""')}"`,
        `"${(item.instructor || '').replace(/"/g, '""')}"`,
      ]),
    ];

    const csvContent = '\uFEFF' + rows.map((r) => r.join(',')).join('\r\n');
    await FileHelper.exportAndShareFile(
      'ostim_haftalik_ders_programi.csv',
      csvContent,
      'text/csv'
    );
  };

  const exportIcs = async () => {
    if (schedule.length === 0) {
      AppAlert.alert('Bilgi', 'Dışa aktarılacak ders bulunamadı.');
      return;
    }

    const icsDays = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
    let eventsStr = '';

    schedule.forEach((item, index) => {
      const dayCode = icsDays[item.dayId] || 'MO';
      const cleanStart = item.startTime.replace(':', '') + '00';
      const cleanEnd = item.endTime.replace(':', '') + '00';

      eventsStr += `BEGIN:VEVENT\r\n`;
      eventsStr += `UID:ostim-class-${item.courseCode}-${item.dayId}-${index}@ostim.edu.tr\r\n`;
      eventsStr += `SUMMARY:${item.courseCode} - ${item.courseName}\r\n`;
      eventsStr += `LOCATION:${item.classroom}\r\n`;
      eventsStr += `DESCRIPTION:Derslik: ${item.classroom}\\nÖğretim Elemanı: ${item.instructor || 'Belirtilmedi'}\r\n`;
      eventsStr += `RRULE:FREQ=WEEKLY;BYDAY=${dayCode}\r\n`;
      eventsStr += `DTSTART;TZID=Europe/Istanbul:20261019T${cleanStart}\r\n`;
      eventsStr += `DTEND;TZID=Europe/Istanbul:20261019T${cleanEnd}\r\n`;
      eventsStr += `END:VEVENT\r\n`;
    });

    const icsContent =
      `BEGIN:VCALENDAR\r\n` +
      `VERSION:2.0\r\n` +
      `PRODID:-//OSTIM Teknik Universitesi//Ders Programi//TR\r\n` +
      `CALSCALE:GREGORIAN\r\n` +
      `METHOD:PUBLISH\r\n` +
      `X-WR-CALNAME:OSTİM Haftalık Ders Programı\r\n` +
      `X-WR-TIMEZONE:Europe/Istanbul\r\n` +
      eventsStr +
      `END:VCALENDAR\r\n`;

    await FileHelper.exportAndShareFile(
      'ostim_ders_programi.ics',
      icsContent,
      'text/calendar'
    );
  };

  const dayClasses = schedule
    .filter((c) => c.dayId === selectedDay)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Top Bar with Day Tabs and Export Buttons */}
      <View style={[styles.tabBar, { backgroundColor: colors.headerBg, borderBottomColor: colors.cardBorder }]}>
        <View style={styles.daysRow}>
          {DAYS.map((day) => {
            const isActive = day.id === selectedDay;
            return (
              <TouchableOpacity
                key={day.id}
                style={[styles.tab, isActive && styles.activeTab]}
                onPress={() => setSelectedDay(day.id)}
              >
                <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                  {day.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.exportGroup}>
          <TouchableOpacity style={styles.exportBtn} onPress={exportCsv} activeOpacity={0.7}>
            <Text style={styles.exportBtnText}>📥 CSV</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.exportBtnIcs} onPress={exportIcs} activeOpacity={0.7}>
            <Text style={styles.exportBtnIcsText}>📅 Takvim</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Offline Mode Banner */}
      {isOffline && schedule.length > 0 ? (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>⚡ Çevrimdışı Mod (Önbellekten Yüklendi)</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchTimetable();
              }}
              tintColor="#3b82f6"
            />
          }
        >
          {dayClasses.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🎉</Text>
              <Text style={styles.emptyTitle}>Bugün ders yok!</Text>
              <Text style={styles.emptySubtitle}>İstediğiniz gibi dinlenebilirsiniz.</Text>
            </View>
          ) : (
            dayClasses.map((item, idx) => (
              <View key={`${item.courseCode}-${idx}`} style={styles.classCard}>
                <View style={styles.timeColumn}>
                  <Text style={styles.startTime}>{item.startTime}</Text>
                  <View style={styles.timeDivider} />
                  <Text style={styles.endTime}>{item.endTime}</Text>
                </View>
                <View style={styles.infoColumn}>
                  <Text style={styles.courseName}>{item.courseName}</Text>
                  <Text style={styles.courseCode}>{item.courseCode}</Text>
                  <View style={styles.bottomRow}>
                    <View style={styles.roomTag}>
                      <Text style={styles.roomText}>📍 {item.classroom}</Text>
                    </View>
                    {item.instructor ? (
                      <Text style={styles.instructorText} numberOfLines={1}>
                        👤 {item.instructor}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  daysRow: {
    flexDirection: 'row',
    flex: 1,
    marginRight: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 12,
    marginHorizontal: 2,
  },
  activeTab: {
    backgroundColor: '#2563eb',
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  exportGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  exportBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  exportBtnText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
  },
  exportBtnIcs: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  exportBtnIcsText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '700',
  },
  list: {
    flex: 1,
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  classCard: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  timeColumn: {
    width: 65,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#1e293b',
    paddingRight: 10,
    marginRight: 12,
  },
  startTime: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '700',
  },
  timeDivider: {
    width: 2,
    height: 12,
    backgroundColor: '#334155',
    marginVertical: 4,
  },
  endTime: {
    color: '#64748b',
    fontSize: 12,
  },
  infoColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  courseName: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  courseCode: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 8,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  roomTag: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  roomText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '600',
  },
  instructorText: {
    color: '#94a3b8',
    fontSize: 11,
    flex: 1,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySubtitle: {
    color: '#64748b',
    fontSize: 13,
  },
  offlineBanner: {
    backgroundColor: '#1e3a8a',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3b82f6',
    alignItems: 'center',
  },
  offlineBannerText: {
    color: '#bfdbfe',
    fontSize: 12,
    fontWeight: '700',
  },
});
