import React, { useEffect, useState, useMemo } from 'react';
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
import { AuthStorage } from '../storage/authStorage';
import { GradeEntry, SemesterTerm } from '../types/models';
import { useTheme, ThemeColors } from '../theme/ThemeContext';

export const GradesScreen: React.FC = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => getGradesStyles(colors), [colors]);

  const [terms, setTerms] = useState<SemesterTerm[]>([]);
  const [selectedTermId, setSelectedTermId] = useState<number | undefined>();
  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTermsAndGrades = async (isPullToRefresh = false) => {
    if (!isPullToRefresh) {
      const cachedTerms = await AuthStorage.getCachedTerms();
      if (cachedTerms && cachedTerms.length > 0) {
        setTerms(cachedTerms);
        const active = cachedTerms.find((t) => t.isActive) || cachedTerms[0];
        if (active) {
          setSelectedTermId(active.termId);
          const cachedGrades = await AuthStorage.getCachedGrades(active.termId);
          if (cachedGrades && cachedGrades.length > 0) {
            setGrades(cachedGrades);
            setLoading(false);
          }
        }
      }
    }

    try {
      if (isPullToRefresh) setRefreshing(true);
      const fetchedTerms = await obsClient.getTerms();
      if (fetchedTerms && fetchedTerms.length > 0) {
        setTerms(fetchedTerms);
        await AuthStorage.saveCachedTerms(fetchedTerms);

        const targetTerm = selectedTermId !== undefined
          ? fetchedTerms.find((t) => t.termId === selectedTermId) || fetchedTerms[0]
          : fetchedTerms.find((t) => t.isActive) || fetchedTerms[0];

        setSelectedTermId(targetTerm.termId);

        const list = await obsClient.getGrades(targetTerm.termId);
        setGrades(list);
        await AuthStorage.saveCachedGrades(targetTerm.termId, list);
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
    if (!letter) return colors.textMuted;
    if (['AA', 'BA', 'BB', 'CB', 'CC'].includes(letter)) return colors.success;
    if (['DC', 'DD'].includes(letter)) return colors.warning;
    return colors.danger;
  };

  return (
    <View style={styles.container}>
      {/* Term Selector Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.termScroll}
        contentContainerStyle={styles.termScrollContent}
      >
        {terms.map((t) => {
          const isSelected = t.termId === selectedTermId;
          return (
            <TouchableOpacity
              key={t.termId}
              style={[styles.termPill, isSelected && styles.activeTermPill]}
              onPress={() => handleTermChange(t.termId)}
              activeOpacity={0.7}
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
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadTermsAndGrades(true);
              }}
              tintColor={colors.primary}
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
              const midtermNum = typeof item.midterm === 'number' ? item.midterm : parseFloat(item.midterm || '0');
              const finalNum = typeof item.finalExam === 'number' ? item.finalExam : parseFloat(item.finalExam || '0');
              const calcAvg = midtermNum > 0 && finalNum > 0 ? (midtermNum * 0.4 + finalNum * 0.6).toFixed(1) : null;

              const req50 = midtermNum > 0 ? Math.max(0, Math.ceil((50 - midtermNum * 0.4) / 0.6)) : 50;
              const reqCC = midtermNum > 0 ? Math.max(0, Math.ceil((70 - midtermNum * 0.4) / 0.6)) : 70;
              const hasFinal = item.finalExam !== null && item.finalExam !== undefined && item.finalExam !== '' && item.finalExam !== '--';

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
                        <Text style={styles.letterText}>
                          {item.letterGrade || '--'}
                        </Text>
                      </View>
                      {item.passed !== undefined ? (
                        <Text
                          style={[
                            styles.passText,
                            item.passed ? styles.passSuccess : styles.passFail,
                          ]}
                        >
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
                      <Text style={[styles.scoreVal, { color: colors.primary }]}>
                        {calcAvg || item.gradeAverage || '-'}
                      </Text>
                    </View>
                  </View>

                  {/* Clean passing requirement badge if final exam is pending */}
                  {!hasFinal && midtermNum > 0 ? (
                    <View style={styles.passReqBadge}>
                      <Text style={styles.passReqText}>
                        🎯 Hedef: Geçmek için min <Text style={styles.passReqBold}>{req50}</Text> • CC için min <Text style={styles.passReqBold}>{reqCC}</Text>
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

const getGradesStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    termScroll: {
      maxHeight: 56,
      backgroundColor: colors.headerBg,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    termScrollContent: {
      paddingHorizontal: 14,
      alignItems: 'center',
      gap: 8,
    },
    termPill: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 9999,
      backgroundColor: colors.cardAlt,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    activeTermPill: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    termText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    activeTermText: {
      color: '#ffffff',
      fontWeight: '700',
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    list: {
      flex: 1,
    },
    listContent: {
      padding: 16,
      gap: 12,
    },
    emptyContainer: {
      padding: 40,
      alignItems: 'center',
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 14,
    },
    gradeCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: colors.isDark ? 0.15 : 0.04,
      shadowRadius: 6,
      elevation: 2,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    headerTitles: {
      flex: 1,
      marginRight: 10,
    },
    courseName: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
      marginBottom: 3,
    },
    courseCode: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '500',
    },
    badgeCol: {
      alignItems: 'center',
      gap: 4,
    },
    letterBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
      minWidth: 42,
      alignItems: 'center',
    },
    letterText: {
      color: '#ffffff',
      fontWeight: '800',
      fontSize: 13,
    },
    passText: {
      fontSize: 11,
      fontWeight: '700',
    },
    passSuccess: {
      color: colors.success,
    },
    passFail: {
      color: colors.danger,
    },
    scoresRow: {
      flexDirection: 'row',
      backgroundColor: colors.cardAlt,
      borderRadius: 14,
      padding: 10,
      justifyContent: 'space-between',
    },
    scoreBox: {
      alignItems: 'center',
      flex: 1,
    },
    scoreLabel: {
      color: colors.textMuted,
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    scoreVal: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '800',
    },
    passReqBadge: {
      marginTop: 10,
      backgroundColor: colors.primarySubtle,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 6,
      alignItems: 'center',
    },
    passReqText: {
      fontSize: 11,
      color: colors.primary,
      fontWeight: '500',
    },
    passReqBold: {
      fontWeight: '800',
    },
  });
