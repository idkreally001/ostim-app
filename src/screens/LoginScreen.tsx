import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  Linking,
  Modal,
} from 'react-native';
import { obsClient } from '../api/obsClient';
import { lmsClient } from '../api/lmsClient';
import { AuthStorage } from '../storage/authStorage';
import { configManager } from '../config/configManager';
import { AppAlert } from '../utils/alertHelper';
import { LmsSessionData } from '../types/models';
import { LmsWebViewLogin } from '../components/LmsWebViewLogin';

interface LoginScreenProps {
  initialPortal?: 'obs' | 'lms';
  isObsAuthenticated?: boolean;
  isLmsAuthenticated?: boolean;
  onObsLoginSuccess: () => void;
  onLmsLoginSuccess: () => void;
  onContinueToPortal?: (portal: 'obs' | 'lms') => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  initialPortal = 'obs',
  isObsAuthenticated = false,
  isLmsAuthenticated = false,
  onObsLoginSuccess,
  onLmsLoginSuccess,
  onContinueToPortal,
}) => {
  const [activeTab, setActiveTab] = useState<'obs' | 'lms'>(initialPortal);

  // OBS Form State
  const [studentNo, setStudentNo] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [obsLoading, setObsLoading] = useState(false);

  // LMS Form State
  const [sesskey, setSesskey] = useState('');
  const [moodleCookie, setMoodleCookie] = useState('');
  const [lmsLoading, setLmsLoading] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showWebViewLogin, setShowWebViewLogin] = useState(false);
  const [showManualLms, setShowManualLms] = useState(Platform.OS === 'web');

  // OBS Login Action
  const handleObsLogin = async () => {
    if (!studentNo.trim() || !password.trim()) {
      AppAlert.alert('Eksik Bilgi', 'Lütfen öğrenci numarası ve OBS şifrenizi giriniz.');
      return;
    }

    setObsLoading(true);
    try {
      await configManager.initialize();
      const auth = await obsClient.login(studentNo.trim(), password.trim());
      await AuthStorage.saveSession(auth.jwtToken, auth.studentNo);

      // Pre-fetch profile for instant cache
      const profile = await obsClient.getProfile();
      await AuthStorage.saveCachedProfile(profile);

      onObsLoginSuccess();
    } catch (err: any) {
      AppAlert.alert('OBS Girişi Başarısız', err.message || 'Öğrenci numarası veya şifre hatalı.');
    } finally {
      setObsLoading(false);
    }
  };

  // Shared LMS Connection & Cache Logic
  const connectWithSession = async (cleanSesskey: string, cleanCookie: string) => {
    setLmsLoading(true);
    try {
      const sessionData: LmsSessionData = {
        sesskey: cleanSesskey,
        moodleSession: cleanCookie,
        lastSynced: new Date().toISOString(),
      };

      lmsClient.setSession(sessionData);

      // Test connection
      const testResult = await lmsClient.testConnection();
      if (!testResult.success) {
        throw new Error(testResult.message);
      }

      await AuthStorage.saveLmsSession(sessionData);

      // Fetch initial data
      const [courses, events] = await Promise.all([
        lmsClient.getCourses(),
        lmsClient.getUpcomingDeadlines(),
      ]);

      await AuthStorage.saveCachedLmsData({
        courses,
        events,
        lastUpdated: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      });

      onLmsLoginSuccess();
    } catch (err: any) {
      lmsClient.clearSession();
      AppAlert.alert('LMS Bağlantı Hatası', err.message || 'Moodle oturumu doğrulanamadı.');
    } finally {
      setLmsLoading(false);
    }
  };

  // LMS Manual Connect Action
  const handleLmsConnect = async () => {
    const cleanSesskey = sesskey.trim();
    let cleanCookie = moodleCookie.trim();

    if (!cleanSesskey) {
      AppAlert.alert('Eksik Bilgi', 'Lütfen Moodle sesskey değerini giriniz.');
      return;
    }

    if (!cleanCookie) {
      AppAlert.alert('Eksik Bilgi', 'Lütfen MoodleSession çerez değerini giriniz.');
      return;
    }

    if (cleanCookie.startsWith('MoodleSession=')) {
      cleanCookie = cleanCookie.replace('MoodleSession=', '').split(';')[0].trim();
    }

    await connectWithSession(cleanSesskey, cleanCookie);
  };

  // Automated Microsoft 365 OAuth Capture Success
  const handleWebViewSuccess = async ({
    sesskey: capturedSesskey,
    moodleSession: capturedCookie,
  }: {
    sesskey: string;
    moodleSession: string;
  }) => {
    setShowWebViewLogin(false);
    setSesskey(capturedSesskey);
    setMoodleCookie(capturedCookie);
    await connectWithSession(capturedSesskey, capturedCookie);
  };

  const handleQuickFillLms = () => {
    setSesskey('OsdqwhZWb8');
  };

  const openUrl = (url: string) => {
    Linking.openURL(url).catch(() => AppAlert.alert('Hata', 'Bağlantı açılamadı.'));
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {/* Header Branding */}
        <View style={styles.brandingContainer}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>OSTİM TEKNİK</Text>
          </View>
          <Text style={styles.mainTitle}>Üniversite Portalı</Text>
          <Text style={styles.mainSubtitle}>Öğrenci Bilgi Sistemi (OBS) & Moodle LMS</Text>
        </View>

        {/* Modern Dual Portal Switcher Tabs */}
        <View style={styles.tabSwitcher}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'obs' && styles.activeTabButton]}
            onPress={() => setActiveTab('obs')}
          >
            <View style={styles.tabContentRow}>
              <Text style={styles.tabIcon}>🎓</Text>
              <Text style={[styles.tabText, activeTab === 'obs' && styles.activeTabText]}>
                OBS Portalı
              </Text>
              {isObsAuthenticated ? <View style={styles.authDotActive} /> : null}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'lms' && styles.activeTabButton]}
            onPress={() => setActiveTab('lms')}
          >
            <View style={styles.tabContentRow}>
              <Text style={styles.tabIcon}>📚</Text>
              <Text style={[styles.tabText, activeTab === 'lms' && styles.activeTabText]}>
                Moodle LMS
              </Text>
              {isLmsAuthenticated ? <View style={styles.authDotActive} /> : null}
            </View>
          </TouchableOpacity>
        </View>

        {/* Portal Card Content */}
        <View style={styles.card}>
          {activeTab === 'obs' ? (
            /* --- OBS PORTAL CONTENT --- */
            <View>
              <View style={styles.portalHeaderRow}>
                <View>
                  <Text style={styles.cardTitle}>Öğrenci Bilgi Sistemi</Text>
                  <Text style={styles.cardSubtitle}>Ders programı, notlar ve devamsızlık</Text>
                </View>
                <View style={[styles.statusPill, isObsAuthenticated ? styles.pillActive : styles.pillInactive]}>
                  <Text style={[styles.statusPillText, isObsAuthenticated ? styles.pillTextActive : styles.pillTextInactive]}>
                    {isObsAuthenticated ? 'Bağlı' : 'Giriş Gerekli'}
                  </Text>
                </View>
              </View>

              {isObsAuthenticated ? (
                /* Already Authenticated to OBS */
                <View style={styles.alreadyAuthedBox}>
                  <Text style={styles.alreadyAuthedIcon}>✅</Text>
                  <Text style={styles.alreadyAuthedTitle}>OBS Oturumu Aktif</Text>
                  <Text style={styles.alreadyAuthedDesc}>
                    Öğrenci Bilgi Sistemine zaten bağlısınız. Verilerinize erişebilirsiniz.
                  </Text>
                  <TouchableOpacity
                    style={styles.continueBtn}
                    onPress={() => onContinueToPortal ? onContinueToPortal('obs') : onObsLoginSuccess()}
                  >
                    <Text style={styles.continueBtnText}>OBS Paneline Devam Et ➔</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                /* OBS Login Form */
                <View style={styles.form}>
                  <Text style={styles.label}>Öğrenci Numarası</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Örn: 220000000"
                    placeholderTextColor="#64748b"
                    value={studentNo}
                    onChangeText={setStudentNo}
                    keyboardType="numeric"
                    autoCapitalize="none"
                  />

                  <Text style={styles.label}>OBS Şifresi</Text>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder="••••••••"
                      placeholderTextColor="#64748b"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Text style={styles.eyeBtnText}>{showPassword ? 'Gizle' : 'Göster'}</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryButton, obsLoading && styles.buttonDisabled]}
                    onPress={handleObsLogin}
                    disabled={obsLoading}
                  >
                    {obsLoading ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text style={styles.primaryButtonText}>OBS ile Giriş Yap</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            /* --- LMS PORTAL CONTENT --- */
            <View>
              <View style={styles.portalHeaderRow}>
                <View>
                  <Text style={styles.cardTitle}>Moodle LMS</Text>
                  <Text style={styles.cardSubtitle}>Ödevler, teslimler ve ders materyalleri</Text>
                </View>
                <View style={[styles.statusPill, isLmsAuthenticated ? styles.pillActive : styles.pillInactive]}>
                  <Text style={[styles.statusPillText, isLmsAuthenticated ? styles.pillTextActive : styles.pillTextInactive]}>
                    {isLmsAuthenticated ? 'Bağlı' : 'Oturum Gerekli'}
                  </Text>
                </View>
              </View>

              {isLmsAuthenticated ? (
                /* Already Authenticated to LMS */
                <View style={styles.alreadyAuthedBox}>
                  <Text style={styles.alreadyAuthedIcon}>✅</Text>
                  <Text style={styles.alreadyAuthedTitle}>Moodle LMS Oturumu Aktif</Text>
                  <Text style={styles.alreadyAuthedDesc}>
                    Office 365 ile LMS oturumunuz eşleştirilmiştir.
                  </Text>
                  <TouchableOpacity
                    style={styles.continueBtn}
                    onPress={() => onContinueToPortal ? onContinueToPortal('lms') : onLmsLoginSuccess()}
                  >
                    <Text style={styles.continueBtnText}>LMS Paneline Devam Et ➔</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                /* LMS Connect Form */
                <View style={styles.form}>
                  {/* One-Tap Microsoft 365 OAuth Login Card */}
                  <TouchableOpacity
                    style={styles.msOAuthBtn}
                    onPress={() => setShowWebViewLogin(true)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.msOAuthIconCircle}>
                      <Text style={styles.msOAuthIcon}>🔑</Text>
                    </View>
                    <View style={styles.msOAuthTextCol}>
                      <Text style={styles.msOAuthTitle}>Microsoft 365 ile Hızlı Giriş</Text>
                      <Text style={styles.msOAuthSub}>
                        Tek dokunuşla kurumsal hesabınızla bağlanın
                      </Text>
                    </View>
                    <Text style={styles.msOAuthArrow}>➔</Text>
                  </TouchableOpacity>

                  {/* Manual / Advanced Toggle */}
                  <TouchableOpacity
                    style={styles.manualToggleBtn}
                    onPress={() => setShowManualLms(!showManualLms)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.manualToggleText}>
                      {showManualLms ? '▲ Manuel Girişi Gizle' : '⚙️ Manuel Giriş (Sesskey & Çerez)'}
                    </Text>
                  </TouchableOpacity>

                  {showManualLms ? (
                    <View style={styles.manualSection}>
                      <View style={styles.oidcInfoBox}>
                        <Text style={styles.oidcInfoTitle}>🔐 Manuel Moodle Girişi</Text>
                        <Text style={styles.oidcInfoDesc}>
                          Tarayıcı geliştirici araçlarından aldığınız sesskey ve MoodleSession çerez değerini yapıştırarak da bağlanabilirsiniz.
                        </Text>
                      </View>

                      <Text style={styles.label}>Sesskey (Moodle Oturum Anahtarı)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Örn: PCMcci68p5"
                        placeholderTextColor="#64748b"
                        value={sesskey}
                        onChangeText={setSesskey}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />

                      <Text style={styles.label}>MoodleSession Çerezi (Cookie)</Text>
                      <TextInput
                        style={[styles.input, styles.multilineInput]}
                        placeholder="MoodleSession=..."
                        placeholderTextColor="#64748b"
                        value={moodleCookie}
                        onChangeText={setMoodleCookie}
                        autoCapitalize="none"
                        autoCorrect={false}
                        multiline
                      />

                      <TouchableOpacity style={styles.quickFillBtn} onPress={handleQuickFillLms}>
                        <Text style={styles.quickFillBtnText}>⚡ Son Aktif Sesskey'i Doldur (OsdqwhZWb8)</Text>
                      </TouchableOpacity>

                      <View style={styles.lmsActionRow}>
                        <TouchableOpacity
                          style={styles.openWebSmallBtn}
                          onPress={() => openUrl('https://lmsclus.ostimteknik.edu.tr/auth/oidc/')}
                        >
                          <Text style={styles.openWebSmallBtnText}>🌐 Tarayıcıda Aç</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.helpSmallBtn}
                          onPress={() => setShowHelpModal(true)}
                        >
                          <Text style={styles.helpSmallBtnText}>❓ Nasıl Bulunur?</Text>
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        style={[styles.primaryButton, lmsLoading && styles.buttonDisabled]}
                        onPress={handleLmsConnect}
                        disabled={lmsLoading}
                      >
                        {lmsLoading ? (
                          <ActivityIndicator color="#ffffff" />
                        ) : (
                          <Text style={styles.primaryButtonText}>LMS'yi Bağla ve Doğrula</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              )}
            </View>
          )}
        </View>

        {/* Bottom Switch Portal Indicator */}
        <View style={styles.footerNote}>
          <Text style={styles.footerNoteText}>
            💡 İpucu: OBS ve LMS tamamen bağımsızdır. Dilediğiniz sisteme önce giriş yapabilirsiniz.
          </Text>
        </View>
      </ScrollView>

      {/* Help Modal */}
      <Modal
        visible={showHelpModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHelpModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.helpModalContent}>
            <Text style={styles.helpModalTitle}>📖 LMS Bilgilerini Alma</Text>
            <ScrollView style={styles.helpModalScroll}>
              <Text style={styles.helpStep}>
                1. Tarayıcınızda <Text style={styles.boldText}>lmsclus.ostimteknik.edu.tr</Text> adresine girip Office 365 ile oturum açın.
              </Text>
              <Text style={styles.helpStep}>
                2. Klavyeden <Text style={styles.boldText}>F12</Text> tuşuna basın.
              </Text>
              <Text style={styles.helpStep}>
                3. <Text style={styles.boldText}>Konsol</Text> sekmesine gelin ve şunu yapıştırın:
              </Text>
              <View style={styles.codeBox}>
                <Text style={styles.codeText}>{`console.log(M.cfg.sesskey)`}</Text>
              </View>
              <Text style={styles.helpStep}>
                4. <Text style={styles.boldText}>Depolama (Storage) $\to$ Çerezler (Cookies)</Text> sekmesinde <Text style={styles.boldText}>MoodleSession</Text> değerini kopyalayıp buraya yapıştırın.
              </Text>
            </ScrollView>
            <TouchableOpacity style={styles.helpCloseBtn} onPress={() => setShowHelpModal(false)}>
              <Text style={styles.helpCloseBtnText}>Anladım</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Microsoft 365 In-App WebView Login Modal */}
      <LmsWebViewLogin
        visible={showWebViewLogin}
        onClose={() => setShowWebViewLogin(false)}
        onSuccess={handleWebViewSuccess}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  scrollContainer: {
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 40,
    alignItems: 'center',
  },
  brandingContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoBadge: {
    backgroundColor: '#1d4ed8',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 10,
  },
  logoBadgeText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 2,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 4,
  },
  mainSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 4,
    width: '100%',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  activeTabButton: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  tabContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabIcon: {
    fontSize: 16,
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
  authDotActive: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10b981',
    marginLeft: 2,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 22,
    width: '100%',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  portalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pillActive: {
    backgroundColor: '#064e3b',
  },
  pillInactive: {
    backgroundColor: '#1e293b',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pillTextActive: {
    color: '#6ee7b7',
  },
  pillTextInactive: {
    color: '#64748b',
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#f8fafc',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 18,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#f8fafc',
  },
  eyeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  eyeBtnText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  alreadyAuthedBox: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  alreadyAuthedIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  alreadyAuthedTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  alreadyAuthedDesc: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 16,
  },
  continueBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  continueBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  oidcInfoBox: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#38bdf8',
  },
  oidcInfoTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  oidcInfoDesc: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 16,
  },
  multilineInput: {
    minHeight: 50,
  },
  quickFillBtn: {
    backgroundColor: '#0f2942',
    paddingVertical: 8,
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
  lmsActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  openWebSmallBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  openWebSmallBtnText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  helpSmallBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  helpSmallBtnText: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: '600',
  },
  footerNote: {
    marginTop: 20,
    paddingHorizontal: 12,
  },
  footerNoteText: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
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
    maxHeight: 350,
  },
  helpStep: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  boldText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  codeBox: {
    backgroundColor: '#0f172a',
    padding: 8,
    borderRadius: 6,
    marginBottom: 10,
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
    marginTop: 10,
  },
  helpCloseBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
  msOAuthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0078d4',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#0078d4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  msOAuthIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  msOAuthIcon: {
    fontSize: 22,
  },
  msOAuthTextCol: {
    flex: 1,
  },
  msOAuthTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  msOAuthSub: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
  },
  msOAuthArrow: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  manualToggleBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 8,
  },
  manualToggleText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  manualSection: {
    marginTop: 8,
  },
});
