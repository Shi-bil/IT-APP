import 'dotenv/config';
import jwt from 'jsonwebtoken';
import connectToDatabase from '../_db.js';
import User from '../models/User.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res
      .writeHead(405, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ error: 'Method Not Allowed' }));
  }

  try {
    const authHeader = req.headers?.authorization || req.headers?.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res
        .writeHead(401, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ valid: false, error: 'No token provided' }));
    }

    const token = authHeader.slice(7);
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    } catch {
      return res
        .writeHead(401, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ valid: false, error: 'Invalid token' }));
    }

    await connectToDatabase();

    const user = await User.findById(payload.sub);
    if (!user) {
      return res
        .writeHead(401, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ valid: false, error: 'User not found' }));
    }

    // Check if user's session was invalidated after the token was issued
    if (user.sessionInvalidatedAt) {
      const tokenIssuedAt = payload.iat * 1000; // JWT iat is in seconds, convert to ms
      const invalidatedAt = new Date(user.sessionInvalidatedAt).getTime();
      
      if (tokenIssuedAt < invalidatedAt) {
        return res
          .writeHead(401, { 'Content-Type': 'application/json' })
          .end(JSON.stringify({ 
            valid: false, 
            error: 'Session invalidated', 
            reason: 'demoted',
            message: 'Your admin privileges have been revoked. Please log in again.'
          }));
      }
    }

    // Check if user is still active
    if (!user.isActive) {
      return res
        .writeHead(401, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ valid: false, error: 'Account disabled' }));
    }

    // Check if role has changed
    if (user.role !== payload.role) {
      return res
        .writeHead(200, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ 
          valid: true, 
          roleChanged: true, 
          newRole: user.role,
          message: 'Your role has been updated. Please log in again for the changes to take effect.'
        }));
    }

    return res
      .writeHead(200, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ valid: true }));

  } catch (err) {
    console.error('Session validation error:', err);
    return res
      .writeHead(500, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ valid: false, error: 'Internal server error' }));
  }
}

