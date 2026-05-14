import 'dotenv/config';
import bcrypt from 'bcryptjs';
import connectToDatabase from '../_db.js';
import { requireAuth } from '../_auth.js';
import User from '../models/User.js';

export default async function handler(req, res) {
  const auth = requireAuth(req, res, []);
  if (!auth) return;
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
  }
  await connectToDatabase();
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) throw new Error('currentPassword and newPassword required');
    const user = await User.findById(auth.sub);
    if (!user) throw new Error('User not found');
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'Current password is incorrect' }));
    }
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, message: 'Password updated' }));
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: e.message }));
  }
}


