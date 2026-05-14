import 'dotenv/config';
import connectToDatabase from '../_db.js';
import { requireAuth } from '../_auth.js';
import User from '../models/User.js';

export default async function handler(req, res) {
  const auth = requireAuth(req, res, []);
  if (!auth) return;
  await connectToDatabase();
  try {
    if (req.method === 'GET') {
      const user = await User.findById(auth.sub).select('notificationsEnabled');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        notificationsEnabled: Boolean(user?.notificationsEnabled),
      }));
    }
    if (req.method === 'PUT' || req.method === 'PATCH') {
      const { notificationsEnabled } = req.body || {};
      const updated = await User.findByIdAndUpdate(
        auth.sub,
        { notificationsEnabled: Boolean(notificationsEnabled) },
        { new: true }
      ).select('notificationsEnabled');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: true,
        notificationsEnabled: Boolean(updated?.notificationsEnabled),
      }));
    }
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: e.message }));
  }
}
