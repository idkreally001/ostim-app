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
import { useLanguage } from '../i18n';
import { useTheme } from '../theme/ThemeContext';

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
  const { t } = useLanguage();
  const { colors } = useTheme();

  if (!updateInfo || !visible) return null;

  const handleUpdatePress = () => {
    onDismiss();
    updateService.startBackgroundUpdate(updateInfo);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {/* Header Icon Circle */}
          <View style={[styles.iconCircle, { backgroundColor: colors.primarySubtle, borderColor: colors.primary }]}>
            <Text style={[styles.iconSymbol, { color: colors.primary }]}>↑</Text>
          </View>

          <Text style={[styles.title, { color: colors.text }]}>
            {t('update.title')}
          </Text>
          <Text style={[styles.versionTag, { color: colors.primary, backgroundColor: colors.primarySubtle }]}>
            v{updateInfo.currentVersion}  ➔  v{updateInfo.latestVersion}
          </Text>

          {/* Release Notes */}
          <View style={[styles.notesContainer, { backgroundColor: colors.cardAlt, borderColor: colors.cardBorder }]}>
            <Text style={[styles.notesLabel, { color: colors.textMuted }]}>
              {t('update.notes')}
            </Text>
            <ScrollView style={styles.notesScroll} nestedScrollEnabled>
              <Text style={[styles.notesText, { color: colors.textSecondary }]}>
                {updateInfo.releaseNotes || 'Performans iyileştirmeleri ve hata düzeltmeleri.'}
              </Text>
            </ScrollView>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.updateButton, { backgroundColor: colors.primary }]}
              onPress={handleUpdatePress}
              activeOpacity={0.8}
            >
              <Text style={styles.updateButtonText}>
                {Platform.OS === 'android' ? t('update.download_now') : 'GitHub'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dismissButton}
              onPress={onDismiss}
              activeOpacity={0.7}
            >
              <Text style={[styles.dismissButtonText, { color: colors.textMuted }]}>
                {t('update.later')}
              </Text>
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
    borderRadius: 20,
    padding: 22,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
  },
  iconSymbol: {
    fontSize: 26,
    fontWeight: '800',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  versionTag: {
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 14,
  },
  notesContainer: {
    width: '100%',
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
    borderWidth: 1,
  },
  notesLabel: {
    fontSize: 11,
    fontWeight: '700',
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
  },
  buttonContainer: {
    width: '100%',
    gap: 8,
  },
  updateButton: {
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
  },
  updateButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  dismissButton: {
    paddingVertical: 9,
    alignItems: 'center',
  },
  dismissButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
