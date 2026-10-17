import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { obsClient } from '../api/obsClient';
import { GradeEntry, SemesterTerm } from '../types/models';

export const GradesScreen: React.FC = () => {
  const [terms, setTerms] = useState<SemesterTerm[]>([]);
  const [selectedTermId, setSelectedTermId] = useState<number | undefined>();
  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [simulatedFinals, setSimulatedFinals] = useState<Record<string, string>>({});

  const loadTermsAndGrades = async () => {
    try {
      const termList = await obsClient.getTerms();
      setTerms(termList);

      const active = termList.find((t) => t.isActive);
      const targetTermId = active ? active.termId : termList[0]?.termId;
      setSelectedTermId(targetTermId);

      const gradeList = await obsClient.getGrades(targetTermId);
      setGrades(gradeList);
    } catch (err: any) {
      console.warn('Failed to fetch grades:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleTermChange = async (termId: number) => {
    setSelectedTermId(termId);
    setLoading(true);
    try {
      const list = await obsClient.getGrades(termId);
      setGrades(list);
    } catch (err: any) {
      console.warn('Failed to load grades for term:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTermsAndGrades();
  }, []);

  const getBadgeColor = (letter?: string) => {
    if (!letter) return '#475569';
    if (['AA', 'BA', 'BB', 'CB', 'CC'].includes(letter)) return '#10b981';
    if (['DC', 'DD'].includes(letter)) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <View style={styles.container}>
      {/* Term Selector Pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.termScroll}>
        {terms.map((t) => {
          const isSelected = t.termId === selectedTermId;
          return (
            <TouchableOpacity
              key={t.termId}
              style={[styles.termPill, isSelected && styles.activeTermPill]}
              onPress={() => handleTermChange(t.termId)}
            >
              <Text style={[styles.termText, isSelected && styles.activeTermText]}>
                {t.termName}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

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
                loadTermsAndGrades();
              }}
              tintColor="#3b82f6"
            />
          }
        >
          {grades.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Bu dönem için girilmiş not bulunmuyor.</Text>
            </View>
          ) : (
            grades.map((item, idx) => {
              const badgeBg = getBadgeColor(item.letterGrade);
              const simulatedFinal = simulatedFinals[item.courseCode] || '';
              const midtermNum = typeof item.midterm === 'number' ? item.midterm : parseFloat(item.midterm || '0');
              const finalNum = simulatedFinal ? parseFloat(simulatedFinal) : (typeof item.finalExam === 'number' ? item.finalExam : parseFloat(item.finalExam || '0'));
              const calcAvg = midtermNum > 0 && finalNum > 0 ? (midtermNum * 0.4 + finalNum * 0.6).toFixed(1) : null;

              return (
                <View key={`${item.courseCode}-${idx}`} style={styles.gradeCard}>
                  <View style={styles.cardHeader}>
                    <View style={styles.headerTitles}>
                      <Text style={styles.courseName}>{item.courseName}</Text>
                      <Text style={styles.courseCode}>
                        {item.courseCode} • {item.akts} AKTS ({item.credits} Kredi)
                      </Text>
                    </View>
                    <View style={styles.badgeCol}>
                      <View style={[styles.letterBadge, { backgroundColor: badgeBg }]}>
                        <Text style={styles.letterText}>{item.letterGrade || '--'}</Text>
                      </View>
                      {item.passed !== undefined ? (
                        <Text style={[styles.passText, item.passed ? styles.passSuccess : styles.passFail]}>
                          {item.passed ? 'Geçti' : 'Kaldı'}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.scoresRow}>
                    <View style={styles.scoreBox}>
                      <Text style={styles.scoreLabel}>VİZE (%40)</Text>
                      <Text style={styles.scoreVal}>{item.midterm ?? '-'}</Text>
                    </View>

                    <View style={styles.scoreBox}>
                      <Text style={styles.scoreLabel}>FİNAL (%60)</Text>
                      <Text style={styles.scoreVal}>{item.finalExam ?? '-'}</Text>
                    </View>

                    <View style={styles.scoreBox}>
                      <Text style={styles.scoreLabel}>BÜT</Text>
                      <Text style={styles.scoreVal}>{item.makeupExam ?? '-'}</Text>
                    </View>

                    <View style={styles.scoreBox}>
                      <Text style={styles.scoreLabel}>ORTALAMA</Text>
                      <Text style={[styles.scoreVal, { color: '#38bdf8' }]}>
                        {calcAvg || item.gradeAverage || '-'}
                      </Text>
                    </View>
                  </View>

                  {/* Smart Simulator input if final is not yet graded */}
                  {item.finalExam === null || item.finalExam === undefined || item.finalExam === '' ? (
                    <View style={styles.simulatorRow}>
                      <Text style={styles.simLabel}>💡 Final Tahmini:</Text>
                      <TextInput
                        style={styles.simInput}
                        placeholder="Örn: 65"
                        placeholderTextColor="#64748b"
                        keyboardType="numeric"
                        value={simulatedFinal}
                        onChangeText={(txt) =>
                          setSimulatedFinals((prev) => ({ ...prev, [item.courseCode]: txt }))
                        }
                      />
                      {calcAvg ? (
                        <Text style={styles.simResult}>Tahmini Ortalama: {calcAvg}</Text>
                      ) : null}
                    </View>
                  ) : null}
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
  termScroll: {
    maxHeight: 56,
    backgroundColor: '#121826',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingHorizontal: 12,
  },
  termPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    marginRight: 8,
    marginVertical: 8,
  },
  activeTermPill: {
    backgroundColor: '#2563eb',
  },
  termText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  activeTermText: {
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
  gradeCard: {
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
    marginBottom: 14,
  },
  headerTitles: {
    flex: 1,
    paddingRight: 10,
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
  badgeCol: {
    alignItems: 'flex-end',
  },
  letterBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: 'center',
    minWidth: 42,
  },
  letterText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
  passText: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
  passSuccess: {
    color: '#34d399',
  },
  passFail: {
    color: '#f87171',
  },
  scoresRow: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    justifyContent: 'space-around',
  },
  scoreBox: {
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 4,
  },
  scoreVal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f8fafc',
  },
  simulatorRow: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    flexDirection: 'row',
    alignItems: 'center',
  },
  simLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginRight: 8,
  },
  simInput: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    width: 60,
    borderWidth: 1,
    borderColor: '#334155',
  },
  simResult: {
    fontSize: 12,
    color: '#34d399',
    fontWeight: '600',
    marginLeft: 10,
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
