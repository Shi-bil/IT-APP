import 'dotenv/config';
import bcrypt from 'bcryptjs';
import connectToDatabase from '../_db.js';
import User from '../models/User.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res
      .writeHead(405, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ error: 'Method Not Allowed' }));
  }

  try {
    const { fullname, email, password, department, phone } = req.body || {};
    if (!email || !password) {
      return res
        .writeHead(400, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'Email and password are required' }));
    }

    await connectToDatabase();

    const existing = await User.findOne({ email });
    if (existing) {
      return res
        .writeHead(409, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'Email already registered' }));
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const username = email;

    const user = await User.create({
      email,
      username,
      passwordHash,
      fullname: fullname || '',
      department: department || '',
      phone: phone || '',
      role: 'employee',
      emailVerified: false,
      isActive: true,
    });

    return res
      .writeHead(201, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ success: true, userId: user._id.toString() }));
  } catch (err) {
    console.error(err);
    return res
      .writeHead(500, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ error: 'Internal server error' }));
  }
}


