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
import { AuthStorage } from '../storage/authStorage';
import { GradeEntry, SemesterTerm } from '../types/models';

export const GradesScreen: React.FC = () => {
  const [terms, setTerms] = useState<SemesterTerm[]>([]);
  const [selectedTermId, setSelectedTermId] = useState<number | undefined>();
  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSimulatorActive, setIsSimulatorActive] = useState(false);
  const [simulatedFinals, setSimulatedFinals] = useState<Record<string, string>>({});

  const loadTermsAndGrades = async (isPullToRefresh = false) => {
    if (!isPullToRefresh) {
      // Load cached terms and active grades
      const cachedTerms = await AuthStorage.getCachedTerms();
      if (cachedTerms && cachedTerms.length > 0) {
        setTerms(cachedTerms);
        const active = cachedTerms.find((t) => t.isActive);
        const targetTermId = active ? active.termId : cachedTerms[0]?.termId;
        setSelectedTermId(targetTermId);
        if (targetTermId) {
          const cachedGrades = await AuthStorage.getCachedGrades(targetTermId);
          if (cachedGrades && cachedGrades.length > 0) {
            setGrades(cachedGrades);
            setLoading(false);
          }
        }
      }
    }

    try {
      if (isPullToRefresh) setRefreshing(true);
      const termList = await obsClient.getTerms();
      setTerms(termList);
      await AuthStorage.saveCachedTerms(termList);

      const active = termList.find((t) => t.isActive);
      const targetTermId = active ? active.termId : termList[0]?.termId;
      setSelectedTermId(targetTermId);

      if (targetTermId) {
        const gradeList = await obsClient.getGrades(targetTermId);
        setGrades(gradeList);
        await AuthStorage.saveCachedGrades(targetTermId, gradeList);
      }
    } catch (err: any) {
      console.warn('Failed to fetch grades:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleTermChange = async (termId: number) => {
    setSelectedTermId(termId);
    // Check cached first
    const cachedGrades = await AuthStorage.getCachedGrades(termId);
    if (cachedGrades && cachedGrades.length > 0) {
      setGrades(cachedGrades);
    } else {
      setLoading(true);
    }
    try {
      const list = await obsClient.getGrades(termId);
      setGrades(list);
      await AuthStorage.saveCachedGrades(termId, list);
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

  const getGradeLetterAndCoefficient = (score: number) => {
    if (score >= 90) return { letter: 'AA', coeff: 4.0, passed: true };
    if (score >= 85) return { letter: 'BA', coeff: 3.5, passed: true };
    if (score >= 80) return { letter: 'BB', coeff: 3.0, passed: true };
    if (score >= 75) return { letter: 'CB', coeff: 2.5, passed: true };
    if (score >= 70) return { letter: 'CC', coeff: 2.0, passed: true };
    if (score >= 60) return { letter: 'DC', coeff: 1.5, passed: true };
    if (score >= 50) return { letter: 'DD', coeff: 1.0, passed: true };
    if (score >= 40) return { letter: 'FD', coeff: 0.5, passed: false };
    return { letter: 'FF', coeff: 0.0, passed: false };
  };

  const handleApplyPreset = (score: number) => {
    const next: Record<string, string> = {};
    grades.forEach((g) => {
      next[g.courseCode] = String(score);
    });
    setSimulatedFinals(next);
  };

  const handleResetSimulator = () => {
    setSimulatedFinals({});
  };

  // Compute simulated term GPA
  let totalAkts = 0;
  let totalPoints = 0;
  let simulatedCourseCount = 0;

  grades.forEach((item) => {
    const akts = item.akts > 0 ? item.akts : item.credits > 0 ? item.credits : 5;
    const midtermNum = typeof item.midterm === 'number' ? item.midterm : parseFloat(item.midterm || '0');
    const simulatedFinal = simulatedFinals[item.courseCode];
    const finalNum =
      simulatedFinal !== undefined && simulatedFinal !== ''
        ? parseFloat(simulatedFinal)
        : typeof item.finalExam === 'number'
        ? item.finalExam
        : parseFloat(item.finalExam || '0');

    if (simulatedFinal !== undefined && simulatedFinal !== '') {
      simulatedCourseCount++;
    }

    if (midtermNum > 0 || finalNum > 0) {
      const avg = midtermNum * 0.4 + finalNum * 0.6;
      const { coeff } = getGradeLetterAndCoefficient(avg);
      totalPoints += coeff * akts;
      totalAkts += akts;
    }
  });

  const simulatedTermGpa = totalAkts > 0 ? (totalPoints / totalAkts).toFixed(2) : null;

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

      {/* Top Simulator Banner & Controller */}
      <View style={styles.simBanner}>
        <View style={styles.simBannerLeft}>
          <Text style={styles.simBannerTitle}>🎯 Akademik AGNO Simülatörü</Text>
          <Text style={styles.simBannerSub}>
            {isSimulatorActive
              ? (simulatedTermGpa ? `Simüle Dönem AGNO: ${simulatedTermGpa}` : 'Finalleri girerek ortalamanı hesapla')
              : 'Final/büt notlarını girip geçme durumunu hesapla'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.simToggleBtn, isSimulatorActive && styles.simToggleBtnActive]}
          onPress={() => setIsSimulatorActive(!isSimulatorActive)}
          activeOpacity={0.8}
        >
          <Text style={[styles.simToggleBtnText, isSimulatorActive && styles.simToggleBtnTextActive]}>
            {isSimulatorActive ? '✓ Açık' : '🧮 Hesapla'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Preset bar when simulator is active */}
      {isSimulatorActive && grades.length > 0 ? (
        <View style={styles.presetBar}>
          <Text style={styles.presetLabel}>Tüm Finaller:</Text>
          {[50, 65, 75, 85].map((val) => (
            <TouchableOpacity
              key={val}
              style={styles.presetChip}
              onPress={() => handleApplyPreset(val)}
              activeOpacity={0.7}
            >
              <Text style={styles.presetChipText}>{val}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.presetResetChip}
            onPress={handleResetSimulator}
            activeOpacity={0.7}
          >
            <Text style={styles.presetResetText}>✕ Temizle</Text>
          </TouchableOpacity>
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

              const req50 = midtermNum > 0 ? Math.max(0, Math.ceil((50 - midtermNum * 0.4) / 0.6)) : 50;
              const reqCC = midtermNum > 0 ? Math.max(0, Math.ceil((70 - midtermNum * 0.4) / 0.6)) : 70;
              const isSimulated = simulatedFinal !== '';
              const simulatedLetterInfo = calcAvg ? getGradeLetterAndCoefficient(parseFloat(calcAvg)) : null;

              return (
                <View key={`${item.courseCode}-${idx}`} style={[styles.gradeCard, isSimulated && styles.gradeCardSimulated]}>
                  <View style={styles.cardHeader}>
                    <View style={styles.headerTitles}>
                      <Text style={styles.courseName}>{item.courseName}</Text>
                      <Text style={styles.courseCode}>
                        {item.courseCode} • {item.akts} AKTS ({item.credits} Kredi)
                      </Text>
                    </View>
                    <View style={styles.badgeCol}>
                      <View
                        style={[
                          styles.letterBadge,
                          {
                            backgroundColor: isSimulated && simulatedLetterInfo
                              ? getBadgeColor(simulatedLetterInfo.letter)
                              : badgeBg,
                          },
                        ]}
                      >
                        <Text style={styles.letterText}>
                          {isSimulated && simulatedLetterInfo
                            ? `${simulatedLetterInfo.letter}*`
                            : item.letterGrade || '--'}
                        </Text>
                      </View>
                      {item.passed !== undefined || isSimulated ? (
                        <Text
                          style={[
                            styles.passText,
                            (isSimulated && simulatedLetterInfo
                              ? simulatedLetterInfo.passed
                              : item.passed)
                              ? styles.passSuccess
                              : styles.passFail,
                          ]}
                        >
                          {isSimulated && simulatedLetterInfo
                            ? (simulatedLetterInfo.passed ? 'Geçer' : 'Kalır')
                            : (item.passed ? 'Geçti' : 'Kaldı')}
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
                      <Text style={[styles.scoreVal, isSimulated && styles.scoreValSimulated]}>
                        {isSimulated ? `${simulatedFinal}*` : item.finalExam ?? '-'}
                      </Text>
                    </View>

                    <View style={styles.scoreBox}>
                      <Text style={styles.scoreLabel}>BÜT</Text>
                      <Text style={styles.scoreVal}>{item.makeupExam ?? '-'}</Text>
                    </View>

                    <View style={styles.scoreBox}>
                      <Text style={styles.scoreLabel}>ORTALAMA</Text>
                      <Text style={[styles.scoreVal, { color: isSimulated ? '#10b981' : '#38bdf8' }]}>
                        {calcAvg ? `${calcAvg}*` : item.gradeAverage || '-'}
                      </Text>
                    </View>
                  </View>

                  {/* Simulator & Pass Requirement Box */}
                  {isSimulatorActive || item.finalExam === null || item.finalExam === undefined || item.finalExam === '' ? (
                    <View style={styles.simCardBox}>
                      {/* Passing requirement hint */}
                      <View style={styles.simReqRow}>
                        <Text style={styles.simReqIcon}>🎯</Text>
                        <Text style={styles.simReqText}>
                          {midtermNum > 0
                            ? (req50 <= 0
                                ? 'Tebrikler! Vizeniz çok iyi, finalden 0 alsanız bile 50 barajını geçiyorsunuz! 🎉'
                                : req50 > 100
                                ? 'Dikkat: 50 barajı için 100 yetmiyor, büt sınavı gerekebilir ⚠️'
                                : `50 barajı için finale en az ${req50}, CC için en az ${reqCC} almalısınız.`)
                            : 'Vize girilmediğinde geçmek için final en az 50 olmalıdır.'}
                        </Text>
                      </View>

                      {/* Final simulation inputs */}
                      <View style={styles.simInputRow}>
                        <Text style={styles.simInputLabel}>Final Tahmini:</Text>
                        <TextInput
                          style={styles.simInput}
                          placeholder={item.finalExam ? String(item.finalExam) : 'Örn: 70'}
                          placeholderTextColor="#64748b"
                          keyboardType="numeric"
                          value={simulatedFinal}
                          onChangeText={(txt) =>
                            setSimulatedFinals((prev) => ({ ...prev, [item.courseCode]: txt }))
                          }
                        />
                        <View style={styles.quickChipsGroup}>
                          {[50, 65, 80].map((quick) => (
                            <TouchableOpacity
                              key={quick}
                              style={styles.quickChip}
                              onPress={() =>
                                setSimulatedFinals((prev) => ({
                                  ...prev,
                                  [item.courseCode]: String(quick),
                                }))
                              }
                            >
                              <Text style={styles.quickChipText}>{quick}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        {simulatedLetterInfo ? (
                          <View style={styles.simGradeBadge}>
                            <Text style={styles.simGradeBadgeText}>
                              {simulatedLetterInfo.letter} ({simulatedLetterInfo.coeff.toFixed(1)})
                            </Text>
                          </View>
                        ) : null}
                      </View>
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
  simBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  simBannerLeft: {
    flex: 1,
    paddingRight: 10,
  },
  simBannerTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  simBannerSub: {
    color: '#94a3b8',
    fontSize: 11,
  },
  simToggleBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  simToggleBtnActive: {
    backgroundColor: '#2563eb',
    borderColor: '#3b82f6',
  },
  simToggleBtnText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  simToggleBtnTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  presetBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  presetLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
  },
  presetChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  presetChipText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
  },
  presetResetChip: {
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#334155',
  },
  presetResetText: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: '700',
  },
  gradeCardSimulated: {
    borderColor: '#059669',
    backgroundColor: '#0c1a1f',
  },
  scoreValSimulated: {
    color: '#34d399',
    fontWeight: '800',
  },
  simCardBox: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  simReqRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
    gap: 6,
  },
  simReqIcon: {
    fontSize: 12,
    marginTop: 1,
  },
  simReqText: {
    flex: 1,
    color: '#bae6fd',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
  },
  simInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  simInputLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  simInput: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    width: 65,
    borderWidth: 1,
    borderColor: '#334155',
    textAlign: 'center',
  },
  quickChipsGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  quickChip: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  quickChipText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
  },
  simGradeBadge: {
    marginLeft: 'auto',
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  simGradeBadgeText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '800',
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
