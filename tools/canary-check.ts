import { decryptAppConfig, EncryptedPayload } from '../src/crypto/configCrypto';
import { OstimObsClient } from '../src/api/obsClient';
import { configManager } from '../src/config/configManager';
import fs from 'fs';
import path from 'path';

async function runCanary() {
  console.log('🦜 [CANARY BOT] Starting Proliz API Health & Schema Check...');

  const masterKey = process.env.APP_CONFIG_KEY || process.env.EXPO_PUBLIC_APP_CONFIG_KEY;
  if (!masterKey) {
    console.error('❌ Error: APP_CONFIG_KEY is missing.');
    process.exit(1);
  }

  // 1. Verify encrypted config payload integrity
  console.log('1️⃣ Checking config.enc decryption...');
  const configPath = path.resolve(__dirname, '../config.enc');
  if (!fs.existsSync(configPath)) {
    console.error('❌ Error: config.enc not found.');
    process.exit(1);
  }

  const payload: EncryptedPayload = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const config = decryptAppConfig(payload, masterKey);
  console.log(`   Config Decrypted: Version ${config.version}, Base URL: ${config.obs.baseUrl}`);

  // 2. Check Proliz API reachability
  console.log('2️⃣ Probing Proliz Base API Endpoint...');
  const res = await fetch(config.obs.baseUrl, { method: 'GET' });
  console.log(`   Base endpoint responded with HTTP ${res.status}`);

  // 3. If test credentials provided in GitHub Secrets, test authentication handshake
  const testUser = process.env.CANARY_TEST_USER;
  const testPass = process.env.CANARY_TEST_PASS;

  if (testUser && testPass) {
    console.log('3️⃣ Executing Live Authentication Handshake...');
    await configManager.initialize();
    const client = new OstimObsClient();
    try {
      const auth = await client.login(testUser, testPass);
      console.log('   ✅ Auth Successful! JWT acquired.');

      const profile = await client.getProfile();
      console.log(`   ✅ Profile fetched: ${profile.firstName} ${profile.lastName} (${profile.department})`);

      const timetable = await client.getTimetable();
      console.log(`   ✅ Timetable fetched: ${timetable.length} course periods found.`);
    } catch (err: any) {
      console.error('❌ Canary Auth Failure:', err.message);
      process.exit(1);
    }
  } else {
    console.log('ℹ️ No CANARY_TEST_USER provided. Skipping full user login check.');
  }

  console.log('🎉 [CANARY BOT] All checks passed successfully!');
}

runCanary().catch((err) => {
  console.error('❌ Canary Bot caught unhandled error:', err);
  process.exit(1);
});
