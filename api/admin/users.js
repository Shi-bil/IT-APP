import 'dotenv/config';
import connectToDatabase from '../_db.js';
import { requireAuth } from '../_auth.js';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  const auth = requireAuth(req, res, ['admin']);
  if (!auth) return;
  await connectToDatabase();

  if (req.method === 'GET') {
    const users = await User.find({}).sort({ createdAt: -1 });
    // Convert to JSON to apply virtuals and transformations
    const usersData = users.map(u => u.toJSON());
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, users: usersData }));
  }

  if (req.method === 'POST') {
    try {
      const { email, fullname, department, phone, role = 'employee', password } = req.body || {};
      if (!email) throw new Error('email required');
      const existing = await User.findOne({ email });
      if (existing) throw new Error('email already exists');
      const passwordHash = password ? await bcrypt.hash(password, 12) : await bcrypt.hash('Temp#12345', 12);
      const created = await User.create({
        email,
        username: email,
        passwordHash,
        fullname: fullname || '',
        department: department || '',
        phone: phone || '',
        role,
        emailVerified: false,
        isActive: true,
      });
      res.writeHead(201, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, user: created.toJSON() }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

  if (req.method === 'PUT') {
    try {
      const { id, ...changes } = req.body || {};
      if (!id) throw new Error('id required');
      
      // Check if this is a demotion (admin -> non-admin)
      const existingUser = await User.findById(id);
      if (!existingUser) throw new Error('User not found');
      
      const wasDemoted = existingUser.role === 'admin' && changes.role && changes.role !== 'admin';
      
      const allowed = ['fullname', 'department', 'phone', 'email', 'role', 'isActive', 'emailVerified', 'username'];
      const update = {};
      for (const k of allowed) if (changes[k] !== undefined) update[k] = changes[k];
      
      // If user was demoted from admin, invalidate their session
      if (wasDemoted) {
        update.sessionInvalidatedAt = new Date();
      }
      
      const updated = await User.findByIdAndUpdate(id, update, { new: true });
      if (!updated) throw new Error('User not found');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, user: updated.toJSON(), wasDemoted }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

  if (req.method === 'DELETE') {
    try {
      console.log('DELETE request body:', req.body);
      const { id } = req.body || {};
      if (!id) {
        console.log('DELETE error: id required, body was:', req.body);
        throw new Error('id required');
      }
      const deleted = await User.findByIdAndDelete(id);
      if (!deleted) {
        console.log('DELETE error: user not found with id:', id);
        throw new Error('User not found');
      }
      console.log('User deleted successfully:', id);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true }));
    } catch (e) {
      console.error('DELETE user error:', e.message);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

  res.writeHead(405, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Method Not Allowed' }));
}


