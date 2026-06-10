import 'dotenv/config';
import connectToDatabase from '../_db.js';
import Vps from '../models/Vps.js';
import Subscription from '../models/Subscription.js';
import ObjectStorage from '../models/ObjectStorage.js';
import User from '../models/User.js';
import PushSubscription from '../models/PushSubscription.js';
import { expandDueDates, findPaymentForMonth, dubaiYMD } from '../utils/dueDates.js';
import { sendToUser } from '../notifications/_send.js';

// Vercel Cron jobs call with GET and a secret header — keep the handler lean.
export default async function handler(req, res) {
  // Allow Vercel cron (no auth header) or an admin manual trigger via POST with the cron secret.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${cronSecret}`) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Unauthorized' }));
    }
  }

  await connectToDatabase();

  // Today's date in Dubai time (UTC+4, no DST).
  const now = new Date();
  const { year, month, day } = dubaiYMD(now);

  const isToday = (date) => {
    const { year: y, month: m, day: d } = dubaiYMD(date);
    return y === year && m === month && d === day;
  };

  const currentYear = year;

  // Collect all unpaid items due today across all three item types.
  const [vpsList, subsList, storageList] = await Promise.all([
    Vps.find({ nextPaymentDate: { $exists: true } }).lean(),
    Subscription.find({ nextPaymentDate: { $exists: true }, status: { $ne: 'Cancelled' } }).lean(),
    ObjectStorage.find({ nextPaymentDate: { $exists: true } }).lean(),
  ]);

  const unpaidToday = [];

  for (const [items, kind] of [[vpsList, 'VPS'], [subsList, 'Subscription'], [storageList, 'Storage']]) {
    for (const item of items) {
      const dueDates = expandDueDates(item, currentYear);
      for (const dueDate of dueDates) {
        if (!isToday(dueDate)) continue;
        const payment = findPaymentForMonth(item, dueDate);
        if (!payment) {
          unpaidToday.push({ name: item.name, kind, monthlyCost: item.monthlyCost, currency: item.currency || 'USD' });
        }
      }
    }
  }

  if (unpaidToday.length === 0) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, message: 'No unpaid payments today.', sent: 0 }));
  }

  // Build notification content.
  const names = unpaidToday.map((i) => i.name).join(', ');
  const title = `${unpaidToday.length} unpaid payment${unpaidToday.length > 1 ? 's' : ''} due today`;
  const body = unpaidToday.length === 1
    ? `${unpaidToday[0].name} is due today and hasn't been marked as paid.`
    : `${names} — mark them as paid before end of day.`;

  // Send to all admin users who have push subscriptions.
  const adminUsers = await User.find({ role: 'admin', isActive: true }).select('_id').lean();
  const adminIds = adminUsers.map((u) => u._id.toString());

  // Only notify admins who actually have a push subscription registered.
  const activeSubs = await PushSubscription.find({ userId: { $in: adminIds } }).distinct('userId');
  const targetIds = activeSubs.map((id) => id.toString());

  let totalSent = 0;
  await Promise.all(
    targetIds.map(async (userId) => {
      const result = await sendToUser(userId, {
        title,
        body,
        url: '/payments',
        tag: 'payment-reminder',
        icon: '/icon-192.png',
      });
      totalSent += result.sent || 0;
    })
  );

  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({
    success: true,
    unpaidCount: unpaidToday.length,
    notifiedAdmins: targetIds.length,
    pushSent: totalSent,
    items: unpaidToday.map((i) => i.name),
  }));
}
