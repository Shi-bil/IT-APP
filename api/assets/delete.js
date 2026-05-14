import 'dotenv/config';
import connectToDatabase from '../_db.js';
import { requireAuth } from '../_auth.js';
import Asset from '../models/Asset.js';

export default async function handler(req, res) {
  const auth = requireAuth(req, res, ['admin']);
  if (!auth) return;
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
  }
  await connectToDatabase();
  try {
    const assetId = req.query?.assetId || req.body?.assetId;
    if (!assetId) throw new Error('assetId required');
    await Asset.findByIdAndDelete(assetId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true }));
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: e.message }));
  }
}


