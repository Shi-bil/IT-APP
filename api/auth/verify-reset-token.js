import 'dotenv/config';
import connectToDatabase from '../_db.js';
import User from '../models/User.js';
import PasswordResetToken from '../models/PasswordResetToken.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res
      .writeHead(405, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ error: 'Method Not Allowed' }));
  }

  try {
    const { identifier, code } = req.body || {};

    // Validate input
    if (!identifier || !code) {
      return res
        .writeHead(400, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'Email/username and verification code are required' }));
    }

    await connectToDatabase();

    // Find user by email or username
    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { username: identifier }
      ]
    });

    if (!user) {
      return res
        .writeHead(400, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'Invalid verification code or expired.' }));
    }

    // Find the most recent unused reset token for this user
    const resetToken = await PasswordResetToken.findOne({
      userId: user._id,
      code: code,
      usedAt: null,
    }).sort({ createdAt: -1 });

    if (!resetToken) {
      return res
        .writeHead(400, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'Invalid verification code or expired.' }));
    }

    // Check if token has expired
    if (new Date() > resetToken.expiresAt) {
      return res
        .writeHead(400, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'Verification code has expired. Please request a new one.' }));
    }

    // Token is valid - return the token for password reset
    return res
      .writeHead(200, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ 
        success: true, 
        message: 'Code verified successfully.',
        resetToken: resetToken.token, // This token will be used for the actual password reset
        email: user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3')
      }));

  } catch (err) {
    console.error('Verify reset token error:', err?.message || err);
    return res
      .writeHead(500, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ error: 'Internal server error' }));
  }
}


