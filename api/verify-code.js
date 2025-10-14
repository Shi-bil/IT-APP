import 'dotenv/config';
import Parse from 'parse/node.js';

Parse.initialize(process.env.PARSE_APP_ID, process.env.PARSE_JS_KEY);
Parse.serverURL = process.env.PARSE_SERVER_URL;
Parse.masterKey = process.env.PARSE_MASTER_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.writeHead(405, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Method Not Allowed' }));

  const { email, code } = req.body || {};
  try {
    const EmailCode = Parse.Object.extend('EmailCode');
    const query = new Parse.Query(EmailCode);
    query.equalTo('email', email);
    query.descending('createdAt');
    const emailCodeObj = await query.first();
    if (!emailCodeObj) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'No code found for this email.' }));
    }

    const savedCode = emailCodeObj.get('code');
    const expiresAt = emailCodeObj.get('expiresAt');
    if (!savedCode || savedCode !== code) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'Invalid verification code.' }));
    }
    if (!expiresAt || new Date() > expiresAt) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'Verification code expired.' }));
    }

    const userQuery = new Parse.Query(Parse.User);
    userQuery.equalTo('email', email);
    const user = await userQuery.first({ useMasterKey: true });
    if (user) {
      user.set('emailVerified', true);
      await user.save(null, { useMasterKey: true });
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Failed to verify code.' }));
  }
}


