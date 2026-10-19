import { Platform, Alert } from 'react-native';

export class AppAlert {
  public static alert(title: string, message?: string, onOk?: () => void): void {
    if (Platform.OS === 'web') {
      const fullMsg = [title, message].filter(Boolean).join('\n\n');
      if (typeof window !== 'undefined' && window.alert) {
        window.alert(fullMsg);
      }
      onOk?.();
    } else {
      Alert.alert(title, message, onOk ? [{ text: 'Tamam', onPress: onOk }] : undefined);
    }
  }

  public static confirm(
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
    confirmText = 'Onayla',
    cancelText = 'İptal'
  ): void {
    if (Platform.OS === 'web') {
      const fullMsg = `${title}\n\n${message}`;
      const confirmed = typeof window !== 'undefined' && window.confirm ? window.confirm(fullMsg) : true;
      if (confirmed) {
        onConfirm();
      } else {
        onCancel?.();
      }
    } else {
      Alert.alert(title, message, [
        { text: cancelText, style: 'cancel', onPress: onCancel },
        { text: confirmText, style: 'destructive', onPress: onConfirm },
      ]);
    }
  }
}
