import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { obsClient } from '../api/obsClient';
import { TimetableEntry } from '../types/models';

const DAYS = [
  { id: 1, label: 'Pzt' },
  { id: 2, label: 'Sal' },
  { id: 3, label: 'Çar' },
  { id: 4, label: 'Per' },
  { id: 5, label: 'Cum' },
];

export const TimetableScreen: React.FC = () => {
  const [schedule, setSchedule] = useState<TimetableEntry[]>([]);
  const [selectedDay, setSelectedDay] = useState<number>(() => {
    const day = new Date().getDay();
    return day >= 1 && day <= 5 ? day : 1;
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTimetable = async () => {
    try {
      const data = await obsClient.getTimetable();
      setSchedule(data);
    } catch (err: any) {
      console.warn('Failed to load timetable:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTimetable();
  }, []);

  const dayClasses = schedule
    .filter((c) => c.dayId === selectedDay)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <View style={styles.container}>
      {/* Day Tabs */}
      <View style={styles.tabBar}>
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
    backgroundColor: '#0a0e17',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#121826',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    marginHorizontal: 3,
  },
  activeTab: {
    backgroundColor: '#2563eb',
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#ffffff',
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
    backgroundColor: '#121826',
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
});
