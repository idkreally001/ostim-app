import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { WebView } from 'react-native-webview';

export interface LmsViewerDoc {
  title: string;
  url: string;
  type?: string;
}

interface LmsDocViewerModalProps {
  visible: boolean;
  doc: LmsViewerDoc | null;
  onClose: () => void;
  onOpenInBrowser: (url: string) => void;
  onDownloadAndShare: (url: string, title: string) => void;
}

export const LmsDocViewerModal: React.FC<LmsDocViewerModalProps> = ({
  visible,
  doc,
  onClose,
  onOpenInBrowser,
  onDownloadAndShare,
}) => {
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  if (!doc || !visible) return null;

  // For office files and PDF preview, Google Docs Viewer provides reliable in-app embedding
  const isDirectWebpage = doc.url.includes('/mod/resource/') || doc.url.includes('/mod/page/');
  const viewerUrl = isDirectWebpage
    ? doc.url
    : `https://docs.google.com/viewer?embedded=true&url=${encodeURIComponent(doc.url)}`;

  const handleBrowserFallback = () => {
    onClose();
    onOpenInBrowser(doc.url);
  };

  const handleDownloadFallback = () => {
    onDownloadAndShare(doc.url, doc.title);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" />

        {/* Modal Top Navigation Bar */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.closeBtnText}>✕ Kapat</Text>
          </TouchableOpacity>

          <View style={styles.titleContainer}>
            <Text style={styles.titleText} numberOfLines={1}>
              {doc.title}
            </Text>
            <Text style={styles.subText} numberOfLines={1}>
              {doc.type ? doc.type.toUpperCase() : 'BELGE'} • Uygulama İçi Okuyucu
            </Text>
          </View>

          <View style={styles.actionGroup}>
            <TouchableOpacity
              style={styles.actionIconBtn}
              onPress={() => onDownloadAndShare(doc.url, doc.title)}
              activeOpacity={0.7}
            >
              <Text style={styles.actionIcon}>📥</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionIconBtn}
              onPress={() => onOpenInBrowser(doc.url)}
              activeOpacity={0.7}
            >
              <Text style={styles.actionIcon}>🌐</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Content Body with WebView & Error Fallback */}
        <View style={styles.content}>
          {hasError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorTitle}>Uygulama İçi Önizleme Başarısız</Text>
              <Text style={styles.errorDesc}>
                Bu belge türü (veya oturum kısıtlaması) nedeniyle dosya uygulama içinde açılamadı.
                Tarayıcıda görüntüleyebilir veya doğrudan telefonunuza indirebilirsiniz.
              </Text>
              <View style={styles.errorBtnRow}>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handleBrowserFallback}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryBtnText}>🌐 Tarayıcıda Aç</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={handleDownloadFallback}
                  activeOpacity={0.8}
                >
                  <Text style={styles.secondaryBtnText}>📥 Cihaza İndir ve Aç</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              {loading ? (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color="#3b82f6" />
                  <Text style={styles.loadingText}>Belge yükleniyor...</Text>
                </View>
              ) : null}

              {React.createElement(WebView as any, {
                source: { uri: viewerUrl },
                style: styles.webView,
                javaScriptEnabled: true,
                domStorageEnabled: true,
                startInLoadingState: true,
                scalesPageToFit: true,
                onLoadEnd: () => setLoading(false),
                onError: () => {
                  setLoading(false);
                  setHasError(true);
                },
                onHttpError: (syntheticEvent: any) => {
                  const { statusCode } = syntheticEvent.nativeEvent;
                  if (statusCode >= 400) {
                    setLoading(false);
                    setHasError(true);
                  }
                },
              })}
            </>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090d16',
    paddingTop: Platform.OS === 'android' ? 24 : 0,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  closeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  closeBtnText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
  },
  titleContainer: {
    flex: 1,
    marginHorizontal: 10,
    alignItems: 'center',
  },
  titleText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  subText: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 1,
  },
  actionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionIconBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  actionIcon: {
    fontSize: 14,
  },
  content: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  webView: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingOverlay: {
    ...(StyleSheet.absoluteFill as any),
    backgroundColor: '#090d16',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 12,
  },
  errorBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorDesc: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
  },
  errorBtnRow: {
    width: '100%',
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryBtn: {
    backgroundColor: '#1e293b',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  secondaryBtnText: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '700',
  },
});
