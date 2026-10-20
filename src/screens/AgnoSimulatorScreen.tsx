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
import { GradeEntry, StudentProfile } from '../types/models';
import { useTheme, ThemeColors } from '../theme/ThemeContext';

interface AgnoSimulatorScreenProps {
  onClose: () => void;
}

interface SimCourseState {
  midterm: string;
  finalExam: string;
  isBut: boolean;
}

export const AgnoSimulatorScreen: React.FC<AgnoSimulatorScreenProps> = ({ onClose }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => getSimulatorStyles(colors), [colors]);

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Simulation state: courseCode -> { midterm, finalExam, isBut }
  const [simulatedScores, setSimulatedScores] = useState<Record<string, SimCourseState>>({});

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

        let activeGrades: GradeEntry[] = [];
        const activeTerm = cachedTerms?.find((t) => t.isActive) || cachedTerms?.[0];
        if (activeTerm) {
          const cached = await AuthStorage.getCachedGrades(activeTerm.termId);
          if (cached && cached.length > 0) {
            activeGrades = cached;
          }
        }

        // Fresh profile
        obsClient.getProfile().then((p) => {
          if (p) setProfile(p);
        }).catch(() => {});

        // Fresh grades from OBS if not cached
        if (activeGrades.length === 0) {
          const fetched = await obsClient.getGrades().catch(() => []);
          if (fetched && fetched.length > 0) {
            activeGrades = fetched;
          } else {
            const terms = await obsClient.getTerms().catch(() => []);
            const curTerm = terms.find((t) => t.isActive) || terms[0];
            if (curTerm) {
              activeGrades = await obsClient.getGrades(curTerm.termId).catch(() => []);
            }
          }
        }

        // Fallback: Populate enrolled courses from active timetable if exam list not yet published
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
          // Pre-fill initial simulation state with OBS midterms/finals if available
          const initialSim: Record<string, SimCourseState> = {};
          activeGrades.forEach((g) => {
            initialSim[g.courseCode] = {
              midterm: g.midterm !== null && g.midterm !== undefined ? String(g.midterm) : '',
              finalExam: g.finalExam !== null && g.finalExam !== undefined ? String(g.finalExam) : '',
              isBut: false,
            };
          });
          setSimulatedScores(initialSim);
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

  const handleSetMidterm = (courseCode: string, midterm: string) => {
    setSimulatedScores((prev) => ({
      ...prev,
      [courseCode]: {
        midterm,
        finalExam: prev[courseCode]?.finalExam || '',
        isBut: prev[courseCode]?.isBut ?? false,
      },
    }));
  };

  const handleSetFinal = (courseCode: string, finalExam: string) => {
    setSimulatedScores((prev) => ({
      ...prev,
      [courseCode]: {
        midterm: prev[courseCode]?.midterm || '',
        finalExam,
        isBut: prev[courseCode]?.isBut ?? false,
      },
    }));
  };

  const handleToggleButMode = (courseCode: string) => {
    setSimulatedScores((prev) => ({
      ...prev,
      [courseCode]: {
        midterm: prev[courseCode]?.midterm || '',
        finalExam: prev[courseCode]?.finalExam || '',
        isBut: !prev[courseCode]?.isBut,
      },
    }));
  };

  // Preset 1: Sets BOTH Midterm and Final for all courses (e.g. "Hepsi 85", "Hepsi 100")
  const handleApplyPresetAllExams = (score: number) => {
    const next: Record<string, SimCourseState> = {};
    grades.forEach((g) => {
      next[g.courseCode] = {
        midterm: String(score),
        finalExam: String(score),
        isBut: simulatedScores[g.courseCode]?.isBut ?? false,
      };
    });
    setSimulatedScores(next);
  };

  // Preset 2: Keeps existing Midterm, sets all Finals
  const handleApplyPresetFinalsOnly = (score: number) => {
    const next: Record<string, SimCourseState> = {};
    grades.forEach((g) => {
      next[g.courseCode] = {
        midterm: simulatedScores[g.courseCode]?.midterm ?? (g.midterm ? String(g.midterm) : ''),
        finalExam: String(score),
        isBut: simulatedScores[g.courseCode]?.isBut ?? false,
      };
    });
    setSimulatedScores(next);
  };

  const handleReset = () => {
    const resetSim: Record<string, SimCourseState> = {};
    grades.forEach((g) => {
      resetSim[g.courseCode] = {
        midterm: g.midterm !== null && g.midterm !== undefined ? String(g.midterm) : '',
        finalExam: g.finalExam !== null && g.finalExam !== undefined ? String(g.finalExam) : '',
        isBut: false,
      };
    });
    setSimulatedScores(resetSim);
  };

  // Calculations
  let termAktsTotal = 0;
  let termWeightedPoints = 0;

  grades.forEach((item) => {
    const akts = item.akts > 0 ? item.akts : item.credits > 0 ? item.credits : 5;
    const sim = simulatedScores[item.courseCode];

    const mStr = sim?.midterm?.trim() ?? '';
    const fStr = sim?.finalExam?.trim() ?? '';

    const hasM = mStr !== '';
    const hasF = fStr !== '';

    let courseAvg: number | null = null;

    if (hasM && hasF) {
      const m = parseFloat(mStr);
      const f = parseFloat(fStr);
      if (!isNaN(m) && !isNaN(f)) {
        courseAvg = m * 0.4 + f * 0.6;
      }
    } else if (hasF && !hasM) {
      // Only final is simulated: treat as overall course target grade
      const f = parseFloat(fStr);
      if (!isNaN(f)) {
        courseAvg = f;
      }
    }

    if (courseAvg !== null && !isNaN(courseAvg)) {
      const { coeff } = getLetterAndCoeff(courseAvg);
      termWeightedPoints += coeff * akts;
      termAktsTotal += akts;
    }
  });

  const hasSimulatedEntries = termAktsTotal > 0;
  const simulatedAno = hasSimulatedEntries ? termWeightedPoints / termAktsTotal : 0;

  // Cumulative CGPA calculation
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

          {/* Quick Scenario Chips */}
          <View style={styles.presetsContainer}>
            <Text style={styles.presetsLabel}>TÜM DERSLERİ AYARLA (VİZE + FİNAL)</Text>
            <View style={styles.presetsRow}>
              {[60, 70, 85, 100].map((preset) => (
                <TouchableOpacity
                  key={`all-${preset}`}
                  style={styles.presetChip}
                  onPress={() => handleApplyPresetAllExams(preset)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.presetChipText}>Hepsi {preset}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.presetsLabel, { marginTop: 10 }]}>SADECE FİNALLERİ AYARLA</Text>
            <View style={styles.presetsRow}>
              {[50, 65, 80, 100].map((preset) => (
                <TouchableOpacity
                  key={`final-${preset}`}
                  style={[styles.presetChip, styles.presetChipOutline]}
                  onPress={() => handleApplyPresetFinalsOnly(preset)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.presetChipOutlineText}>Final {preset}</Text>
                </TouchableOpacity>
              ))}
            </View>
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
              const sim = simulatedScores[item.courseCode] || { midterm: '', finalExam: '', isBut: false };
              const mStr = sim.midterm;
              const fStr = sim.finalExam;
              const isBut = sim.isBut;

              const hasM = mStr.trim() !== '';
              const hasF = fStr.trim() !== '';

              let calcAvg: number | null = null;
              if (hasM && hasF) {
                const m = parseFloat(mStr);
                const f = parseFloat(fStr);
                if (!isNaN(m) && !isNaN(f)) {
                  calcAvg = m * 0.4 + f * 0.6;
                }
              } else if (hasF && !hasM) {
                const f = parseFloat(fStr);
                if (!isNaN(f)) {
                  calcAvg = f;
                }
              }

              const letterInfo = calcAvg !== null ? getLetterAndCoeff(calcAvg) : null;
              const badgeBg = letterInfo ? getBadgeColor(letterInfo.letter) : colors.textMuted;

              // Pass threshold based on Midterm:
              // Final must be >= 50 and avg >= 50
              const mNum = hasM ? parseFloat(mStr) : null;
              const req50 = mNum !== null && !isNaN(mNum) ? Math.max(50, Math.ceil((50 - mNum * 0.4) / 0.6)) : 50;
              const reqCC = mNum !== null && !isNaN(mNum) ? Math.max(50, Math.ceil((70 - mNum * 0.4) / 0.6)) : 70;

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
                    {/* Midterm Input */}
                    <View style={styles.scoreCol}>
                      <Text style={styles.scoreLabel}>VİZE (%40)</Text>
                      <TextInput
                        style={styles.scoreInput}
                        placeholder={item.midterm !== null && item.midterm !== undefined ? String(item.midterm) : 'Not'}
                        placeholderTextColor={colors.textMuted}
                        keyboardType="numeric"
                        value={mStr}
                        onChangeText={(txt) => handleSetMidterm(item.courseCode, txt)}
                      />
                    </View>

                    {/* Final / Büt Input */}
                    <View style={styles.scoreCol}>
                      <Text style={styles.scoreLabel}>{isBut ? 'BÜT (%60)' : 'FİNAL (%60)'}</Text>
                      <TextInput
                        style={styles.scoreInput}
                        placeholder={item.finalExam !== null && item.finalExam !== undefined ? String(item.finalExam) : 'Not'}
                        placeholderTextColor={colors.textMuted}
                        keyboardType="numeric"
                        value={fStr}
                        onChangeText={(txt) => handleSetFinal(item.courseCode, txt)}
                      />
                    </View>

                    {/* Average Output */}
                    <View style={styles.scoreCol}>
                      <Text style={styles.scoreLabel}>ORTALAMA</Text>
                      <Text style={[styles.scoreVal, { color: calcAvg !== null ? colors.primary : colors.textMuted }]}>
                        {calcAvg !== null ? calcAvg.toFixed(1) : '-'}
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
                      {[50, 70, 85, 100].map((quick) => (
                        <TouchableOpacity
                          key={quick}
                          style={styles.quickChip}
                          onPress={() => handleSetFinal(item.courseCode, String(quick))}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.quickChipText}>{quick}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Warning and Guidance Hints */}
                  {hasF && parseFloat(fStr) < 50 ? (
                    <View style={styles.warningBox}>
                      <Text style={styles.warningText}>
                        ⚠️ Final notu 50'nin altında. Üniversite barajı gereği en az 50 almalısınız.
                      </Text>
                    </View>
                  ) : hasM && !hasF ? (
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
    presetsContainer: {
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    presetsLabel: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.textMuted,
      letterSpacing: 0.8,
      marginBottom: 8,
    },
    presetsRow: {
      flexDirection: 'row',
      gap: 8,
    },
    presetChip: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: colors.primarySubtle,
      borderWidth: 1,
      borderColor: colors.primary,
      alignItems: 'center',
    },
    presetChipText: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: '700',
    },
    presetChipOutline: {
      backgroundColor: colors.cardAlt,
      borderColor: colors.cardBorder,
    },
    presetChipOutlineText: {
      color: colors.text,
      fontSize: 11,
      fontWeight: '600',
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
      marginBottom: 4,
    },
    scoreVal: {
      fontSize: 15,
      fontWeight: '800',
    },
    scoreInput: {
      height: 34,
      minWidth: 58,
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
