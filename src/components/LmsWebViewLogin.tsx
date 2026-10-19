import React, { useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  SafeAreaView,
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { AppCookieManager } from '../utils/cookieManager';
import { logService } from '../services/logService';
import { AppAlert } from '../utils/alertHelper';

interface LmsWebViewLoginProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (session: { sesskey: string; moodleSession: string }) => void;
}

const LMS_OIDC_URL = 'https://lmsclus.ostimteknik.edu.tr/auth/oidc/';
const LMS_BASE_HOST = 'lmsclus.ostimteknik.edu.tr';

// Custom User-Agent to prevent Microsoft 365 from blocking the WebView as an embedded browser
const CUSTOM_USER_AGENT =
  Platform.OS === 'android'
    ? 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    : undefined;

// JavaScript injected into the WebView to detect sesskey and send it back to React Native
const INJECTED_JAVASCRIPT = `
(function() {
  function tryExtractSesskey() {
    try {
      // 1. Check window.M.cfg.sesskey
      if (window.M && window.M.cfg && window.M.cfg.sesskey) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'SESSKEY_FOUND',
          sesskey: window.M.cfg.sesskey,
          url: window.location.href
        }));
        return true;
      }

      // 2. Check HTML for sesskey in scripts or links
      var html = document.documentElement.innerHTML;
      var match = html.match(/"sesskey":"([a-zA-Z0-9]+)"/) ||
                  html.match(/sesskey=([a-zA-Z0-9]+)/);
      if (match && match[1]) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'SESSKEY_FOUND',
          sesskey: match[1],
          url: window.location.href
        }));
        return true;
      }
    } catch(e) {}
    return false;
  }

  // Run immediately and observe DOM changes
  if (!tryExtractSesskey()) {
    var checkInterval = setInterval(function() {
      if (tryExtractSesskey()) {
        clearInterval(checkInterval);
      }
    }, 500);

    // Stop checking after 15 seconds
    setTimeout(function() {
      clearInterval(checkInterval);
    }, 15000);
  }
})();
true;
`;

