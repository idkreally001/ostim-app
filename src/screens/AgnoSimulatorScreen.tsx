import React, { useEffect, useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { obsClient } from '../api/obsClient';
import { AuthStorage } from '../storage/authStorage';
import { GradeEntry, SemesterTerm, StudentProfile } from '../types/models';
import { useTheme, ThemeColors } from '../theme/ThemeContext';

interface AgnoSimulatorScreenProps {
  onClose: () => void;
}

export const AgnoSimulatorScreen: React.FC<AgnoSimulatorScreenProps> = ({ onClose }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => getSimulatorStyles(colors), [colors]);

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Simulation state: record of courseCode -> { score: string, isBut: boolean }
  const [simulatedScores, setSimulatedScores] = useState<Record<string, { score: string; isBut: boolean }>>({});
  const [targetAgno, setTargetAgno] = useState<number | null>(null);

  useEffect(() => {
    const initData = async () => {
      try {
        const [cachedProfile, cachedTerms] = await Promise.all([
          AuthStorage.getCachedProfile(),
          AuthStorage.getCachedTerms(),
        ]);

        if (cachedProfile) {
          setProfile(cachedProfile);
        }

        const activeTerm = cachedTerms?.find((t) => t.isActive) || cachedTerms?.[0];
        if (activeTerm) {
          const cachedGrades = await AuthStorage.getCachedGrades(activeTerm.termId);
          if (cachedGrades && cachedGrades.length > 0) {
            setGrades(cachedGrades);
            setLoading(false);
          }
        }

        // Fetch fresh profile
        const freshProfile = await obsClient.getProfile().catch(() => null);
        if (freshProfile) setProfile(freshProfile);

        // Fetch grades directly from OBS
        let activeGrades = await obsClient.getGrades().catch(() => []);
        if (!activeGrades || activeGrades.length === 0) {
          const terms = await obsClient.getTerms().catch(() => []);
          const curTerm = terms.find((t) => t.isActive) || terms[0];
          if (curTerm) {
            activeGrades = await obsClient.getGrades(curTerm.termId).catch(() => []);
          }
        }

        // Fallback: If term exam records are not yet published in OBS, populate from active timetable
        if (!activeGrades || activeGrades.length === 0) {
          const timetable =
            (await AuthStorage.getCachedTimetable()) || (await obsClient.getTimetable().catch(() => []));
          if (timetable && timetable.length > 0) {
            const courseMap = new Map<string, GradeEntry>();
            timetable.forEach((t) => {
              if (t.courseCode && !courseMap.has(t.courseCode)) {
                courseMap.set(t.courseCode, {
                  courseCode: t.courseCode,
                  courseName: t.courseName,
                  credits: 3,
                  akts: 5,
                  midterm: null,
                  finalExam: null,
                  makeupExam: null,
                  letterGrade: '',
                });
              }
            });
            activeGrades = Array.from(courseMap.values());
          }
        }

        if (activeGrades && activeGrades.length > 0) {
          setGrades(activeGrades);
        }
      } catch (err: any) {
        console.warn('AgnoSimulatorScreen load error:', err.message);
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, []);

  const getLetterAndCoeff = (score: number) => {
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

  const getBadgeColor = (letter?: string) => {
    if (!letter) return colors.textMuted;
    if (['AA', 'BA', 'BB', 'CB', 'CC'].includes(letter)) return colors.success;
    if (['DC', 'DD'].includes(letter)) return colors.warning;
    return colors.danger;
  };

  const handleSetCourseScore = (courseCode: string, score: string, isBut = false) => {
    setSimulatedScores((prev) => ({
      ...prev,
      [courseCode]: { score, isBut: isBut || (prev[courseCode]?.isBut ?? false) },
    }));
  };

  const handleToggleButMode = (courseCode: string) => {
    setSimulatedScores((prev) => ({
      ...prev,
      [courseCode]: {
        score: prev[courseCode]?.score || '',
        isBut: !prev[courseCode]?.isBut,
      },
    }));
  };

  const handleApplyPresetAll = (score: number) => {
    const next: Record<string, { score: string; isBut: boolean }> = {};
    grades.forEach((g) => {
      next[g.courseCode] = {
        score: String(score),
        isBut: simulatedScores[g.courseCode]?.isBut ?? false,
      };
    });
    setSimulatedScores(next);
  };

  const handleReset = () => {
    setSimulatedScores({});
    setTargetAgno(null);
  };

  // Calculations
  let termAktsTotal = 0;
  let termWeightedPoints = 0;

  grades.forEach((item) => {
    const akts = item.akts > 0 ? item.akts : item.credits > 0 ? item.credits : 5;
    const midtermNum = typeof item.midterm === 'number' ? item.midterm : parseFloat(item.midterm || '0');

    const sim = simulatedScores[item.courseCode];
    const finalScoreNum =
      sim?.score !== undefined && sim.score !== ''
        ? parseFloat(sim.score)
        : typeof item.finalExam === 'number'
        ? item.finalExam
        : parseFloat(item.finalExam || '0');

    if (midtermNum > 0 || finalScoreNum > 0) {
      const avg = midtermNum * 0.4 + finalScoreNum * 0.6;
      const { coeff } = getLetterAndCoeff(avg);
      termWeightedPoints += coeff * akts;
      termAktsTotal += akts;
    }
  });

  const hasSimulatedEntries = termAktsTotal > 0;
  const simulatedAno = hasSimulatedEntries ? termWeightedPoints / termAktsTotal : 0;

  // Cumulative CGPA calculation
  // Typical student has ~30 AKTS per completed semester
  // If student is 4th semester, completed ~90 AKTS. We estimate based on term ID or default 60 AKTS
  const currentCgpa = typeof profile?.gpa === 'number' && !isNaN(profile.gpa) ? profile.gpa : 0;
  const estimatedPastAkts = 60; // 2 semesters baseline
  const projectedCgpa =
    hasSimulatedEntries && currentCgpa > 0
      ? (currentCgpa * estimatedPastAkts + termWeightedPoints) / (estimatedPastAkts + termAktsTotal)
      : (hasSimulatedEntries ? simulatedAno : currentCgpa);

  const cgpaDelta = hasSimulatedEntries && currentCgpa > 0 ? projectedCgpa - currentCgpa : 0;

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.closeBtnText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🎯 AGNO Simülatörü</Text>
        <TouchableOpacity style={styles.resetBtn} onPress={handleReset} activeOpacity={0.7}>
          <Text style={styles.resetBtnText}>Sıfırla</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {/* Cumulative Projected CGPA Card */}
          <View style={styles.heroCard}>
            <Text style={styles.heroCardSub}>KÜMÜLATİF AKADEMİK ETKİ</Text>
            <View style={styles.heroStatsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Mevcut AGNO</Text>
                <Text style={styles.statValCurrent}>{currentCgpa > 0 ? currentCgpa.toFixed(2) : '—'}</Text>
              </View>

              <View style={styles.statArrowBox}>
                <Text style={styles.statArrow}>➔</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Tahmini AGNO</Text>
                <Text style={styles.statValProjected}>{projectedCgpa > 0 ? projectedCgpa.toFixed(2) : '—'}</Text>
              </View>
            </View>

            <View style={styles.heroFooter}>
              <View style={styles.anoPill}>
                <Text style={styles.anoPillText}>
                  {hasSimulatedEntries ? (
                    <>
                      Dönem ANO: <Text style={styles.anoPillBold}>{simulatedAno.toFixed(2)}</Text> ({termAktsTotal} AKTS)
                    </>
                  ) : (
                    'Not girerek dönemi simüle edin'
                  )}
                </Text>
              </View>
              {hasSimulatedEntries && currentCgpa > 0 && (
                <View
                  style={[
                    styles.deltaPill,
                    { backgroundColor: cgpaDelta >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)' },
                  ]}
                >
                  <Text
                    style={[
                      styles.deltaPillText,
                      { color: cgpaDelta >= 0 ? colors.success : colors.danger },
                    ]}
                  >
                    {cgpaDelta >= 0 ? `+${cgpaDelta.toFixed(2)} 🚀` : `${cgpaDelta.toFixed(2)} ⚠️`}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Goal Seek / Quick Presets */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Hızlı Senaryo Çipleri</Text>
          </View>
          <View style={styles.presetsRow}>
            {[50, 65, 75, 85].map((preset) => (
              <TouchableOpacity
                key={preset}
                style={styles.presetChip}
                onPress={() => handleApplyPresetAll(preset)}
                activeOpacity={0.7}
              >
                <Text style={styles.presetChipText}>Hepsi {preset}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Course Simulation List */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Dersler & Not Girişi</Text>
            <Text style={styles.courseCountText}>{grades.length} Ders</Text>
          </View>

          {grades.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Simüle edilecek aktif ders bulunamadı.</Text>
            </View>
          ) : (
            grades.map((item, idx) => {
              const midtermNum = typeof item.midterm === 'number' ? item.midterm : parseFloat(item.midterm || '0');
              const sim = simulatedScores[item.courseCode];
              const scoreVal = sim?.score || '';
              const isBut = sim?.isBut ?? false;

              const finalScoreNum = scoreVal !== '' ? parseFloat(scoreVal) : 0;
              const calcAvg = midtermNum > 0 && finalScoreNum > 0 ? midtermNum * 0.4 + finalScoreNum * 0.6 : 0;
              const letterInfo = calcAvg > 0 ? getLetterAndCoeff(calcAvg) : null;
              const badgeBg = letterInfo ? getBadgeColor(letterInfo.letter) : colors.textMuted;

              const req50 = midtermNum > 0 ? Math.max(0, Math.ceil((50 - midtermNum * 0.4) / 0.6)) : 50;
              const reqCC = midtermNum > 0 ? Math.max(0, Math.ceil((70 - midtermNum * 0.4) / 0.6)) : 70;

              return (
                <View key={`${item.courseCode}-${idx}`} style={styles.courseCard}>
                  <View style={styles.courseHeader}>
                    <View style={styles.courseTitles}>
                      <Text style={styles.courseName}>{item.courseName}</Text>
                      <Text style={styles.courseCode}>
                        {item.courseCode} • {item.akts} AKTS
                      </Text>
                    </View>
                    {letterInfo ? (
                      <View style={[styles.letterBadge, { backgroundColor: badgeBg }]}>
                        <Text style={styles.letterText}>{letterInfo.letter}</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.scoresRow}>
                    <View style={styles.scoreCol}>
                      <Text style={styles.scoreLabel}>VİZE</Text>
                      <Text style={styles.scoreVal}>{item.midterm ?? '-'}</Text>
                    </View>

                    <View style={styles.scoreCol}>
                      <Text style={styles.scoreLabel}>{isBut ? 'BÜT TAHMİN' : 'FİNAL TAHMİN'}</Text>
                      <TextInput
                        style={styles.scoreInput}
                        placeholder={item.finalExam ? String(item.finalExam) : 'Not'}
                        placeholderTextColor={colors.textMuted}
                        keyboardType="numeric"
                        value={scoreVal}
                        onChangeText={(txt) => handleSetCourseScore(item.courseCode, txt)}
                      />
                    </View>

                    <View style={styles.scoreCol}>
                      <Text style={styles.scoreLabel}>ORTALAMA</Text>
                      <Text style={[styles.scoreVal, { color: colors.primary }]}>
                        {calcAvg > 0 ? calcAvg.toFixed(1) : '-'}
                      </Text>
                    </View>
                  </View>

                  {/* Mode switcher and Quick Chips */}
                  <View style={styles.cardActionsRow}>
                    <TouchableOpacity
                      style={[styles.examModeBtn, isBut && styles.examModeBtnActive]}
                      onPress={() => handleToggleButMode(item.courseCode)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.examModeBtnText, isBut && styles.examModeBtnTextActive]}>
                        {isBut ? '🔁 Büt Modu' : '📝 Final Modu'}
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.quickChipsGroup}>
                      {[50, 65, 80].map((quick) => (
                        <TouchableOpacity
                          key={quick}
                          style={styles.quickChip}
                          onPress={() => handleSetCourseScore(item.courseCode, String(quick))}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.quickChipText}>{quick}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Threshold Hint & Warning */}
                  {scoreVal !== '' && parseFloat(scoreVal) < 50 ? (
                    <View style={styles.warningBox}>
                      <Text style={styles.warningText}>
                        ⚠️ Final notu 50'nin altında. Geçme barajı için en az 50 almalısınız.
                      </Text>
                    </View>
                  ) : midtermNum > 0 ? (
                    <View style={styles.reqHintRow}>
                      <Text style={styles.reqHintText}>
                        🎯 Geçmek için: min <Text style={styles.reqHintBold}>{req50}</Text> • CC için min{' '}
                        <Text style={styles.reqHintBold}>{reqCC}</Text>
                      </Text>
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

const getSimulatorStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    header: {
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      backgroundColor: colors.headerBg,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    closeBtn: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
      backgroundColor: colors.cardAlt,
    },
    closeBtnText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '700',
    },
    headerTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
    },
    resetBtn: {
      paddingVertical: 6,
      paddingHorizontal: 10,
    },
    resetBtnText: {
      color: colors.danger,
      fontSize: 13,
      fontWeight: '700',
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scroll: {
      flex: 1,
    },
    content: {
      padding: 16,
      paddingBottom: 32,
      gap: 14,
    },
    heroCard: {
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: colors.isDark ? 0.15 : 0.05,
      shadowRadius: 10,
      elevation: 3,
    },
    heroCardSub: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.2,
      marginBottom: 12,
    },
    heroStatsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      marginBottom: 16,
    },
    statBox: {
      alignItems: 'center',
    },
    statLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      marginBottom: 4,
      fontWeight: '600',
    },
    statValCurrent: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.textSecondary,
    },
    statArrowBox: {
      paddingHorizontal: 8,
    },
    statArrow: {
      fontSize: 20,
      color: colors.primary,
      fontWeight: '800',
    },
    statValProjected: {
      fontSize: 32,
      fontWeight: '900',
      color: colors.primary,
    },
    heroFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
    },
    anoPill: {
      backgroundColor: colors.cardAlt,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 9999,
    },
    anoPillText: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    anoPillBold: {
      color: colors.text,
      fontWeight: '700',
    },
    deltaPill: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 9999,
    },
    deltaPillText: {
      fontSize: 11,
      fontWeight: '800',
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 4,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    courseCountText: {
      fontSize: 12,
      color: colors.textMuted,
    },
    presetsRow: {
      flexDirection: 'row',
      gap: 8,
    },
    presetChip: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: 'center',
    },
    presetChipText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '700',
    },
    emptyCard: {
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 24,
      alignItems: 'center',
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 13,
    },
    courseCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      gap: 12,
    },
    courseHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    courseTitles: {
      flex: 1,
      marginRight: 10,
    },
    courseName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
      marginBottom: 2,
    },
    courseCode: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '500',
    },
    letterBadge: {
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 8,
      minWidth: 36,
      alignItems: 'center',
    },
    letterText: {
      color: '#ffffff',
      fontWeight: '800',
      fontSize: 12,
    },
    scoresRow: {
      flexDirection: 'row',
      backgroundColor: colors.cardAlt,
      borderRadius: 14,
      padding: 10,
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    scoreCol: {
      alignItems: 'center',
      flex: 1,
    },
    scoreLabel: {
      color: colors.textMuted,
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.5,
      marginBottom: 3,
    },
    scoreVal: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    scoreInput: {
      height: 32,
      minWidth: 54,
      textAlign: 'center',
      backgroundColor: colors.card,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primary,
      color: colors.text,
      fontSize: 14,
      fontWeight: '800',
      paddingVertical: 2,
      paddingHorizontal: 6,
    },
    cardActionsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    examModeBtn: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      backgroundColor: colors.cardAlt,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    examModeBtnActive: {
      backgroundColor: colors.primarySubtle,
      borderColor: colors.primary,
    },
    examModeBtnText: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '600',
    },
    examModeBtnTextActive: {
      color: colors.primary,
      fontWeight: '700',
    },
    quickChipsGroup: {
      flexDirection: 'row',
      gap: 6,
    },
    quickChip: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: colors.cardAlt,
    },
    quickChipText: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: '700',
    },
    warningBox: {
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: 'rgba(239, 68, 68, 0.25)',
    },
    warningText: {
      color: colors.danger,
      fontSize: 11,
      fontWeight: '600',
    },
    reqHintRow: {
      paddingHorizontal: 4,
    },
    reqHintText: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    reqHintBold: {
      color: colors.text,
      fontWeight: '700',
    },
  });
