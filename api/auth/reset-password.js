import 'dotenv/config';
import bcrypt from 'bcryptjs';
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
    const { resetToken, newPassword, confirmPassword } = req.body || {};

    // Validate input
    if (!resetToken) {
      return res
        .writeHead(400, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'Reset token is required' }));
    }

    if (!newPassword) {
      return res
        .writeHead(400, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'New password is required' }));
    }

    if (newPassword !== confirmPassword) {
      return res
        .writeHead(400, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'Passwords do not match' }));
    }

    // Password strength validation
    if (newPassword.length < 8) {
      return res
        .writeHead(400, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'Password must be at least 8 characters long' }));
    }

    // Check for at least one uppercase, one lowercase, and one number
    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    
    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      return res
        .writeHead(400, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ 
          error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' 
        }));
    }

    await connectToDatabase();

    // Find the reset token
    const tokenDoc = await PasswordResetToken.findOne({
      token: resetToken,
      usedAt: null,
    });

    if (!tokenDoc) {
      return res
        .writeHead(400, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'Invalid or expired reset token. Please request a new password reset.' }));
    }

    // Check if token has expired
    if (new Date() > tokenDoc.expiresAt) {
      return res
        .writeHead(400, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'Reset token has expired. Please request a new password reset.' }));
    }

    // Find the user
    const user = await User.findById(tokenDoc.userId);

    if (!user) {
      return res
        .writeHead(400, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'User not found' }));
    }

    if (!user.isActive) {
      return res
        .writeHead(403, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'Account is disabled. Please contact support.' }));
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update user's password
    user.passwordHash = passwordHash;
    user.sessionInvalidatedAt = new Date(); // Invalidate all existing sessions
    await user.save();

    // Mark the reset token as used
    tokenDoc.usedAt = new Date();
    await tokenDoc.save();

    // Invalidate any other pending reset tokens for this user
    await PasswordResetToken.updateMany(
      { userId: user._id, usedAt: null },
      { $set: { usedAt: new Date() } }
    );

    return res
      .writeHead(200, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ 
        success: true, 
        message: 'Password has been reset successfully. You can now log in with your new password.' 
      }));

  } catch (err) {
    console.error('Reset password error:', err?.message || err);
    return res
      .writeHead(500, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ error: 'Internal server error' }));
  }
}


