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
} from 'react-native';
import { obsClient } from '../api/obsClient';
import { AuthStorage } from '../storage/authStorage';
import { configManager } from '../config/configManager';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [studentNo, setStudentNo] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!studentNo.trim() || !password.trim()) {
      Alert.alert('Eksik Bilgi', 'Lütfen öğrenci numarası ve şifrenizi giriniz.');
      return;
    }

    setLoading(true);
    try {
      await configManager.initialize();
      const auth = await obsClient.login(studentNo.trim(), password.trim());
      await AuthStorage.saveSession(auth.jwtToken, auth.studentNo);

      // Pre-fetch profile into offline storage
      const profile = await obsClient.getProfile();
      await AuthStorage.saveCachedProfile(profile);

      onLoginSuccess();
    } catch (err: any) {
      console.error('Login error:', err);
      Alert.alert('Giriş Başarısız', err.message || 'Öğrenci numarası veya şifre hatalı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.card}>
        <View style={styles.logoContainer}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>OSTİM</Text>
          </View>
          <Text style={styles.title}>Öğrenci Portalı</Text>
          <Text style={styles.subtitle}>OSTİM Teknik Üniversitesi OBS & LMS</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Öğrenci Numarası</Text>
          <TextInput
            style={styles.input}
            placeholder="Örn: 220000000"
            placeholderTextColor="#8e8e93"
            value={studentNo}
            onChangeText={setStudentNo}
            keyboardType="numeric"
            autoCapitalize="none"
          />

          <Text style={styles.label}>OBS Şifresi</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#8e8e93"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Giriş Yap</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            🔒 Bilgileriniz yalnızca cihazınızda saklanır ve doğrudan üniversite sunucusuna iletilir.
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e17',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#121826',
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: '#1e293b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoBadge: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 12,
  },
  logoBadgeText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
  },
  form: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#f8fafc',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#334155',
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    marginTop: 12,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 16,
  },
});
