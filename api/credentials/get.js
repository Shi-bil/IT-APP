import 'dotenv/config';
import connectToDatabase from '../_db.js';
import { requireAuth } from '../_auth.js';
import Credential from '../models/Credential.js';
import { decrypt } from '../utils/encryption.js';

export default async function handler(req, res) {
  const auth = requireAuth(req, res, []);
  if (!auth) return;
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
  }
  await connectToDatabase();
  try {
    const id = req.query?.id;
    if (!id) throw new Error('id required');
    const credential = await Credential.findById(id);
    if (!credential) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'Not found' }));
    }
    if (auth.role !== 'admin' && String(credential.ownerUserId) !== String(auth.sub)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'Forbidden' }));
    }
    
    const json = credential.toJSON();
    // Decrypt password for display
    if (json.password) {
      json.password = decrypt(json.password);
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, credential: json }));
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: e.message }));
  }
}


