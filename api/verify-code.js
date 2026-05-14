import 'dotenv/config';
import connectToDatabase from './_db.js';
import EmailCode from './models/EmailCode.js';
import User from './models/User.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.writeHead(405, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Method Not Allowed' }));

  const { email, code } = req.body || {};
  try {
    await connectToDatabase();

    const emailCodeObj = await EmailCode.findOne({ email }).sort({ createdAt: -1 }).lean();
    if (!emailCodeObj) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'No code found for this email.' }));
    }

    const savedCode = emailCodeObj.code;
    const expiresAt = emailCodeObj.expiresAt;
    if (!savedCode || savedCode !== code) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'Invalid verification code.' }));
    }
    if (!expiresAt || new Date() > expiresAt) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'Verification code expired.' }));
    }

    // Mark user's emailVerified = true
    await User.updateOne({ email }, { $set: { emailVerified: true } });

    // Optionally mark code as used
    await EmailCode.updateOne({ _id: emailCodeObj._id }, { $set: { usedAt: new Date() } });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Failed to verify code.' }));
  }
}


