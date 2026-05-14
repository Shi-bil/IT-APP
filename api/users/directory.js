import 'dotenv/config';
import connectToDatabase from '../_db.js';
import { requireAuth } from '../_auth.js';
import User from '../models/User.js';

// Lightweight user directory for member-pickers (e.g. project members,
// task assignees). Any authenticated user can read it. Returns only the
// minimal fields needed to render avatars and labels — no role, phone,
// emailVerified, etc.
export default async function handler(req, res) {
  const auth = requireAuth(req, res, []);
  if (!auth) return;
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
  }
  await connectToDatabase();
  const users = await User.find({ isActive: { $ne: false } })
    .select('fullname email department')
    .sort({ fullname: 1 })
    .lean();
  const data = users.map((u) => ({
    id: u._id.toString(),
    fullname: u.fullname,
    email: u.email,
    department: u.department,
    isActive: true,
  }));
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'private, max-age=30, stale-while-revalidate=300',
  });
  return res.end(JSON.stringify({ success: true, users: data }));
}
