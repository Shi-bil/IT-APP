const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const dotenv = require('dotenv');
const Parse = require('parse/node');

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// Initialize Parse
Parse.initialize(process.env.PARSE_APP_ID, process.env.PARSE_JS_KEY);
Parse.serverURL = process.env.PARSE_SERVER_URL;
Parse.masterKey = process.env.PARSE_MASTER_KEY;

// SMTP Setup
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

app.post('/send-code', async (req, res) => {
  const { email } = req.body;
  const code = generateCode();

  try {
    // Save to Back4App (Parse Class: EmailCode)
    const EmailCode = Parse.Object.extend('EmailCode');
    const emailCode = new EmailCode();
    emailCode.set('email', email);
    emailCode.set('code', code);
    emailCode.set('expiresAt', new Date(Date.now() + 10 * 60 * 1000)); // 10 min expiry
    await emailCode.save();

    // Send email
    await transporter.sendMail({
      from: `"Verification Bot" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Your Verification Code',
      text: `Your code is: ${code}`,
    });

    res.json({ success: true, message: 'Verification code sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to send code' });
  }
});

app.post('/verify-code', async (req, res) => {
  const { email, code } = req.body;
  try {
    const EmailCode = Parse.Object.extend('EmailCode');
    const query = new Parse.Query(EmailCode);
    query.equalTo('email', email);
    query.descending('createdAt');
    const emailCodeObj = await query.first();
    if (!emailCodeObj) {
      return res.status(400).json({ success: false, error: 'No code found for this email.' });
    }
    const savedCode = emailCodeObj.get('code');
    const expiresAt = emailCodeObj.get('expiresAt');
    if (!savedCode || savedCode !== code) {
      return res.status(400).json({ success: false, error: 'Invalid verification code.' });
    }
    if (!expiresAt || new Date() > expiresAt) {
      return res.status(400).json({ success: false, error: 'Verification code has expired.' });
    }
    // Optionally, you can mark the code as used or delete it here

    // Update user's emailVerified field in Parse User class
    const userQuery = new Parse.Query(Parse.User);
    userQuery.equalTo('email', email);
    const user = await userQuery.first({ useMasterKey: true });
    if (user) {
      user.set('emailVerified', true);
      await user.save(null, { useMasterKey: true });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to verify code.' });
  }
});

app.listen(5000, () => {
  console.log('Server running on http://localhost:5000');
}); 