export const LmsWebViewLogin: React.FC<LmsWebViewLoginProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(LMS_OIDC_URL);
  const webViewRef = useRef<WebView>(null);
  const capturedRef = useRef(false);

  // Reset captured flag when modal opens
  React.useEffect(() => {
    if (visible) {
      capturedRef.current = false;
      setExtracting(false);
      setLoading(true);
      setCurrentUrl(LMS_OIDC_URL);
    }
  }, [visible]);

  const handleCaptureSession = async (sesskeyCandidate?: string) => {
    if (capturedRef.current) return;

    try {
      setExtracting(true);
      logService.info('LMS WebView', 'Moodle oturum çerezleri taranıyor...');

      // 1. Extract MoodleSession cookie from native CookieManager
      const moodleSession = await AppCookieManager.getCookieValue(
        'https://lmsclus.ostimteknik.edu.tr',
        'MoodleSession'
      );

      if (!moodleSession) {
        logService.warn('LMS WebView', 'MoodleSession çerezi henüz oluşmadı.');
        setExtracting(false);
        return;
      }

      // 2. If sesskey was not passed via postMessage, inject JS to retrieve it
      let finalSesskey = sesskeyCandidate;
      if (!finalSesskey && webViewRef.current) {
        // Request sesskey check
        webViewRef.current.injectJavaScript(`
          (function() {
            var sk = (window.M && window.M.cfg && window.M.cfg.sesskey) || '';
            if (!sk) {
              var m = document.documentElement.innerHTML.match(/"sesskey":"([a-zA-Z0-9]+)"/);
              if (m) sk = m[1];
            }
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'SESSKEY_DIRECT',
              sesskey: sk
            }));
          })();
          true;
        `);
      }

      if (moodleSession && finalSesskey) {
        capturedRef.current = true;
        logService.info('LMS WebView', 'LMS oturumu başarıyla yakalandı!', {
          sesskey: finalSesskey,
          cookieLen: moodleSession.length,
        });

        onSuccess({
          sesskey: finalSesskey,
          moodleSession: moodleSession,
        });
      }
    } catch (err: any) {
      logService.error('LMS WebView', 'Oturum yakalama hatası', err.message);
    } finally {
      setExtracting(false);
    }
  };

  const handleMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'SESSKEY_FOUND' || data.type === 'SESSKEY_DIRECT') {
        if (data.sesskey) {
          logService.info('LMS WebView', `Sesskey yakalandı: ${data.sesskey}`);
          await handleCaptureSession(data.sesskey);
        }
      }
    } catch (e) {
      // Ignore non-json messages
    }
  };

  const handleNavigationStateChange = (navState: WebViewNavigation) => {
    setCurrentUrl(navState.url);
    logService.info('LMS WebView Nav', navState.url);

    // If navigated back to Moodle domain after Microsoft login
    if (navState.url.includes(LMS_BASE_HOST)) {
      // If we are on /my/ or home, login is completed
      if (
        navState.url.includes('/my/') ||
        navState.url.includes('redirect=0') ||
        navState.url === 'https://lmsclus.ostimteknik.edu.tr/'
      ) {
        // Trigger capture
        setTimeout(() => {
          handleCaptureSession();
        }, 800);
      }
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <Text style={styles.closeBtnText}>✕ Kapat</Text>
          </TouchableOpacity>

          <View style={styles.titleContainer}>
            <Text style={styles.headerTitle}>Microsoft 365 ile LMS Girişi</Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {currentUrl.includes('microsoft')
                ? 'Microsoft Oturum Açma Ekranı'
                : 'OSTİM LMS Portalı'}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => handleCaptureSession()}
            style={styles.retryBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.retryBtnText}>🔄 Yakala</Text>
          </TouchableOpacity>
        </View>

        {/* Loading / Extracting Status Banner */}
        {extracting ? (
          <View style={styles.extractingBanner}>
            <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={styles.extractingText}>Oturum bilgileri alınıyor ve doğrulanıyor...</Text>
          </View>
        ) : loading ? (
          <View style={styles.progressContainer}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={styles.progressText}>Sayfa yükleniyor...</Text>
          </View>
        ) : null}

        {/* WebView */}
        {Platform.OS !== 'web' ? (
          React.createElement(WebView as any, {
            ref: webViewRef,
            source: { uri: LMS_OIDC_URL },
            userAgent: CUSTOM_USER_AGENT,
            injectedJavaScript: INJECTED_JAVASCRIPT,
            onMessage: handleMessage,
            onNavigationStateChange: handleNavigationStateChange,
            onLoadStart: () => setLoading(true),
            onLoadEnd: () => setLoading(false),
            sharedCookiesEnabled: true,
            thirdPartyCookiesEnabled: true,
            domStorageEnabled: true,
            javaScriptEnabled: true,
            style: styles.webView,
          })
        ) : (
          <View style={styles.webFallbackContainer}>
            <Text style={styles.webFallbackTitle}>Web Sürümünde Manuel Giriş</Text>
            <Text style={styles.webFallbackDesc}>
              Web tarayıcısında çerez kısıtlamaları nedeniyle lütfen Moodle sekmesinden çerezinizi
              kopyalayınız veya mobil uygulamayı kullanınız.
            </Text>
            <TouchableOpacity style={styles.webFallbackBtn} onPress={onClose}>
              <Text style={styles.webFallbackBtnText}>Anladım, Kapat</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e17',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  closeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#1e293b',
    borderRadius: 8,
  },
  closeBtnText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  headerTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
  },
  headerSub: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  retryBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.4)',
  },
  retryBtnText: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: '700',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    backgroundColor: '#1e293b',
  },
  progressText: {
    color: '#94a3b8',
    fontSize: 12,
    marginLeft: 8,
  },
  extractingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#16a34a',
  },
  extractingText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  webView: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  webFallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  webFallbackTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  webFallbackDesc: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  webFallbackBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  webFallbackBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
