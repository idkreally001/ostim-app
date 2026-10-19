import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { UpdateInfo, updateService } from '../services/updateService';

interface UpdateModalProps {
  visible: boolean;
  updateInfo: UpdateInfo | null;
  onDismiss: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  visible,
  updateInfo,
  onDismiss,
}) => {
  if (!updateInfo || !visible) return null;

  const handleUpdatePress = () => {
    updateService.downloadAndInstall(updateInfo);
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header Badge */}
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>🚀</Text>
          </View>

          <Text style={styles.title}>Yeni Güncelleme Mevcut!</Text>
          <Text style={styles.versionTag}>
            v{updateInfo.currentVersion}  ➔  v{updateInfo.latestVersion}
          </Text>

          {/* Release Notes */}
          <View style={styles.notesContainer}>
            <Text style={styles.notesLabel}>Yenilikler & Değişiklikler:</Text>
            <ScrollView style={styles.notesScroll} nestedScrollEnabled>
              <Text style={styles.notesText}>{updateInfo.releaseNotes}</Text>
            </ScrollView>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.updateButton}
              onPress={handleUpdatePress}
              activeOpacity={0.8}
            >
              <Text style={styles.updateButtonText}>
                {Platform.OS === 'android' ? '📥 İndir ve Güncelle' : '🌐 GitHub\'da Aç'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dismissButton}
              onPress={onDismiss}
              activeOpacity={0.7}
            >
              <Text style={styles.dismissButtonText}>Daha Sonra Hatırlat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 22,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
    alignItems: 'center',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  iconText: {
    fontSize: 28,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 4,
    textAlign: 'center',
  },
  versionTag: {
    fontSize: 13,
    fontWeight: '600',
    color: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 14,
  },
  notesContainer: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notesScroll: {
    maxHeight: 140,
  },
  notesText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#cbd5e1',
  },
  buttonContainer: {
    width: '100%',
    gap: 10,
  },
  updateButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  updateButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  dismissButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  dismissButtonText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
});
