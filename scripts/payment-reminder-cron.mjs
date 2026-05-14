#!/usr/bin/env node
// Long-running PM2 worker. Fires daily at 10:30 Asia/Dubai and pushes a
// summary notification to every admin who has notificationsEnabled=true,
// listing payments due tomorrow that aren't yet marked paid.

import 'dotenv/config';
import cron from 'node-cron';
import connectToDatabase from '../api/_db.js';
import User from '../api/models/User.js';
import Vps from '../api/models/Vps.js';
import Subscription from '../api/models/Subscription.js';
import ObjectStorage from '../api/models/ObjectStorage.js';
import { expandDueDates, findPaymentForMonth, dubaiYMD } from '../api/utils/dueDates.js';
import { sendToUser } from '../api/notifications/_send.js';

const KIND_LABEL = {
  vps: 'VPS',
  subscription: 'Subscription',
  storage: 'Object storage',
};

const KIND_ROUTE = {
  vps: '/vps',
  subscription: '/subscriptions',
  storage: '/object-storage',
};

function formatCurrency(value, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(value) || 0);
  } catch {
    return `${currency} ${Number(value) || 0}`;
  }
}

function tomorrowDubai() {
  const now = new Date();
  const today = dubaiYMD(now);
  // Construct UTC midnight for today-in-Dubai, add a day, read back as Dubai Y/M/D.
  const utcTodayMs = Date.UTC(today.year, today.month, today.day);
  const tomorrowMs = utcTodayMs + 24 * 60 * 60 * 1000;
  const t = new Date(tomorrowMs);
  return {
    year: t.getUTCFullYear(),
    month: t.getUTCMonth(),
    day: t.getUTCDate(),
  };
}

async function gatherDueTomorrow() {
  const target = tomorrowDubai();
  const [vpsList, subs, storage] = await Promise.all([
    Vps.find({}).lean(),
    Subscription.find({}).lean(),
    ObjectStorage.find({}).lean(),
  ]);
  const buckets = [
    { kind: 'vps', items: vpsList },
    { kind: 'subscription', items: subs },
    { kind: 'storage', items: storage },
  ];
  const matches = [];
  for (const { kind, items } of buckets) {
    for (const item of items) {
      const dueDates = expandDueDates(item, target.year);
      for (const due of dueDates) {
        if (
          due.getFullYear() === target.year
          && due.getMonth() === target.month
          && due.getDate() === target.day
        ) {
          if (!findPaymentForMonth(item, due)) {
            matches.push({ kind, item, dueDate: due });
          }
          break;
        }
      }
    }
  }
  return { target, matches };
}

const MAX_LINES = 8;

// Sum amounts per currency so we can render an accurate "Total" line even
// when items mix USD / EUR / AED.
function totalsByCurrency(matches) {
  const totals = {};
  for (const m of matches) {
    const cur = m.item.currency || 'USD';
    totals[cur] = (totals[cur] || 0) + (Number(m.item.monthlyCost) || 0);
  }
  return Object.entries(totals)
    .map(([cur, amt]) => formatCurrency(amt, cur))
    .join(' + ');
}

function buildPayload(matches, target) {
  const dateStr = new Date(target.year, target.month, target.day)
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const totalStr = totalsByCurrency(matches);

  const lines = matches.slice(0, MAX_LINES).map((m) => (
    `• ${KIND_LABEL[m.kind] || 'Payment'}: ${m.item.name} — ${formatCurrency(m.item.monthlyCost, m.item.currency)}`
  ));
  if (matches.length > MAX_LINES) {
    lines.push(`+ ${matches.length - MAX_LINES} more`);
  }

  if (matches.length === 1) {
    const { kind } = matches[0];
    return {
      title: `Payment due tomorrow (${dateStr})`,
      body: lines.join('\n'),
      url: KIND_ROUTE[kind] || '/',
      tag: 'payment-reminder',
    };
  }

  return {
    title: `${matches.length} payments due tomorrow — ${totalStr}`,
    body: lines.join('\n'),
    url: '/payments',
    tag: 'payment-reminder',
  };
}

export async function runReminderJob() {
  await connectToDatabase();
  const { target, matches } = await gatherDueTomorrow();
  if (!matches.length) {
    console.log(`[reminder] ${new Date().toISOString()} — no payments due ${target.year}-${target.month + 1}-${target.day}`);
    return;
  }
  const admins = await User.find({
    role: 'admin',
    isActive: true,
    notificationsEnabled: true,
  }).select('_id');
  if (!admins.length) {
    console.log('[reminder] no admin recipients with notifications enabled');
    return;
  }
  const payload = buildPayload(matches, target);
  let totalSent = 0;
  for (const admin of admins) {
    const r = await sendToUser(admin._id, payload);
    totalSent += r.sent;
  }
  console.log(`[reminder] sent ${totalSent} notifications for ${matches.length} payments to ${admins.length} admins`);
}

const SCHEDULE = process.env.PAYMENT_REMINDER_CRON || '30 10 * * *';
const TZ = process.env.PAYMENT_REMINDER_TZ || 'Asia/Dubai';

console.log(`[reminder] worker started — schedule "${SCHEDULE}" tz=${TZ}`);
cron.schedule(SCHEDULE, async () => {
  try {
    await runReminderJob();
  } catch (err) {
    console.error('[reminder] job failed', err);
  }
}, { timezone: TZ });

// Allow manual one-shot run via `node scripts/payment-reminder-cron.mjs --run-now`.
if (process.argv.includes('--run-now')) {
  runReminderJob()
    .then(() => process.exit(0))
    .catch((err) => { console.error(err); process.exit(1); });
}
