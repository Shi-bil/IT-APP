import 'dotenv/config';
import connectToDatabase from '../_db.js';
import { requireAuth } from '../_auth.js';
import Credential from '../models/Credential.js';

export default async function handler(req, res) {
  const auth = requireAuth(req, res, []);
  if (!auth) return;
  if (req.method !== 'DELETE' && req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
  }
  await connectToDatabase();
  try {
    const id = req.query?.id || req.body?.id;
    if (!id) throw new Error('id required');
    const existing = await Credential.findById(id);
    if (!existing) throw new Error('Not found');
    
    // Only the owner can delete the credential
    if (String(existing.ownerUserId) !== String(auth.sub)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'Only the owner can delete this credential' }));
    }
    
    await Credential.findByIdAndDelete(id);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true }));
  } catch (e) {
    console.error('Delete credential error:', e);
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: e.message }));
  }
}


