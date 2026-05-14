import 'dotenv/config';
import mongoose from 'mongoose';
import PushSubscription from '../api/models/PushSubscription.js';
import User from '../api/models/User.js';

await mongoose.connect(process.env.MONGODB_URI);

const subs = await PushSubscription.find({})
  .sort({ createdAt: -1 })
  .lean();

const userIds = [...new Set(subs.map((s) => String(s.userId)))];
const users = await User.find({ _id: { $in: userIds } })
  .select('fullname email role notificationsEnabled')
  .lean();
const byId = new Map(users.map((u) => [String(u._id), u]));

// Best-effort device label from the UA string.
const labelUA = (ua = '') => {
  const m = (re) => re.test(ua);
  let os = m(/iPhone|iPad|iOS/) ? 'iOS'
    : m(/Android/) ? 'Android'
    : m(/Windows/) ? 'Windows'
    : m(/Mac OS|Macintosh/) ? 'macOS'
    : m(/Linux/) ? 'Linux'
    : 'Unknown OS';
  let browser = m(/Edg\//) ? 'Edge'
    : m(/Chrome\//) && !m(/Edg|OPR/) ? 'Chrome'
    : m(/Firefox\//) ? 'Firefox'
    : m(/Safari\//) && !m(/Chrome|Edg|OPR/) ? 'Safari'
    : m(/OPR\//) ? 'Opera'
    : 'Unknown browser';
  return `${os} · ${browser}`;
};

console.log(`\n${subs.length} push subscription(s) across ${userIds.length} user(s):\n`);
for (const s of subs) {
  const u = byId.get(String(s.userId));
  const userLabel = u ? `${u.fullname || u.email} <${u.email}> [${u.role}]` : `(unknown user ${s.userId})`;
  console.log(`• ${userLabel}`);
  console.log(`    device:     ${labelUA(s.userAgent)}`);
  console.log(`    endpoint:   ${s.endpoint.slice(0, 64)}…`);
  console.log(`    subscribed: ${s.createdAt?.toISOString?.() || s.createdAt}`);
  console.log(`    lastSentAt: ${s.lastSentAt?.toISOString?.() || s.lastSentAt || '(never)'}`);
  if (u) console.log(`    prefs.notificationsEnabled: ${u.notificationsEnabled}`);
  console.log('');
}

await mongoose.disconnect();
