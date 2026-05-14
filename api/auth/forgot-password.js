import 'dotenv/config';
import nodemailer from 'nodemailer';
import connectToDatabase from '../_db.js';
import User from '../models/User.js';
import PasswordResetToken from '../models/PasswordResetToken.js';

const smtpPort = Number(process.env.SMTP_PORT || 587);
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587 || smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res
      .writeHead(405, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ error: 'Method Not Allowed' }));
  }

  try {
    const { identifier } = req.body || {};
    
    // Validate input
    if (!identifier) {
      return res
        .writeHead(400, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'Email or username is required' }));
    }

    await connectToDatabase();

    // Find user by email or username
    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { username: identifier }
      ]
    });

    // Security: Don't reveal if user exists or not
    // Always return success message to prevent user enumeration
    if (!user) {
      console.log(`Password reset requested for non-existent user: ${identifier}`);
      return res
        .writeHead(200, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ 
          success: true, 
          message: 'If an account with that email/username exists, a password reset code has been sent.' 
        }));
    }

    // Check if user account is active
    if (!user.isActive) {
      console.log(`Password reset requested for inactive user: ${identifier}`);
      return res
        .writeHead(200, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ 
          success: true, 
          message: 'If an account with that email/username exists, a password reset code has been sent.' 
        }));
    }

    // Invalidate any existing reset tokens for this user
    await PasswordResetToken.updateMany(
      { userId: user._id, usedAt: null },
      { $set: { usedAt: new Date() } }
    );

    // Generate new token and code
    const token = PasswordResetToken.generateToken();
    const code = PasswordResetToken.generateCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Save reset token to database
    await PasswordResetToken.create({
      userId: user._id,
      email: user.email,
      token,
      code,
      expiresAt,
    });

    // Send password reset email
    try {
      await transporter.sendMail({
        from: `"Zainlee Technologies" <${process.env.SMTP_USER}>`,
        to: user.email,
        subject: 'Password Reset Request - IT Inventory Management System',
        text: `Dear ${user.fullname || user.username},

You have requested to reset your password for your IT Inventory Management System account.

Please use the code below to reset your password:

========================================
        PASSWORD RESET CODE
            
              ${code}
              
========================================

This code is valid for 15 minutes. If you did not request this password reset, please ignore this email or contact our support team immediately.

For security reasons:
- Never share this code with anyone
- Our team will never ask for your password or this code

Thank you for using Zainlee Technologies services.

Best regards,
Zainlee Technologies Team
IT Inventory Management System

---
This is an automated message. Please do not reply to this email.
© ${new Date().getFullYear()} Zainlee Technologies. All rights reserved.`,
      });
    } catch (mailErr) {
      console.error('SMTP sendMail failed for password reset:', mailErr?.message || mailErr);
      // In development, return the code for testing
      if (process.env.NODE_ENV === 'development') {
        return res
          .writeHead(200, { 'Content-Type': 'application/json' })
          .end(JSON.stringify({ 
            success: true, 
            message: 'Email delivery failed; using fallback code (dev mode)',
            code, // Only in development!
            token // Only in development!
          }));
      }
      return res
        .writeHead(500, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'Failed to send password reset email. Please try again later.' }));
    }

    return res
      .writeHead(200, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ 
        success: true, 
        message: 'If an account with that email/username exists, a password reset code has been sent.',
        email: user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') // Partially masked email
      }));

  } catch (err) {
    console.error('Forgot password error:', err?.message || err);
    return res
      .writeHead(500, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ error: 'Internal server error' }));
  }
}


