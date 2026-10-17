import fs from 'fs';
import path from 'path';
import { encryptAppConfig, AppRuntimeConfig } from '../src/crypto/configCrypto';

// Read .env manually to avoid external dotenv dependencies during CLI tool runs
function loadEnv(): Record<string, string> {
  const envPath = path.resolve(__dirname, '../.env');
  if (!fs.existsSync(envPath)) {
    throw new Error('.env file not found. Create .env before generating config.enc.');
  }
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  const env: Record<string, string> = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const k = trimmed.slice(0, idx).trim();
        const v = trimmed.slice(idx + 1).trim();
        env[k] = v;
      }
    }
  }
  return env;
}

function main() {
  const env = loadEnv();
  const masterKey = env.EXPO_PUBLIC_APP_CONFIG_KEY;
  if (!masterKey) {
    throw new Error('EXPO_PUBLIC_APP_CONFIG_KEY must be defined in .env');
  }

  const runtimeConfig: AppRuntimeConfig = {
    version: 1,
    updatedAt: new Date().toISOString(),
    obs: {
      baseUrl: env.EXPO_PUBLIC_OBS_BASE_URL || 'https://obs.ostimteknik.edu.tr/ProlizMobileAPI_V4/api',
      aesKey: env.EXPO_PUBLIC_OBS_AES_KEY || '',
      uniCode: env.EXPO_PUBLIC_OBS_UNI_CODE || 'OST',
      secret: env.EXPO_PUBLIC_OBS_SECRET || '',
      uniToken: env.EXPO_PUBLIC_OBS_UNI_TOKEN || '',
    },
    lms: {
      tokenUrl: env.EXPO_PUBLIC_LMS_TOKEN_URL || 'https://lmsclus.ostimteknik.edu.tr/login/token.php',
      serviceUrl: env.EXPO_PUBLIC_LMS_SERVICE_URL || 'https://lmsclus.ostimteknik.edu.tr/webservice/rest/server.php',
    },
  };

  const encrypted = encryptAppConfig(runtimeConfig, masterKey);
  const outPath = path.resolve(__dirname, '../config.enc');
  fs.writeFileSync(outPath, JSON.stringify(encrypted, null, 2), 'utf-8');

  console.log('✅ Successfully generated encrypted config at config.enc');
  console.log(`   Config version: ${encrypted.version}`);
  console.log(`   Ciphertext length: ${encrypted.cipher.length} chars`);
}

main();
