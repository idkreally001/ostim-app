import { Platform, Alert } from 'react-native';
import { showModernDialog } from '../components/MaterialDialog';

export class AppAlert {
  public static alert(title: string, message?: string, onOk?: () => void, icon?: string): void {
    if (Platform.OS === 'web') {
      const fullMsg = [title, message].filter(Boolean).join('\n\n');
      if (typeof window !== 'undefined' && window.alert) {
        window.alert(fullMsg);
      }
      onOk?.();
      return;
    }

    // Trigger Material 3 Modern Dialog
    showModernDialog({
      title,
      message,
      icon,
      buttons: [{ text: 'Tamam', style: 'default', onPress: onOk }],
    });
  }

  public static confirm(
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
    confirmText = 'Onayla',
    cancelText = 'İptal',
    icon?: string
  ): void {
    if (Platform.OS === 'web') {
      const fullMsg = `${title}\n\n${message}`;
      const confirmed = typeof window !== 'undefined' && window.confirm ? window.confirm(fullMsg) : true;
      if (confirmed) {
        onConfirm();
      } else {
        onCancel?.();
      }
      return;
    }

    // Trigger Material 3 Modern Confirm Dialog
    showModernDialog({
      title,
      message,
      icon: icon || '⚠️',
      buttons: [
        { text: cancelText, style: 'cancel', onPress: onCancel },
        { text: confirmText, style: 'destructive', onPress: onConfirm },
      ],
    });
  }
}
