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
  const [showPassword, setShowPassword] = useState(false);
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
          <Text style={styles.subtitle}>OSTİM Teknik Üniversitesi Öğrenci Bilgi Sistemi</Text>
        </View>

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
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 24,
    padding: 30,
    borderWidth: 1,
    borderColor: '#1e293b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 8,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoBadge: {
    backgroundColor: '#1d4ed8',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 12,
    marginBottom: 12,
  },
  logoBadgeText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 15,
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
    textAlign: 'center',
  },
  form: {
    marginBottom: 8,
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
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#f8fafc',
  },
  eyeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  eyeBtnText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
