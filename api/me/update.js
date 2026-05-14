import 'dotenv/config';
import connectToDatabase from '../_db.js';
import { requireAuth } from '../_auth.js';
import User from '../models/User.js';

export default async function handler(req, res) {
  const auth = requireAuth(req, res, []);
  if (!auth) return;
  if (req.method !== 'PUT' && req.method !== 'PATCH') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
  }
  await connectToDatabase();
  try {
    const { fullname, email, department, phone } = req.body || {};
    const update = {};
    if (fullname !== undefined) update.fullname = fullname;
    if (email !== undefined) update.email = email;
    if (department !== undefined) update.department = department;
    if (phone !== undefined) update.phone = phone;
    await User.findByIdAndUpdate(auth.sub, update, { new: true });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true }));
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: e.message }));
  }
}


