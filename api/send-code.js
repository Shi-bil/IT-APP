import 'dotenv/config';
import nodemailer from 'nodemailer';
import connectToDatabase from './_db.js';
import EmailCode from './models/EmailCode.js';

const smtpPort = Number(process.env.SMTP_PORT || 587);
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587 || smtpPort,
  secure: smtpPort === 465, // true for SMTPS/465, false for STARTTLS/587
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

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.writeHead(405, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Method Not Allowed' }));

  const body = req.body || {};
  const { email } = body;
  if (!email) {
    console.error('send-code: missing email in body:', body);
  }
  const code = generateCode();

  try {
    await connectToDatabase();

    await EmailCode.create({
      email,
      code,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    try {
      await transporter.sendMail({
        from: `"Zainlee Technologies" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Your Verification Code - IT Inventory Management System',
        text: `Dear User,

Welcome to Zainlee IT Inventory Management System!🙏

You have requested a verification code to access your account. Please use the code below to complete your verification:

========================================
        YOUR VERIFICATION CODE
            
              ${code}
              
========================================

This code is valid for 120 seconds. If you did not request this code, please ignore this email or contact our support team immediately.

Thank you for choosing Zainlee Technologies llc.

Best regards,
Zainlee Technologies Team
IT Inventory Management System

---
This is an automated message. Please do not reply to this email.
© ${new Date().getFullYear()} Zainlee Technologies. All rights reserved.`,
      });
    } catch (mailErr) {
      // Allow fallback to avoid blocking registration when SMTP is misconfigured
      console.error('SMTP sendMail failed:', mailErr?.message || mailErr);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, message: 'Email delivery failed; using fallback code', code }));
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Verification code sent' }));
  } catch (err) {
    console.error('send-code error:', err?.message || err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: `Failed to send code: ${err?.message || 'Unknown error'}` }));
  }
}


