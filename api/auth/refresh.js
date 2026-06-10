import 'dotenv/config';
import jwt from 'jsonwebtoken';
import connectToDatabase from '../_db.js';
import User from '../models/User.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') {
    res.writeHead(405);
    return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
  }

  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.writeHead(401);
    return res.end(JSON.stringify({ error: 'No token provided' }));
  }

  const token = authHeader.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
  } catch {
    res.writeHead(401);
    return res.end(JSON.stringify({ error: 'Invalid or expired token' }));
  }

  await connectToDatabase();
  const user = await User.findById(payload.sub)
    .select('role isActive sessionInvalidatedAt email username')
    .lean();

  if (!user || !user.isActive) {
    res.writeHead(401);
    return res.end(JSON.stringify({ error: 'Account not found or disabled' }));
  }

  // Refuse refresh if the session was explicitly invalidated (e.g. admin demoted).
  if (user.sessionInvalidatedAt) {
    const tokenIssuedAt = payload.iat * 1000;
    if (tokenIssuedAt < new Date(user.sessionInvalidatedAt).getTime()) {
      res.writeHead(401);
      return res.end(JSON.stringify({ error: 'Session invalidated', reason: 'demoted' }));
    }
  }

  // Issue a fresh 30-day token with the current role.
  const newToken = jwt.sign(
    { sub: String(user._id), email: user.email, role: user.role },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '30d' }
  );

  res.writeHead(200);
  return res.end(JSON.stringify({ success: true, token: newToken, role: user.role }));
}
