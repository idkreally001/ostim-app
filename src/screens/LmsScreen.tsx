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
  Modal,
  Linking,
  Alert,
} from 'react-native';
import { lmsClient } from '../api/lmsClient';
import { AuthStorage } from '../storage/authStorage';
import { LmsCourseItem, LmsCalendarEvent, LmsSessionData } from '../types/models';
import { logService } from '../services/logService';

interface LmsScreenProps {
  onSessionChange?: (connected: boolean) => void;
}

export const LmsScreen: React.FC<LmsScreenProps> = ({ onSessionChange }) => {
  const [isConnected, setIsConnected] = useState(false);

  const updateConnectedState = (connected: boolean) => {
    setIsConnected(connected);
    onSessionChange?.(connected);
  };

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'deadlines' | 'courses'>('deadlines');
  const [deadlineFilter, setDeadlineFilter] = useState<'all' | 'urgent' | 'overdue'>('all');

  const [courses, setCourses] = useState<LmsCourseItem[]>([]);
  const [events, setEvents] = useState<LmsCalendarEvent[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Connect modal state
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [inputSesskey, setInputSesskey] = useState('');
  const [inputCookie, setInputCookie] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);

const INITIAL_COURSES: LmsCourseItem[] = [
  {
    id: 1211,
    fullname: 'CENG 416 (1) [401779] Computer and Network Security (Dr. Muhammed Akif Ağca)',
    shortname: 'CENG 416 (1) [401779]',
    code: 'CENG 416',
    instructor: 'Dr. Muhammed Akif Ağca',
    viewurl: 'https://lmsclus.ostimteknik.edu.tr/course/view.php?id=1211',
  },
  {
    id: 1213,
    fullname: 'CENG 427 (1) [402150] Distributed Systems (Prof. Dr. Ali Sebetci)',
    shortname: 'CENG 427 (1) [402150]',
    code: 'CENG 427',
    instructor: 'Prof. Dr. Ali Sebetci',
    viewurl: 'https://lmsclus.ostimteknik.edu.tr/course/view.php?id=1213',
  },
  {
    id: 1215,
    fullname: 'CENG 432 (1) [402374] Intro to Artificial Neural Networks (Dr. Rayan Abri)',
    shortname: 'CENG 432 (1) [402374]',
    code: 'CENG 432',
    instructor: 'Dr. Rayan Abri',
    viewurl: 'https://lmsclus.ostimteknik.edu.tr/course/view.php?id=1215',
  },
  {
    id: 1216,
    fullname: 'CENG 434 (1) [401780] Golang Programming (Dr. Burak Gülbay)',
    shortname: 'CENG 434 (1) [401780]',
    code: 'CENG 434',
    instructor: 'Dr. Burak Gülbay',
    viewurl: 'https://lmsclus.ostimteknik.edu.tr/course/view.php?id=1216',
  },
  {
    id: 1217,
    fullname: 'CENG 452 (1) [401536] Cellular Communication (4G/5G/6G) (Dr. Metin Balcı)',
    shortname: 'CENG 452 (1) [401536]',
    code: 'CENG 452',
    instructor: 'Dr. Metin Balcı',
    viewurl: 'https://lmsclus.ostimteknik.edu.tr/course/view.php?id=1217',
  },
  {
    id: 1219,
    fullname: 'CENG_459 (1) [401541] Cloud Technologies Fundamentals (Dr. Metin Balcı)',
    shortname: 'CENG_459 (1) [401541]',
    code: 'CENG 459',
    instructor: 'Dr. Metin Balcı',
    viewurl: 'https://lmsclus.ostimteknik.edu.tr/course/view.php?id=1219',
  },
  {
    id: 1222,
    fullname: 'EEE 309 (1) [401510] Signals and Systems (Prof. Dr. İsmail Avcıbaş)',
    shortname: 'EEE 309 (1) [401510]',
    code: 'EEE 309',
    instructor: 'Prof. Dr. İsmail Avcıbaş',
    viewurl: 'https://lmsclus.ostimteknik.edu.tr/course/view.php?id=1222',
  },
];

const INITIAL_EVENTS: LmsCalendarEvent[] = [
  {
    id: 9901,
    name: 'Wireshark Assignment',
    courseId: 1219,
    courseName: 'CENG_459 (1) [401541] Cloud Technologies Fundamentals (Dr. Metin Balcı)',
    courseCode: 'CENG 459',
    timesort: Math.floor(Date.now() / 1000) + 7200,
    formattedDate: 'Bugün',
    formattedTime: '23:59',
    daysRemaining: 0,
    isOverdue: false,
    actionUrl: 'https://lmsclus.ostimteknik.edu.tr/course/view.php?id=1219',
    actionName: 'Teslim Et',
  },
  {
    id: 9902,
    name: 'Assignment 0b: Lab 0 – Working Files (ZIP)',
    courseId: 1213,
    courseName: 'CENG 427 (1) [402150] Distributed Systems (Prof. Dr. Ali Sebetci)',
    courseCode: 'CENG 427',
    timesort: Math.floor(Date.now() / 1000) - 86400 * 4,
    formattedDate: '15 Eki',
    formattedTime: '23:59',
    daysRemaining: -4,
    isOverdue: true,
    actionUrl: 'https://lmsclus.ostimteknik.edu.tr/course/view.php?id=1213',
    actionName: 'Görüntüle',
  },
];

  useEffect(() => {
    bootstrapLms();
  }, []);

  const bootstrapLms = async () => {
    setLoading(true);
    try {
      // 1. Load cached data for instant offline presentation
      const cached = await AuthStorage.getCachedLmsData();
      if (cached && cached.courses?.length > 0) {
        setCourses(cached.courses || []);
        setEvents(cached.events || []);
        setLastUpdated(cached.lastUpdated || null);
      } else {
        // Fallback to verified enrolled courses & assignments
        setCourses(INITIAL_COURSES);
        setEvents(INITIAL_EVENTS);
        setLastUpdated('Çevrimdışı Önizleme');
      }

      // 2. Check for saved LMS session
      const savedSession = await AuthStorage.getLmsSession();
      if (savedSession?.sesskey && savedSession?.moodleSession) {
        lmsClient.setSession(savedSession);
        updateConnectedState(true);
        // Sync fresh data in background
        syncData(savedSession);
      } else {
        updateConnectedState(false);
      }
    } catch (err: any) {
      logService.error('LmsScreen', 'Bootstrap failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = () => {
    setInputSesskey('PCMcci68p5');
  };


  const syncData = async (sessionOverride?: LmsSessionData) => {
    try {
      setRefreshing(true);
      const [fetchedCourses, fetchedEvents] = await Promise.all([
        lmsClient.getCourses(),
        lmsClient.getUpcomingDeadlines(),
      ]);

      const nowStr = new Date().toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
      });

      setCourses(fetchedCourses);
      setEvents(fetchedEvents);
      setLastUpdated(nowStr);

      await AuthStorage.saveCachedLmsData({
        courses: fetchedCourses,
        events: fetchedEvents,
        lastUpdated: nowStr,
      });

      logService.info('LmsScreen', 'Sync successful', {
        courseCount: fetchedCourses.length,
        eventCount: fetchedEvents.length,
      });
    } catch (err: any) {
      logService.error('LmsScreen', 'Sync error', err.message);
      // If error indicates invalid sesskey, inform user
      if (err.message?.includes('sesskey') || err.message?.includes('oturum')) {
        Alert.alert(
          'Oturum Süresi Doldu',
          'LMS oturumunuzun süresi dolmuş olabilir. Lütfen Moodle oturumunu yenileyin.'
        );
      }
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    const cleanSesskey = inputSesskey.trim();
    let cleanCookie = inputCookie.trim();

    if (!cleanSesskey) {
      setConnectError('Lütfen sesskey değerini girin.');
      return;
    }

    if (!cleanCookie) {
      setConnectError('Lütfen MoodleSession çerez değerini girin.');
      return;
    }

    // Strip prefix if user pasted "MoodleSession=..."
    if (cleanCookie.startsWith('MoodleSession=')) {
      cleanCookie = cleanCookie.replace('MoodleSession=', '').split(';')[0].trim();
    }

    setConnecting(true);
    setConnectError(null);

    try {
      const sessionData: LmsSessionData = {
        sesskey: cleanSesskey,
        moodleSession: cleanCookie,
        lastSynced: new Date().toISOString(),
      };

      lmsClient.setSession(sessionData);

      // Verify connection by attempting to fetch courses
      const testResult = await lmsClient.testConnection();
      if (!testResult.success) {
        throw new Error(testResult.message);
      }

      // Save valid session to secure storage
      await AuthStorage.saveLmsSession(sessionData);
      updateConnectedState(true);
      setShowConnectModal(false);

      // Pull fresh data
      await syncData(sessionData);

      Alert.alert('Bağlantı Başarılı', `${testResult.courseCount} ders başarıyla senkronize edildi.`);
    } catch (err: any) {
      setConnectError(err.message || 'Moodle sunucusuna bağlanılamadı.');
      lmsClient.clearSession();
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    Alert.alert(
      'LMS Bağlantısını Kes',
      'Moodle LMS oturumunuzu kapatmak istiyor musunuz? (OBS oturumunuz bundan etkilenmez)',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Bağlantıyı Kes',
          style: 'destructive',
          onPress: async () => {
            await AuthStorage.clearLmsSession();
            lmsClient.clearSession();
            updateConnectedState(false);
            setCourses([]);
            setEvents([]);
          },
        },
      ]
    );
  };

  const openUrl = (url?: string) => {
    if (!url) return;
    Linking.openURL(url).catch(() => {
      Alert.alert('Hata', 'Bağlantı açılamadı.');
    });
  };

  // Filter deadlines based on selected chip
  const filteredEvents = events.filter((e) => {
    if (deadlineFilter === 'urgent') return !e.isOverdue && e.daysRemaining <= 2;
    if (deadlineFilter === 'overdue') return e.isOverdue;
    return true;
  });

  const urgentCount = events.filter((e) => !e.isOverdue && e.daysRemaining <= 2).length;
  const overdueCount = events.filter((e) => e.isOverdue).length;

  return (
    <View style={styles.container}>
      {/* Top Banner / Session Info */}
      <View style={styles.statusBarCard}>
        <View style={styles.statusLeft}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isConnected ? '#10b981' : '#f59e0b' },
            ]}
          />
          <View>
            <Text style={styles.statusTitle}>
              {isConnected ? 'Moodle LMS Bağlı' : 'Moodle Bağlantısı Bekleniyor'}
            </Text>
            <Text style={styles.statusSubtitle}>
              {isConnected
                ? lastUpdated
                  ? `Son Güncelleme: ${lastUpdated}`
                  : 'Oturum aktif'
                : 'Office 365 ile oturum eşleştirin'}
            </Text>
          </View>
        </View>

        <View style={styles.statusRight}>
          {isConnected ? (
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                style={styles.syncBtn}
                onPress={() => syncData()}
                disabled={refreshing}
              >
                <Text style={styles.syncBtnText}>{refreshing ? '⏳' : '🔄'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.disconnectBtn} onPress={handleDisconnect}>
                <Text style={styles.disconnectBtnText}>Bağlantıyı Kes</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.connectTriggerBtn}
              onPress={() => setShowConnectModal(true)}
            >
              <Text style={styles.connectTriggerBtnText}>🔑 Bağla</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Sub Tab Navigation */}
      <View style={styles.subTabBar}>
        <TouchableOpacity
          style={[
            styles.subTabButton,
            activeSubTab === 'deadlines' && styles.activeSubTabButton,
          ]}
          onPress={() => setActiveSubTab('deadlines')}
        >
          <Text
            style={[
              styles.subTabText,
              activeSubTab === 'deadlines' && styles.activeSubTabText,
            ]}
          >
            🚨 Teslimler & Ödevler {events.length > 0 ? `(${events.length})` : ''}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.subTabButton,
            activeSubTab === 'courses' && styles.activeSubTabButton,
          ]}
          onPress={() => setActiveSubTab('courses')}
        >
          <Text
            style={[
              styles.subTabText,
              activeSubTab === 'courses' && styles.activeSubTabText,
            ]}
          >
            📚 Derslerim {courses.length > 0 ? `(${courses.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Content Area */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>LMS Verileri Yükleniyor...</Text>
        </View>
      ) : !isConnected && courses.length === 0 ? (
        <ScrollView contentContainerStyle={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🎓</Text>
          <Text style={styles.emptyTitle}>Moodle LMS Entegrasyonu</Text>
          <Text style={styles.emptyDesc}>
            OSTİM Teknik Üniversitesi Moodle LMS sistemi Microsoft Office 365 ile çalışmaktadır.
            Ödevlerinizi ve ders materyallerinizi mobil uygulamada takip etmek için oturumunuzu
            bağlayın.
          </Text>

          <TouchableOpacity
            style={styles.primaryConnectBtn}
            onPress={() => setShowConnectModal(true)}
          >
            <Text style={styles.primaryConnectBtnText}>⚡ Moodle Oturumunu Bağla</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.openWebBtn}
            onPress={() => openUrl('https://lmsclus.ostimteknik.edu.tr/auth/oidc/')}
          >
            <Text style={styles.openWebBtnText}>🌐 Tarayıcıda LMS Aç</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.contentScrollView}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => syncData()}
              tintColor="#3b82f6"
            />
          }
        >
          {activeSubTab === 'deadlines' ? (
            <View>
              {/* Filter Chips */}
              <View style={styles.filterRow}>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    deadlineFilter === 'all' && styles.activeFilterChip,
                  ]}
                  onPress={() => setDeadlineFilter('all')}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      deadlineFilter === 'all' && styles.activeFilterChipText,
                    ]}
                  >
                    Tümü ({events.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    deadlineFilter === 'urgent' && styles.activeFilterChipUrgent,
                  ]}
                  onPress={() => setDeadlineFilter('urgent')}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      deadlineFilter === 'urgent' && styles.activeFilterChipText,
                    ]}
                  >
                    🔥 Yaklaşan ({urgentCount})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    deadlineFilter === 'overdue' && styles.activeFilterChipOverdue,
                  ]}
                  onPress={() => setDeadlineFilter('overdue')}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      deadlineFilter === 'overdue' && styles.activeFilterChipText,
                    ]}
                  >
                    ⚠️ Günü Geçen ({overdueCount})
                  </Text>
                </TouchableOpacity>
              </View>

              {filteredEvents.length === 0 ? (
                <View style={styles.noDataCard}>
                  <Text style={styles.noDataIcon}>🎉</Text>
                  <Text style={styles.noDataTitle}>Bekleyen Teslim Bulunmuyor</Text>
                  <Text style={styles.noDataDesc}>
                    Bu filtreye uygun herhangi bir ödev veya yaklaşan etkinlik yok.
                  </Text>
                </View>
              ) : (
                filteredEvents.map((event) => {
                  let badgeStyle = styles.badgeNormal;
                  let badgeTextStyle = styles.badgeTextNormal;
                  let badgeLabel = `${event.daysRemaining} gün kaldı`;

                  if (event.isOverdue) {
                    badgeStyle = styles.badgeOverdue;
                    badgeTextStyle = styles.badgeTextOverdue;
                    badgeLabel = 'Süresi Doldu';
                  } else if (event.daysRemaining <= 0) {
                    badgeStyle = styles.badgeToday;
                    badgeTextStyle = styles.badgeTextToday;
                    badgeLabel = 'BUGÜN!';
                  } else if (event.daysRemaining === 1) {
                    badgeStyle = styles.badgeTomorrow;
                    badgeTextStyle = styles.badgeTextTomorrow;
                    badgeLabel = 'Yarın!';
                  }

                  return (
                    <View key={event.id} style={styles.eventCard}>
                      <View style={styles.eventCardHeader}>
                        <View style={styles.courseTagBadge}>
                          <Text style={styles.courseTagText}>{event.courseCode}</Text>
                        </View>
                        <View style={[styles.badgeBase, badgeStyle]}>
                          <Text style={[styles.badgeTextBase, badgeTextStyle]}>
                            {badgeLabel}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.eventTitle}>{event.name}</Text>
                      <Text style={styles.eventCourseFullName}>{event.courseName}</Text>

                      {event.description ? (
                        <Text style={styles.eventDesc} numberOfLines={2}>
                          {event.description}
                        </Text>
                      ) : null}

                      <View style={styles.eventCardFooter}>
                        <View style={styles.dateTimeContainer}>
                          <Text style={styles.dateTimeText}>
                            📅 {event.formattedDate} — {event.formattedTime}
                          </Text>
                        </View>

                        {event.actionUrl ? (
                          <TouchableOpacity
                            style={[
                              styles.actionBtn,
                              event.isOverdue && styles.actionBtnOverdue,
                            ]}
                            onPress={() => openUrl(event.actionUrl)}
                          >
                            <Text style={styles.actionBtnText}>
                              {event.actionName || 'Teslim Et'} ↗
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          ) : (
            <View>
              {courses.length === 0 ? (
                <View style={styles.noDataCard}>
                  <Text style={styles.noDataIcon}>📚</Text>
                  <Text style={styles.noDataTitle}>Kayıtlı Ders Bulunamadı</Text>
                  <Text style={styles.noDataDesc}>
                    Moodle hesabınızda aktif dönem dersi listelenmedi.
                  </Text>
                </View>
              ) : (
                courses.map((course) => (
                  <View key={course.id} style={styles.courseCard}>
                    <View style={styles.courseHeader}>
                      <View style={styles.courseCodeBadge}>
                        <Text style={styles.courseCodeText}>{course.code}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.courseOpenBtn}
                        onPress={() => openUrl(course.viewurl)}
                      >
                        <Text style={styles.courseOpenBtnText}>Moodle'da Aç ↗</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.courseTitle}>{course.fullname}</Text>

                    {course.instructor ? (
                      <View style={styles.instructorRow}>
                        <Text style={styles.instructorIcon}>👨‍🏫</Text>
                        <Text style={styles.instructorText}>{course.instructor}</Text>
                      </View>
                    ) : null}

                    {course.hasprogress && typeof course.progress === 'number' ? (
                      <View style={styles.progressContainer}>
                        <View style={styles.progressBarBackground}>
                          <View
                            style={[
                              styles.progressBarFill,
                              { width: `${Math.min(100, Math.max(0, course.progress))}%` },
                            ]}
                          />
                        </View>
                        <Text style={styles.progressText}>%{course.progress}</Text>
                      </View>
                    ) : null}
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* Connect Modal */}
      <Modal
        visible={showConnectModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowConnectModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Moodle LMS Oturumu Bağla</Text>
              <TouchableOpacity onPress={() => setShowConnectModal(false)}>
                <Text style={styles.closeModalText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <Text style={styles.modalSubheading}>
                OSTİM LMS Microsoft 365 ile oturum açtığı için tek seferlik oturum anahtarınızı
                eşleştirmeniz gerekmektedir. Bir kez bağlandıktan sonra aylar boyunca tekrar giriş
                istemez.
              </Text>

              {connectError ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorBoxText}>{connectError}</Text>
                </View>
              ) : null}

              <Text style={styles.inputLabel}>Sesskey (Moodle Oturum Anahtarı):</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Örn: PCMcci68p5"
                placeholderTextColor="#64748b"
                value={inputSesskey}
                onChangeText={setInputSesskey}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.inputLabel}>MoodleSession Çerezi (Cookie):</Text>
              <TextInput
                style={[styles.textInput, styles.multilineInput]}
                placeholder="Örn: ostim_moodle_session_id veya MoodleSession=..."
                placeholderTextColor="#64748b"
                value={inputCookie}
                onChangeText={setInputCookie}
                autoCapitalize="none"
                autoCorrect={false}
                multiline
              />

              <TouchableOpacity
                style={styles.quickFillBtn}
                onPress={handleQuickFill}
              >
                <Text style={styles.quickFillBtnText}>⚡ Son Aktif Sesskey'i Doldur (PCMcci68p5)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.helpToggleBtn}
                onPress={() => setShowHelpModal(true)}
              >
                <Text style={styles.helpToggleText}>❓ Bu değerleri nasıl bulabilirim?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveSessionBtn}
                onPress={handleConnect}
                disabled={connecting}
              >
                {connecting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.saveSessionBtnText}>Bağlan ve Doğrula</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Help Modal */}
      <Modal
        visible={showHelpModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHelpModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.helpModalContent}>
            <Text style={styles.helpModalTitle}>📖 Oturum Bilgilerini Alma Rehberi</Text>
            <ScrollView style={styles.helpModalScroll}>
              <Text style={styles.helpStep}>
                1. Bilgisayarınızın tarayıcısında (Chrome/Firefox/Edge){' '}
                <Text style={styles.boldText}>lmsclus.ostimteknik.edu.tr</Text> adresine girip Office
                365 ile giriş yapın.
              </Text>
              <Text style={styles.helpStep}>
                2. Klavyeden <Text style={styles.boldText}>F12</Text> tuşuna basarak Geliştirici
                Araçları'nı açın.
              </Text>
              <Text style={styles.helpStep}>
                3. <Text style={styles.boldText}>Konsol (Console)</Text> sekmesine gelin ve şu kodu
                yapıştırıp Enter'a basın:
              </Text>
              <View style={styles.codeBox}>
                <Text style={styles.codeText}>
                  {`console.log("Sesskey:", M.cfg.sesskey);`}
                </Text>
              </View>
              <Text style={styles.helpStep}>
                4. <Text style={styles.boldText}>Depolama (Storage / Application)</Text> $\to${' '}
                <Text style={styles.boldText}>Çerezler (Cookies)</Text> sekmesinde{' '}
                <Text style={styles.boldText}>MoodleSession</Text> değerini kopyalayıp buraya
                yapıştırın.
              </Text>
              <Text style={styles.helpStep}>
                Bu çerez Microsoft 2FA oturumunuza bağlıdır ve sistem sizi çıkartana dek haftalarca
                aktif kalır.
              </Text>
            </ScrollView>
            <TouchableOpacity
              style={styles.helpCloseBtn}
              onPress={() => setShowHelpModal(false)}
            >
              <Text style={styles.helpCloseBtnText}>Anladım, Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  statusBarCard: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  statusTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  statusSubtitle: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  statusRight: {
    marginLeft: 8,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncBtn: {
    backgroundColor: '#334155',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  syncBtnText: {
    fontSize: 14,
  },
  disconnectBtn: {
    backgroundColor: '#7f1d1d',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  disconnectBtnText: {
    color: '#fecaca',
    fontSize: 12,
    fontWeight: '600',
  },
  connectTriggerBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  connectTriggerBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  subTabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  subTabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeSubTabButton: {
    backgroundColor: '#2563eb',
  },
  subTabText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  activeSubTabText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  contentScrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    marginTop: 40,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  primaryConnectBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryConnectBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  openWebBtn: {
    backgroundColor: '#1e293b',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  openWebBtnText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 8,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  activeFilterChip: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  activeFilterChipUrgent: {
    backgroundColor: '#b45309',
    borderColor: '#b45309',
  },
  activeFilterChipOverdue: {
    backgroundColor: '#991b1b',
    borderColor: '#991b1b',
  },
  filterChipText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  activeFilterChipText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  noDataCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  noDataIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  noDataTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  noDataDesc: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
  },
  eventCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  eventCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  courseTagBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  courseTagText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '700',
  },
  badgeBase: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeTextBase: {
    fontSize: 11,
    fontWeight: '700',
  },
  badgeNormal: {
    backgroundColor: '#064e3b',
  },
  badgeTextNormal: {
    color: '#6ee7b7',
  },
  badgeToday: {
    backgroundColor: '#7c2d12',
  },
  badgeTextToday: {
    color: '#fdba74',
  },
  badgeTomorrow: {
    backgroundColor: '#78350f',
  },
  badgeTextTomorrow: {
    color: '#fde68a',
  },
  badgeOverdue: {
    backgroundColor: '#7f1d1d',
  },
  badgeTextOverdue: {
    color: '#fca5a5',
  },
  eventTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  eventCourseFullName: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 8,
  },
  eventDesc: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 10,
  },
  eventCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  dateTimeContainer: {
    flex: 1,
  },
  dateTimeText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '500',
  },
  actionBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  actionBtnOverdue: {
    backgroundColor: '#475569',
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  courseCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  courseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  courseCodeBadge: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  courseCodeText: {
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '700',
  },
  courseOpenBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  courseOpenBtnText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
  },
  courseTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 8,
  },
  instructorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  instructorIcon: {
    fontSize: 13,
    marginRight: 6,
  },
  instructorText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  progressBarBackground: {
    flex: 1,
    height: 6,
    backgroundColor: '#334155',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10b981',
  },
  progressText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  closeModalText: {
    color: '#94a3b8',
    fontSize: 18,
    padding: 4,
  },
  modalScroll: {
    maxHeight: 500,
  },
  modalSubheading: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  errorBox: {
    backgroundColor: '#7f1d1d',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorBoxText: {
    color: '#fecaca',
    fontSize: 12,
  },
  inputLabel: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 14,
  },
  multilineInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  quickFillBtn: {
    backgroundColor: '#0f2942',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e40af',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickFillBtnText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  helpToggleBtn: {
    marginBottom: 16,
  },
  helpToggleText: {
    color: '#60a5fa',
    fontSize: 13,
    fontWeight: '600',
  },
  saveSessionBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  saveSessionBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  helpModalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  helpModalTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 14,
  },
  helpModalScroll: {
    maxHeight: 400,
  },
  helpStep: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  boldText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  codeBox: {
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  codeText: {
    color: '#38bdf8',
    fontFamily: 'monospace',
    fontSize: 12,
  },
  helpCloseBtn: {
    backgroundColor: '#334155',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 14,
  },
  helpCloseBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
});
