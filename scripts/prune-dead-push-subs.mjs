import 'dotenv/config';
import mongoose from 'mongoose';
import webpush from 'web-push';
import PushSubscription from '../api/models/PushSubscription.js';
import User from '../api/models/User.js';

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, MONGODB_URI } = process.env;
if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error('VAPID keys missing in env.');
  process.exit(1);
}
webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:admin@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const DRY_RUN = process.argv.includes('--dry-run');

await mongoose.connect(MONGODB_URI);

const subs = await PushSubscription.find({}).sort({ createdAt: -1 });
console.log(`Found ${subs.length} subscription(s). Verifying each…${DRY_RUN ? ' (dry-run, no deletes)' : ''}\n`);

const userIds = [...new Set(subs.map((s) => String(s.userId)))];
const users = await User.find({ _id: { $in: userIds } }).select('fullname email').lean();
const byUser = new Map(users.map((u) => [String(u._id), u]));

let alive = 0;
let removed = 0;
let kept = 0;

// A silent verification payload. The browser-side SW will render this only if
// the endpoint is actually delivering — which is fine for the active devices
// (it's the same kind of ping `notificationService.testPush` produces).
const payload = JSON.stringify({
  title: 'DevKitchen',
  body: 'Cleaning up old device sessions…',
  silent: true,
});

for (const sub of subs) {
  const u = byUser.get(String(sub.userId));
  const who = u ? `${u.fullname || u.email}` : `(user ${sub.userId})`;
  const tag = `${who} · ${sub.endpoint.slice(0, 48)}…`;
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
    console.log(`✓ alive   ${tag}`);
    alive += 1;
  } catch (err) {
    const code = err.statusCode;
    if (code === 404 || code === 410) {
      if (DRY_RUN) {
        console.log(`✗ dead    ${tag}  (HTTP ${code}, would delete)`);
      } else {
        await PushSubscription.deleteOne({ _id: sub._id });
        console.log(`✗ deleted ${tag}  (HTTP ${code})`);
        removed += 1;
      }
    } else {
      console.log(`? kept    ${tag}  (HTTP ${code || '?'}, not a hard-fail — leaving in place)`);
      kept += 1;
    }
  }
}

console.log(`\nDone. alive=${alive}  removed=${removed}  kept-with-soft-error=${kept}  total=${subs.length}`);
await mongoose.disconnect();
