import webpush from 'web-push';
import PushSubscription from '../models/PushSubscription.js';
import User from '../models/User.js';

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(
    VAPID_SUBJECT || 'mailto:admin@example.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
  configured = true;
  return true;
}

// Send a single push payload to all subscriptions for a user. Returns counts.
// Removes subscriptions that respond 404/410 (gone).
//
// `category` controls who receives the push:
//   - 'projects'  → delivered to admins AND non-admins (DevKitchen activity)
//   - anything else (or unset) → delivered to admins ONLY
//     (non-admins are intentionally muted for tickets/payments/etc. for now)
export async function sendToUser(userId, payload, { category } = {}) {
  if (!ensureConfigured()) {
    console.warn('[push] VAPID keys not configured, skipping send');
    return { sent: 0, removed: 0, failed: 0 };
  }

  if (category !== 'projects') {
    // Non-project pushes only go to admins for now.
    const recipient = await User.findById(userId).select('role').lean();
    if (!recipient || recipient.role !== 'admin') {
      return { sent: 0, removed: 0, failed: 0, skipped: 'non-admin-non-project' };
    }
  }

  const subs = await PushSubscription.find({ userId });
  let sent = 0;
  let removed = 0;
  let failed = 0;
  const body = JSON.stringify(payload);
  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        body
      );
      sub.lastSentAt = new Date();
      await sub.save();
      sent += 1;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await PushSubscription.deleteOne({ _id: sub._id });
        removed += 1;
      } else {
        console.error('[push] send failed', err.statusCode, err.body || err.message);
        failed += 1;
      }
    }
  }));
  return { sent, removed, failed };
}
