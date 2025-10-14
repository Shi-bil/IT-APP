import 'dotenv/config';
import nodemailer from 'nodemailer';
import Parse from 'parse/node.js';

Parse.initialize(process.env.PARSE_APP_ID, process.env.PARSE_JS_KEY);
Parse.serverURL = process.env.PARSE_SERVER_URL;
Parse.masterKey = process.env.PARSE_MASTER_KEY;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.writeHead(405, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Method Not Allowed' }));

  const { email } = req.body || {};
  const code = generateCode();

  try {
    const EmailCode = Parse.Object.extend('EmailCode');
    const emailCode = new EmailCode();
    emailCode.set('email', email);
    emailCode.set('code', code);
    emailCode.set('expiresAt', new Date(Date.now() + 10 * 60 * 1000));
    await emailCode.save();

    await transporter.sendMail({
      from: `"Verification Bot" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Your Verification Code',
      text: `Your code is: ${code}`,
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Verification code sent' }));
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Failed to send code' }));
  }
}


