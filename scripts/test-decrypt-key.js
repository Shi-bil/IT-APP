import 'dotenv/config';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Credential from '../api/models/Credential.js';

const ALGORITHM = 'aes-256-gcm';

function deriveKey(rawKey) {
  return crypto.scryptSync(rawKey, 'credential-salt', 32);
}

function deriveDefaultKey() {
  return crypto.scryptSync('default-credential-key-change-in-production', 'salt', 32);
}

function tryDecrypt(ciphertext, key) {
  if (!ciphertext || !ciphertext.includes(':')) return { ok: false, reason: 'not-encrypted-format' };
  const parts = ciphertext.split(':');
  if (parts.length !== 3) return { ok: false, reason: 'wrong-part-count' };
  try {
    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(parts[2], 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return { ok: true, length: decrypted.length };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }
  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB || undefined });

  const total = await Credential.countDocuments();
  const sample = await Credential.find().limit(5).select('_id name password').lean();

  console.log(`Total credentials in DB: ${total}`);
  console.log(`Testing against ${sample.length} sample record(s)\n`);

  const currentKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
  const keysToTry = [];
  if (currentKey) keysToTry.push({ label: 'current .env CREDENTIAL_ENCRYPTION_KEY', key: deriveKey(currentKey) });
  keysToTry.push({ label: 'hardcoded default fallback', key: deriveDefaultKey() });

  for (const rec of sample) {
    console.log(`--- credential id=${rec._id} name="${rec.name}" ---`);
    if (!rec.password) {
      console.log('  (no password stored)');
      continue;
    }
    const partsCount = (rec.password.match(/:/g) || []).length + 1;
    console.log(`  ciphertext format: ${partsCount} colon-separated parts, length ${rec.password.length}`);
    for (const { label, key } of keysToTry) {
      const result = tryDecrypt(rec.password, key);
      if (result.ok) {
        console.log(`  ✓ DECRYPTS with: ${label}  (plaintext length=${result.length})`);
      } else {
        console.log(`  ✗ fails with: ${label}  (${result.reason})`);
      }
    }
  }

  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
