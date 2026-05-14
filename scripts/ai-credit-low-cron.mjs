#!/usr/bin/env node
// Long-running PM2 worker. Periodically refreshes live AI account balances
// and pushes a notification to every admin with notificationsEnabled=true
// whenever an account's remaining credit drops below 10% of total funded.
//
// To avoid spam, each account is notified only once per cross-below event;
// the flag clears as soon as the balance climbs back to >=10%.

import 'dotenv/config';
import cron from 'node-cron';
import connectToDatabase from '../api/_db.js';
import AiAccount from '../api/models/AiAccount.js';
import User from '../api/models/User.js';
import { decrypt } from '../api/utils/encryption.js';
import { fetchProviderCost } from '../api/utils/aiProviders.js';
import { sendToUser } from '../api/notifications/_send.js';

const THRESHOLD = 0.10;

const PROVIDER_LABEL = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
};

function formatUsd(value) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value) || 0);
  } catch {
    return `$${(Number(value) || 0).toFixed(2)}`;
  }
}

function sumTopups(topups = []) {
  return topups.reduce((sum, t) => sum + (Number(t?.amount) || 0), 0);
}

async function refreshAccount(account) {
  if (!account.adminKey) return;
  try {
    const adminKey = decrypt(account.adminKey);
    if (!adminKey) throw new Error('Stored admin key could not be decrypted');
    const startDate = account.startingBalanceDate || account.createdAt || new Date(0);
    const { totalUsd } = await fetchProviderCost(account.provider, adminKey, startDate);
    account.cachedCostUsd = totalUsd;
    account.lastSyncedAt = new Date();
    account.lastError = '';
  } catch (err) {
    account.lastError = err.message || String(err);
    account.lastSyncedAt = new Date();
  }
}

export async function runLowBalanceCheck() {
  await connectToDatabase();
  const accounts = await AiAccount.find({});
  if (!accounts.length) {
    console.log('[ai-credit-low] no AI accounts configured');
    return;
  }

  const admins = await User.find({
    role: 'admin',
    isActive: true,
    notificationsEnabled: true,
  }).select('_id');

  const triggered = [];
  for (const account of accounts) {
    await refreshAccount(account);
    const total = (Number(account.startingBalance) || 0) + sumTopups(account.topups);
    const remaining = Math.max(0, total - (Number(account.cachedCostUsd) || 0));
    const ratio = total > 0 ? remaining / total : 1;

    if (ratio < THRESHOLD) {
      if (!account.lowBalanceNotifiedAt) {
        triggered.push({ account, total, remaining, ratio });
        account.lowBalanceNotifiedAt = new Date();
      }
    } else if (account.lowBalanceNotifiedAt) {
      account.lowBalanceNotifiedAt = null;
    }
    await account.save();
  }

  if (!triggered.length) {
    console.log(`[ai-credit-low] checked ${accounts.length} accounts — none below ${Math.round(THRESHOLD * 100)}%`);
    return;
  }

  if (!admins.length) {
    console.log(`[ai-credit-low] ${triggered.length} accounts low but no admin recipients with notifications enabled`);
    return;
  }

  let totalSent = 0;
  for (const { account, total, remaining, ratio } of triggered) {
    const providerLabel = PROVIDER_LABEL[account.provider] || account.provider;
    const pct = Math.round(ratio * 100);
    const payload = {
      title: `Low AI credit: ${account.label} (${pct}% left)`,
      body: `${providerLabel} — ${formatUsd(remaining)} remaining of ${formatUsd(total)}.`,
      url: '/ai-credits',
      tag: `ai-credit-low-${account._id}`,
    };
    for (const admin of admins) {
      const r = await sendToUser(admin._id, payload);
      totalSent += r.sent;
    }
  }
  console.log(`[ai-credit-low] sent ${totalSent} notifications for ${triggered.length} low accounts to ${admins.length} admins`);
}

const SCHEDULE = process.env.AI_CREDIT_LOW_CRON || '*/30 * * * *';
const TZ = process.env.AI_CREDIT_LOW_TZ || 'Asia/Dubai';

console.log(`[ai-credit-low] worker started — schedule "${SCHEDULE}" tz=${TZ}`);
cron.schedule(SCHEDULE, async () => {
  try {
    await runLowBalanceCheck();
  } catch (err) {
    console.error('[ai-credit-low] job failed', err);
  }
}, { timezone: TZ });

if (process.argv.includes('--run-now')) {
  runLowBalanceCheck()
    .then(() => process.exit(0))
    .catch((err) => { console.error(err); process.exit(1); });
}
