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

export interface EvalComponent {
  id: string;
  name: string;
  weight: number; // percentage (e.g. 40 for 40%)
  score: string; // string for input (e.g. '75')
  isFinal?: boolean;
}

export interface CourseSimState {
  selectedLetter: string | null; // e.g. 'BA' or null
  isBut: boolean;
  isExpanded: boolean;
  components: EvalComponent[];
}

const LETTER_SPECS: { letter: string; coeff: number; minScore: number }[] = [
  { letter: 'AA', coeff: 4.0, minScore: 90 },
  { letter: 'BA', coeff: 3.5, minScore: 85 },
  { letter: 'BB', coeff: 3.0, minScore: 80 },
  { letter: 'CB', coeff: 2.5, minScore: 75 },
  { letter: 'CC', coeff: 2.0, minScore: 70 },
  { letter: 'DC', coeff: 1.5, minScore: 60 },
  { letter: 'DD', coeff: 1.0, minScore: 50 },
  { letter: 'FD', coeff: 0.5, minScore: 40 },
  { letter: 'FF', coeff: 0.0, minScore: 0 },
];

export const AgnoSimulatorScreen: React.FC<AgnoSimulatorScreenProps> = ({ onClose }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => getSimulatorStyles(colors), [colors]);

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Simulation state per course code
  const [simState, setSimState] = useState<Record<string, CourseSimState>>({});

  useEffect(() => {
    const initData = async () => {
      try {
        const [cachedProfile, cachedTerms] = await Promise.all([
          AuthStorage.getCachedProfile(),
          AuthStorage.getCachedTerms(),
        ]);

        if (cachedProfile) setProfile(cachedProfile);

        let activeGrades: GradeEntry[] = [];
        const activeTerm = cachedTerms?.find((t) => t.isActive) || cachedTerms?.[0];
        if (activeTerm) {
          const cached = await AuthStorage.getCachedGrades(activeTerm.termId);
          if (cached && cached.length > 0) activeGrades = cached;
        }

        obsClient.getProfile().then((p) => {
          if (p) setProfile(p);
        }).catch(() => {});

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

        // Fallback: Populate enrolled courses from active timetable
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

          const initial: Record<string, CourseSimState> = {};
          activeGrades.forEach((g) => {
            const mVal = g.midterm !== null && g.midterm !== undefined ? String(g.midterm) : '';
            const fVal = g.finalExam !== null && g.finalExam !== undefined ? String(g.finalExam) : '';

            initial[g.courseCode] = {
              selectedLetter: g.letterGrade || null,
              isBut: false,
              isExpanded: false,
              components: [
                { id: 'vize', name: 'Vize', weight: 40, score: mVal },
                { id: 'final', name: 'Final', weight: 60, score: fVal, isFinal: true },
              ],
            };
          });
          setSimState(initial);
        }
      } catch (err: any) {
        console.warn('AgnoSimulatorScreen load error:', err.message);
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, []);

  // Helper: Convert score (0-100) to Letter and Coefficient
  const scoreToLetter = (score: number) => {
    for (const spec of LETTER_SPECS) {
      if (score >= spec.minScore) {
        return spec;
      }
    }
    return LETTER_SPECS[LETTER_SPECS.length - 1];
  };

  const letterToCoeff = (letter: string) => {
    const found = LETTER_SPECS.find((s) => s.letter === letter);
    return found ? found.coeff : 0;
  };

  const getBadgeColor = (letter?: string | null) => {
    if (!letter) return colors.textMuted;
    if (['AA', 'BA', 'BB', 'CB', 'CC'].includes(letter)) return colors.success;
    if (['DC', 'DD'].includes(letter)) return colors.warning;
    return colors.danger;
  };

  // Calculate detailed average from components
  const calculateCourseDetail = (sim: CourseSimState) => {
    let totalWeight = 0;
    let weightedSum = 0;
    let filledCount = 0;
    let finalScore: number | null = null;

    sim.components.forEach((c) => {
      const s = parseFloat(c.score.trim());
      if (!isNaN(s) && c.weight > 0) {
        weightedSum += s * (c.weight / 100);
        totalWeight += c.weight;
        filledCount++;
      }
      if (c.isFinal && !isNaN(s)) {
        finalScore = s;
      }
    });

    if (filledCount === 0 || totalWeight === 0) {
      return { avg: null, letter: null, finalScore, totalWeight };
    }

    // Normalized average if totalWeight != 100
    const normalizedAvg = (weightedSum / totalWeight) * 100;
    const letterInfo = scoreToLetter(normalizedAvg);
    return {
      avg: normalizedAvg,
      letter: letterInfo.letter,
      finalScore,
      totalWeight,
    };
  };

  // Get current effective letter for a course
  const getCourseEffectiveLetter = (code: string): string | null => {
    const sim = simState[code];
    if (!sim) return null;

    // Check if detailed scores exist
    const detail = calculateCourseDetail(sim);
    if (detail.letter !== null) {
      return detail.letter;
    }

    // Otherwise use direct letter chip selection
    return sim.selectedLetter;
  };

  // Handlers
  const handleSelectLetter = (courseCode: string, letter: string) => {
    setSimState((prev) => {
      const cur = prev[courseCode];
      if (!cur) return prev;
      // Toggle if already selected
      const nextLetter = cur.selectedLetter === letter ? null : letter;
      return {
        ...prev,
        [courseCode]: {
          ...cur,
          selectedLetter: nextLetter,
        },
      };
    });
  };

  const handleToggleExpand = (courseCode: string) => {
    setSimState((prev) => {
      const cur = prev[courseCode];
      if (!cur) return prev;
      return {
        ...prev,
        [courseCode]: {
          ...cur,
          isExpanded: !cur.isExpanded,
        },
      };
    });
  };

  const handleToggleBut = (courseCode: string) => {
    setSimState((prev) => {
      const cur = prev[courseCode];
      if (!cur) return prev;
      const nextBut = !cur.isBut;
      const updatedComponents = cur.components.map((c) =>
        c.isFinal ? { ...c, name: nextBut ? 'Büt' : 'Final' } : c
      );
      return {
        ...prev,
        [courseCode]: {
          ...cur,
          isBut: nextBut,
          components: updatedComponents,
        },
      };
    });
  };

  const handleUpdateComponentScore = (courseCode: string, compId: string, score: string) => {
    setSimState((prev) => {
      const cur = prev[courseCode];
      if (!cur) return prev;
      const comps = cur.components.map((c) => (c.id === compId ? { ...c, score } : c));
      return {
        ...prev,
        [courseCode]: {
          ...cur,
          components: comps,
        },
      };
    });
  };

  const handleUpdateComponentWeight = (courseCode: string, compId: string, weightStr: string) => {
    const weight = parseFloat(weightStr) || 0;
    setSimState((prev) => {
      const cur = prev[courseCode];
      if (!cur) return prev;
      const comps = cur.components.map((c) => (c.id === compId ? { ...c, weight } : c));
      return {
        ...prev,
        [courseCode]: {
          ...cur,
          components: comps,
        },
      };
    });
  };

  // Apply weight template
  const handleApplyWeightTemplate = (courseCode: string, template: '40/60' | '30/70' | '30/20/50' | '100proje') => {
    setSimState((prev) => {
      const cur = prev[courseCode];
      if (!cur) return prev;

      let newComps: EvalComponent[] = [];
      const curFinalScore = cur.components.find((c) => c.isFinal)?.score || '';
      const curVizeScore = cur.components.find((c) => c.id === 'vize')?.score || '';

      if (template === '40/60') {
        newComps = [
          { id: 'vize', name: 'Vize', weight: 40, score: curVizeScore },
          { id: 'final', name: cur.isBut ? 'Büt' : 'Final', weight: 60, score: curFinalScore, isFinal: true },
        ];
      } else if (template === '30/70') {
        newComps = [
          { id: 'vize', name: 'Vize', weight: 30, score: curVizeScore },
          { id: 'final', name: cur.isBut ? 'Büt' : 'Final', weight: 70, score: curFinalScore, isFinal: true },
        ];
      } else if (template === '30/20/50') {
        newComps = [
          { id: 'vize', name: 'Vize', weight: 30, score: curVizeScore },
          { id: 'proje', name: 'Proje', weight: 20, score: '' },
          { id: 'final', name: cur.isBut ? 'Büt' : 'Final', weight: 50, score: curFinalScore, isFinal: true },
        ];
      } else if (template === '100proje') {
        newComps = [
          { id: 'proje', name: 'Proje / Tez', weight: 100, score: curFinalScore || curVizeScore, isFinal: true },
        ];
      }

      return {
        ...prev,
        [courseCode]: {
          ...cur,
          components: newComps,
        },
      };
    });
  };

  const handleAddComponent = (courseCode: string) => {
    setSimState((prev) => {
      const cur = prev[courseCode];
      if (!cur) return prev;
      const newId = `custom_${Date.now()}`;
      const newComp: EvalComponent = {
        id: newId,
        name: `Ödev/Quiz`,
        weight: 10,
        score: '',
      };
      return {
        ...prev,
        [courseCode]: {
          ...cur,
          components: [...cur.components, newComp],
        },
      };
    });
  };

  const handleRemoveComponent = (courseCode: string, compId: string) => {
    setSimState((prev) => {
      const cur = prev[courseCode];
      if (!cur) return prev;
      return {
        ...prev,
        [courseCode]: {
          ...cur,
          components: cur.components.filter((c) => c.id !== compId),
        },
      };
    });
  };

  // Global Presets: Apply letter to all courses
  const handleApplyPresetAllLetters = (letter: string) => {
    setSimState((prev) => {
      const next = { ...prev };
      grades.forEach((g) => {
        const cur = next[g.courseCode];
        if (cur) {
          next[g.courseCode] = {
            ...cur,
            selectedLetter: letter,
            components: cur.components.map((c) => ({ ...c, score: '' })), // clear component inputs
          };
        }
      });
      return next;
    });
  };

  // Global Presets: Apply raw score to all components
  const handleApplyPresetAllScores = (score: number) => {
    setSimState((prev) => {
      const next = { ...prev };
      grades.forEach((g) => {
        const cur = next[g.courseCode];
        if (cur) {
          next[g.courseCode] = {
            ...cur,
            selectedLetter: null,
            components: cur.components.map((c) => ({ ...c, score: String(score) })),
          };
        }
      });
      return next;
    });
  };

  const handleReset = () => {
    const reset: Record<string, CourseSimState> = {};
    grades.forEach((g) => {
      reset[g.courseCode] = {
        selectedLetter: g.letterGrade || null,
        isBut: false,
        isExpanded: false,
        components: [
          { id: 'vize', name: 'Vize', weight: 40, score: g.midterm ? String(g.midterm) : '' },
          { id: 'final', name: 'Final', weight: 60, score: g.finalExam ? String(g.finalExam) : '', isFinal: true },
        ],
      };
    });
    setSimState(reset);
  };

  // Cumulative AGNO Calculations
  let termAktsTotal = 0;
  let termWeightedPoints = 0;

  grades.forEach((item) => {
    const akts = item.akts > 0 ? item.akts : item.credits > 0 ? item.credits : 5;
    const letter = getCourseEffectiveLetter(item.courseCode);

    if (letter) {
      const coeff = letterToCoeff(letter);
      termWeightedPoints += coeff * akts;
      termAktsTotal += akts;
    }
  });

  const hasSimulatedEntries = termAktsTotal > 0;
  const simulatedAno = hasSimulatedEntries ? termWeightedPoints / termAktsTotal : 0;

  const currentCgpa = typeof profile?.gpa === 'number' && !isNaN(profile.gpa) ? profile.gpa : 0;
  const estimatedPastAkts = 60; // 2 completed semesters baseline (~30 AKTS/semester)
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
          {/* Cumulative Projected CGPA Hero Card */}
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
                    'Harf seçerek veya not girerek simüle edin'
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

          {/* Quick Presets Box */}
          <View style={styles.presetsContainer}>
            <Text style={styles.presetsLabel}>TÜM DERSLERİ HIZLI AYARLA</Text>
            <View style={styles.presetsRow}>
              {['AA', 'BA', 'BB', 'CB', 'CC'].map((presetLetter) => (
                <TouchableOpacity
                  key={`preset-letter-${presetLetter}`}
                  style={styles.presetChip}
                  onPress={() => handleApplyPresetAllLetters(presetLetter)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.presetChipText}>{presetLetter}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.presetsRow, { marginTop: 8 }]}>
              {[100, 85, 75, 65].map((presetScore) => (
                <TouchableOpacity
                  key={`preset-score-${presetScore}`}
                  style={[styles.presetChip, styles.presetChipOutline]}
                  onPress={() => handleApplyPresetAllScores(presetScore)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.presetChipOutlineText}>Puan {presetScore}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Course Simulation List */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Dersler & Hedef Harfler</Text>
            <Text style={styles.courseCountText}>{grades.length} Ders</Text>
          </View>

          {grades.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Simüle edilecek aktif ders bulunamadı.</Text>
            </View>
          ) : (
            grades.map((item, idx) => {
              const sim = simState[item.courseCode] || {
                selectedLetter: null,
                isBut: false,
                isExpanded: false,
                components: [],
              };

              const detail = calculateCourseDetail(sim);
              const effectiveLetter = detail.letter || sim.selectedLetter;
              const badgeBg = getBadgeColor(effectiveLetter);
              const isDetailedActive = detail.avg !== null;

              return (
                <View key={`${item.courseCode}-${idx}`} style={styles.courseCard}>
                  {/* Course Header */}
                  <View style={styles.courseHeader}>
                    <View style={styles.courseTitles}>
                      <Text style={styles.courseName}>{item.courseName}</Text>
                      <Text style={styles.courseCode}>
                        {item.courseCode} • {item.akts} AKTS
                      </Text>
                    </View>
                    {effectiveLetter ? (
                      <View style={[styles.letterBadge, { backgroundColor: badgeBg }]}>
                        <Text style={styles.letterText}>{effectiveLetter}</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Primary View: Quick Letter Selector Chips */}
                  <View style={styles.letterChipsRow}>
                    {LETTER_SPECS.map((spec) => {
                      const isSelected = effectiveLetter === spec.letter;
                      return (
                        <TouchableOpacity
                          key={spec.letter}
                          style={[
                            styles.letterChip,
                            isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                          ]}
                          onPress={() => handleSelectLetter(item.courseCode, spec.letter)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.letterChipText,
                              isSelected && { color: '#ffffff', fontWeight: '900' },
                            ]}
                          >
                            {spec.letter}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Detailed Breakdown Toggle */}
                  <TouchableOpacity
                    style={styles.expandToggleRow}
                    onPress={() => handleToggleExpand(item.courseCode)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.expandToggleText}>
                      {sim.isExpanded
                        ? '▲ Sınav & Proje Ağırlıklarını Gizle'
                        : isDetailedActive
                        ? `▼ Ağırlıklı Ortalama: ${detail.avg?.toFixed(1)} (${detail.totalWeight}% Ağırlık) ⚙️`
                        : '⚙️ Sınav, Proje & Ağırlık Dağılımı Detayı ▼'}
                    </Text>
                  </TouchableOpacity>

                  {/* Expandable Section: Customizable Components & Templates */}
                  {sim.isExpanded && (
                    <View style={styles.expandedSection}>
                      {/* Weight Templates */}
                      <Text style={styles.subSectionTitle}>AĞIRLIK ŞABLONU SEÇ</Text>
                      <View style={styles.templateRow}>
                        <TouchableOpacity
                          style={styles.templateBtn}
                          onPress={() => handleApplyWeightTemplate(item.courseCode, '40/60')}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.templateBtnText}>40 / 60</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.templateBtn}
                          onPress={() => handleApplyWeightTemplate(item.courseCode, '30/70')}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.templateBtnText}>30 / 70</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.templateBtn}
                          onPress={() => handleApplyWeightTemplate(item.courseCode, '30/20/50')}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.templateBtnText}>30/20/50 (Proje)</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.templateBtn}
                          onPress={() => handleApplyWeightTemplate(item.courseCode, '100proje')}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.templateBtnText}>%100 Proje</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Component Rows */}
                      <View style={styles.compList}>
                        <View style={styles.compHeaderRow}>
                          <Text style={[styles.compHeaderLabel, { flex: 2 }]}>Bileşen Adı</Text>
                          <Text style={[styles.compHeaderLabel, { flex: 1.2, textAlign: 'center' }]}>Ağırlık %</Text>
                          <Text style={[styles.compHeaderLabel, { flex: 1.5, textAlign: 'center' }]}>Not (0-100)</Text>
                          <View style={{ width: 28 }} />
                        </View>

                        {sim.components.map((comp) => (
                          <View key={comp.id} style={styles.compRow}>
                            <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center' }}>
                              <Text style={styles.compNameText} numberOfLines={1}>
                                {comp.name}
                              </Text>
                              {comp.isFinal && (
                                <TouchableOpacity
                                  style={styles.inlineButToggle}
                                  onPress={() => handleToggleBut(item.courseCode)}
                                  activeOpacity={0.7}
                                >
                                  <Text style={styles.inlineButToggleText}>{sim.isBut ? '🔁 Büt' : '📝 Fin'}</Text>
                                </TouchableOpacity>
                              )}
                            </View>

                            <TextInput
                              style={[styles.compInput, { flex: 1.2, marginHorizontal: 4 }]}
                              keyboardType="numeric"
                              value={String(comp.weight)}
                              onChangeText={(txt) => handleUpdateComponentWeight(item.courseCode, comp.id, txt)}
                            />

                            <TextInput
                              style={[styles.compInput, { flex: 1.5 }]}
                              placeholder="Not"
                              placeholderTextColor={colors.textMuted}
                              keyboardType="numeric"
                              value={comp.score}
                              onChangeText={(txt) => handleUpdateComponentScore(item.courseCode, comp.id, txt)}
                            />

                            {!comp.isFinal && comp.id !== 'vize' ? (
                              <TouchableOpacity
                                style={styles.removeCompBtn}
                                onPress={() => handleRemoveComponent(item.courseCode, comp.id)}
                              >
                                <Text style={styles.removeCompBtnText}>✕</Text>
                              </TouchableOpacity>
                            ) : (
                              <View style={{ width: 28 }} />
                            )}
                          </View>
                        ))}
                      </View>

                      {/* Add Component Button */}
                      <TouchableOpacity
                        style={styles.addCompBtn}
                        onPress={() => handleAddComponent(item.courseCode)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.addCompBtnText}>+ Ödev / Quiz / Lab Ekle</Text>
                      </TouchableOpacity>

                      {/* Weight Warning if != 100 */}
                      {detail.totalWeight > 0 && detail.totalWeight !== 100 && (
                        <Text style={styles.weightWarningText}>
                          ℹ️ Toplam ağırlık %{detail.totalWeight} (100'e normalize edildi)
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Warning if Final is entered and < 50 */}
                  {detail.finalScore !== null && detail.finalScore < 50 ? (
                    <View style={styles.warningBox}>
                      <Text style={styles.warningText}>
                        ⚠️ Final/Büt notu 50'nin altında. Üniversite barajı gereği en az 50 almalısınız.
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
      paddingBottom: 36,
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
      gap: 6,
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
      fontSize: 12,
      fontWeight: '800',
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
    letterChipsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 4,
    },
    letterChip: {
      flex: 1,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: colors.cardAlt,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    letterChipText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    expandToggleRow: {
      alignItems: 'center',
      paddingVertical: 4,
    },
    expandToggleText: {
      fontSize: 11,
      color: colors.primary,
      fontWeight: '700',
    },
    expandedSection: {
      backgroundColor: colors.cardAlt,
      borderRadius: 14,
      padding: 12,
      gap: 10,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    subSectionTitle: {
      fontSize: 9,
      fontWeight: '800',
      color: colors.textMuted,
      letterSpacing: 0.5,
    },
    templateRow: {
      flexDirection: 'row',
      gap: 6,
    },
    templateBtn: {
      flex: 1,
      paddingVertical: 5,
      borderRadius: 8,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: 'center',
    },
    templateBtnText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    compList: {
      gap: 6,
    },
    compHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 2,
    },
    compHeaderLabel: {
      fontSize: 9,
      fontWeight: '800',
      color: colors.textMuted,
      letterSpacing: 0.5,
    },
    compRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    compNameText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
      flex: 1,
    },
    inlineButToggle: {
      backgroundColor: colors.card,
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      marginRight: 4,
    },
    inlineButToggleText: {
      fontSize: 9,
      fontWeight: '700',
      color: colors.primary,
    },
    compInput: {
      height: 32,
      textAlign: 'center',
      backgroundColor: colors.card,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primary,
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
      paddingVertical: 2,
      paddingHorizontal: 4,
    },
    removeCompBtn: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    removeCompBtnText: {
      color: colors.danger,
      fontSize: 14,
      fontWeight: '800',
    },
    addCompBtn: {
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderStyle: 'dashed',
      alignItems: 'center',
    },
    addCompBtnText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
    },
    weightWarningText: {
      fontSize: 10,
      color: colors.warning,
      fontStyle: 'italic',
      textAlign: 'center',
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
  });
