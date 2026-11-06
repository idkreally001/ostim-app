import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export interface DialogButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export interface DialogOptions {
  title: string;
  message?: string;
  buttons?: DialogButton[];
  icon?: string;
}

interface DialogContextType {
  showDialog: (options: DialogOptions) => void;
  hideDialog: () => void;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

// Standalone global trigger so utility modules can invoke modern dialogs seamlessly
let globalDialogTrigger: ((options: DialogOptions) => void) | null = null;

export const showModernDialog = (options: DialogOptions) => {
  if (globalDialogTrigger) {
    globalDialogTrigger(options);
  } else {
    // Fallback if triggered before provider mounts
    console.warn('[DialogProvider] Dialog requested before provider mounted:', options.title);
  }
};

export const DialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { colors } = useTheme();
  const [dialogState, setDialogState] = useState<{
    visible: boolean;
    options: DialogOptions;
  }>({
    visible: false,
    options: { title: '' },
  });

  const hideDialog = useCallback(() => {
    setDialogState((prev) => ({ ...prev, visible: false }));
  }, []);

  const showDialog = useCallback((options: DialogOptions) => {
    setDialogState({
      visible: true,
      options,
    });
  }, []);

  // Bind global trigger
  React.useEffect(() => {
    globalDialogTrigger = showDialog;
    return () => {
      globalDialogTrigger = null;
    };
  }, [showDialog]);

  const { title, message, buttons = [{ text: 'Tamam', style: 'default' }], icon } = dialogState.options;

  return (
    <DialogContext.Provider value={{ showDialog, hideDialog }}>
      {children}
      <Modal
        visible={dialogState.visible}
        transparent
        animationType="fade"
        onRequestClose={hideDialog}
        statusBarTranslucent
      >
        <TouchableWithoutFeedback onPress={hideDialog}>
          <View style={styles.backdrop}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.dialogCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.cardBorder,
                  },
                ]}
              >
                {icon ? (
                  <View style={[styles.iconContainer, { backgroundColor: colors.primarySubtle }]}>
                    <Text style={styles.iconText}>{icon}</Text>
                  </View>
                ) : null}

                <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

                {message ? (
                  <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
                ) : null}

                <View style={styles.actionsRow}>
                  {buttons.map((btn, index) => {
                    const isCancel = btn.style === 'cancel';
                    const isDestructive = btn.style === 'destructive';

                    let btnBg = colors.primary;
                    let textColor = '#ffffff';

                    if (isCancel) {
                      btnBg = 'transparent';
                      textColor = colors.textSecondary;
                    } else if (isDestructive) {
                      btnBg = colors.danger;
                      textColor = '#ffffff';
                    }

                    return (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.actionButton,
                          {
                            backgroundColor: btnBg,
                            borderColor: isCancel ? colors.cardBorder : 'transparent',
                            borderWidth: isCancel ? 1 : 0,
                          },
                        ]}
                        activeOpacity={0.8}
                        onPress={() => {
                          hideDialog();
                          btn.onPress?.();
                        }}
                      >
                        <Text
                          style={[
                            styles.actionButtonText,
                            { color: textColor, fontWeight: isCancel ? '600' : '700' },
                          ]}
                        >
                          {btn.text}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </DialogContext.Provider>
  );
};

export const useDialog = (): DialogContextType => {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return ctx;
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 28, // Material 3 Extra-Large rounding
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconText: {
    fontSize: 24,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  message: {
    fontSize: 14.5,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 24,
  },
  actionsRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'flex-end',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 16, // Pill / Rounded button
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 14.5,
  },
});
