import 'dotenv/config';
import connectToDatabase from '../_db.js';
import { requireAuth } from '../_auth.js';
import Ticket from '../models/Ticket.js';

export default async function handler(req, res) {
  const auth = requireAuth(req, res, []);
  if (!auth) return;
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
  }
  await connectToDatabase();
  try {
    const isAdmin = auth.role === 'admin';
    const filter = {};
    if (!isAdmin) {
      filter.$or = [{ createdByUserId: auth.sub }, { assignedToUserId: auth.sub }];
    }

    // Single aggregation replaces 5 sequential countDocuments calls.
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [byStatus, resolvedTodayResult] = await Promise.all([
      Ticket.aggregate([
        { $match: filter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      isAdmin
        ? Ticket.countDocuments({ status: 'resolved', updatedAt: { $gte: startOfDay } })
        : Promise.resolve(0),
    ]);

    const counts = {};
    let total = 0;
    for (const row of byStatus) {
      counts[row._id] = row.count;
      total += row.count;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: true,
      stats: {
        total,
        openCount: counts['open'] || 0,
        inProgressCount: counts['in-progress'] || 0,
        resolvedCount: counts['resolved'] || 0,
        closedCount: counts['closed'] || 0,
        resolvedToday: resolvedTodayResult,
        avgResolutionTime: 24,
      },
    }));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: e.message }));
  }
}
