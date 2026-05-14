import 'dotenv/config';
import connectToDatabase from '../_db.js';
import { requireAuth } from '../_auth.js';
import AssetHistory from '../models/AssetHistory.js';
import User from '../models/User.js';

export default async function handler(req, res) {
  const auth = requireAuth(req, res, []); // both roles can view
  if (!auth) return;
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
  }
  await connectToDatabase();
  try {
    const assetId = req.query?.assetId;
    if (!assetId) throw new Error('assetId required');
    const records = await AssetHistory.find({ assetId }).sort({ createdAt: -1 }).lean();
    // enrich with minimal user info
    const userIds = new Set();
    for (const r of records) {
      if (r.previousUserId) userIds.add(String(r.previousUserId));
      if (r.assignedToUserId) userIds.add(String(r.assignedToUserId));
      if (r.assignedByUserId) userIds.add(String(r.assignedByUserId));
    }
    const users = await User.find({ _id: { $in: Array.from(userIds) } }).lean();
    const userMap = new Map(users.map(u => [String(u._id), u]));
    const mapped = records.map(r => ({
      id: String(r._id),
      type: r.type,
      previousStatus: r.previousStatus || null,
      newStatus: r.newStatus || null,
      previousUser: r.previousUserId ? { id: String(r.previousUserId), fullname: userMap.get(String(r.previousUserId))?.fullname || '' } : null,
      assignedTo: r.assignedToUserId ? { id: String(r.assignedToUserId), fullname: userMap.get(String(r.assignedToUserId))?.fullname || '' } : null,
      assignedBy: r.assignedByUserId ? { id: String(r.assignedByUserId), fullname: userMap.get(String(r.assignedByUserId))?.fullname || '' } : null,
      handoverDate: r.handoverDate,
      unassignedDate: r.unassignedDate,
      createdAt: r.createdAt,
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, history: mapped }));
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: e.message }));
  }
}


