import 'dotenv/config';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import connectToDatabase from '../_db.js';
import User from '../models/User.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res
      .writeHead(405, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ error: 'Method Not Allowed' }));
  }

  try {
    const { identifier, email, password, roleHint } = req.body || {};
    const loginId = identifier || email;
    if (!loginId || !password) {
      return res
        .writeHead(400, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'Identifier and password are required' }));
    }

    await connectToDatabase();

    const user = await User.findOne({
      $or: [{ email: loginId }, { username: loginId }],
    });
    if (!user) {
      return res
        .writeHead(401, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'Invalid credentials' }));
    }

    if (!user.isActive) {
      return res
        .writeHead(403, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'Account is disabled' }));
    }

    // Check if email is verified
    if (!user.emailVerified) {
      return res
        .writeHead(403, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'Email not verified. Please verify your email before logging in.' }));
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res
        .writeHead(401, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'Invalid credentials' }));
    }

    if (roleHint && roleHint === 'admin' && user.role !== 'admin') {
      return res
        .writeHead(403, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'Access denied. Admin role required.' }));
    }

    const token = jwt.sign(
      {
        sub: user._id.toString(),
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '7d' }
    );

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    return res
      .writeHead(200, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({
        success: true,
        token,
        user: {
          id: user._id.toString(),
          email: user.email,
          username: user.username,
          fullname: user.fullname,
          role: user.role,
          department: user.department,
          phone: user.phone,
          emailVerified: user.emailVerified,
        }
      }));
  } catch (err) {
    console.error(err);
    return res
      .writeHead(500, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ error: 'Internal server error' }));
  }
}


