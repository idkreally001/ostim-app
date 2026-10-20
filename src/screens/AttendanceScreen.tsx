import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { obsClient } from '../api/obsClient';
import { AuthStorage } from '../storage/authStorage';
import { AttendanceEntry } from '../types/models';
import { useTheme } from '../theme/ThemeContext';

export const AttendanceScreen: React.FC = () => {
  const { colors } = useTheme();
  const [attendance, setAttendance] = useState<AttendanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAttendance = async (isPullToRefresh = false) => {
    if (!isPullToRefresh) {
      const cached = await AuthStorage.getCachedAttendance();
      if (cached && cached.length > 0) {
        setAttendance(cached);
        setLoading(false);
      }
    }
    try {
      if (isPullToRefresh) setRefreshing(true);
      const data = await obsClient.getAttendance();
      if (data && data.length > 0) {
        setAttendance(data);
        await AuthStorage.saveCachedAttendance(data);
      }
    } catch (err: any) {
      console.warn('Failed to load attendance:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAttendance();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
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
                loadAttendance();
              }}
              tintColor="#3b82f6"
            />
          }
        >
          {attendance.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Devamsızlık bilgisi bulunamadı.</Text>
            </View>
          ) : (
            attendance.map((item, idx) => {
              const totalAbsent = item.theoryAbsence + item.practiceAbsence;
              const max = item.maxAllowedAbsence || 0;
              const remaining = Math.max(0, max - totalAbsent);
              const percentage = max > 0 ? Math.min(100, (totalAbsent / max) * 100) : 0;

              let barColor = '#10b981'; // green
              if (percentage >= 80) barColor = '#ef4444'; // red
              else if (percentage >= 60) barColor = '#f59e0b'; // orange

              return (
                <View key={`${item.courseCode}-${idx}`} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.titleCol}>
                      <Text style={styles.courseName}>{item.courseName}</Text>
                      <Text style={styles.courseCode}>{item.courseCode}</Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        item.status !== 'Devam Ediyor' && styles.statusBadgeFailed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          item.status !== 'Devam Ediyor' && styles.statusTextFailed,
                        ]}
                      >
                        {item.status}
                      </Text>
                    </View>
                  </View>

                  {/* Progress Bar */}
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBarTrack}>
                      <View
                        style={[
                          styles.progressBarFill,
                          { width: `${percentage}%`, backgroundColor: barColor },
                        ]}
                      />
                    </View>
                  </View>

                  {/* Details Row */}
                  <View style={styles.statsRow}>
                    <Text style={styles.statDetail}>
                      Kullanılan:{' '}
                      <Text style={styles.statBold}>
                        {totalAbsent} / {max} Saat
                      </Text>
                    </Text>
                    <Text
                      style={[
                        styles.remainingText,
                        { color: remaining <= 2 && max > 0 ? '#ef4444' : '#94a3b8' },
                      ]}
                    >
                      {max > 0 ? `Kalan Hak: ${remaining} Saat` : 'Sınırsız'}
                    </Text>
                  </View>
                </View>
              );
            })
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#121826',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleCol: {
    flex: 1,
    paddingRight: 8,
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
  },
  statusBadge: {
    backgroundColor: '#064e3b',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeFailed: {
    backgroundColor: '#7f1d1d',
  },
  statusText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '700',
  },
  statusTextFailed: {
    color: '#f87171',
  },
  progressContainer: {
    marginBottom: 10,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#1e293b',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statDetail: {
    color: '#94a3b8',
    fontSize: 12,
  },
  statBold: {
    color: '#f8fafc',
    fontWeight: '700',
  },
  remainingText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
  },
});
