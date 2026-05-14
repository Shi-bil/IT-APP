import 'dotenv/config';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Credential from '../api/models/Credential.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

const OLD_KEY = crypto.scryptSync('default-credential-key-change-in-production', 'salt', 32);

function deriveNewKey() {
  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!raw) throw new Error('CREDENTIAL_ENCRYPTION_KEY is not set in .env');
  return crypto.scryptSync(raw, 'credential-salt', 32);
}

function tryDecrypt(ciphertext, key) {
  if (!ciphertext || !ciphertext.includes(':')) return null;
  const parts = ciphertext.split(':');
  if (parts.length !== 3) return null;
  try {
    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(parts[2], 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return null;
  }
}

function encryptWith(plaintext, key) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

async function main() {
  const isApply = process.argv.includes('--apply');
  const mode = isApply ? 'APPLY (will write)' : 'DRY RUN (no writes)';

  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

  const NEW_KEY = deriveNewKey();

  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB || undefined });
  console.log(`Mode: ${mode}`);
  console.log(`Connected to MongoDB\n`);

  const all = await Credential.find().select('_id name password').lean();
  console.log(`Scanning ${all.length} credential records...\n`);

  const stats = {
    empty: 0,
    alreadyNewKey: 0,
    migratable: 0,
    unrecoverable: 0,
    migrated: 0,
    failed: 0,
  };

  const unrecoverable = [];

  for (const rec of all) {
    if (!rec.password) { stats.empty++; continue; }

    if (tryDecrypt(rec.password, NEW_KEY) !== null) {
      stats.alreadyNewKey++;
      continue;
    }

    const plaintext = tryDecrypt(rec.password, OLD_KEY);
    if (plaintext === null) {
      stats.unrecoverable++;
      unrecoverable.push({ id: String(rec._id), name: rec.name });
      continue;
    }

    stats.migratable++;
    if (isApply) {
      try {
        const newCiphertext = encryptWith(plaintext, NEW_KEY);
        await Credential.updateOne({ _id: rec._id }, { $set: { password: newCiphertext, isEncrypted: true } });
        const verify = tryDecrypt(newCiphertext, NEW_KEY);
        if (verify === plaintext) {
          stats.migrated++;
        } else {
          stats.failed++;
          console.error(`  ! verification failed for ${rec._id}`);
        }
      } catch (e) {
        stats.failed++;
        console.error(`  ! error migrating ${rec._id}: ${e.message}`);
      }
    }
  }

  console.log('Summary:');
  console.log(`  total records:           ${all.length}`);
  console.log(`  empty password:          ${stats.empty}`);
  console.log(`  already on new key:      ${stats.alreadyNewKey}`);
  console.log(`  migratable (old → new):  ${stats.migratable}`);
  console.log(`  unrecoverable:           ${stats.unrecoverable}`);
  if (isApply) {
    console.log(`  migrated successfully:   ${stats.migrated}`);
    console.log(`  migration failures:      ${stats.failed}`);
  }

  if (unrecoverable.length) {
    console.log(`\nUnrecoverable records (decrypt with neither key — left untouched):`);
    for (const u of unrecoverable) console.log(`  - ${u.id}  ${u.name}`);
  }

  if (!isApply) {
    console.log(`\nThis was a DRY RUN. Re-run with --apply to perform the migration.`);
  }

  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
