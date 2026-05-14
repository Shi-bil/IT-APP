import 'dotenv/config';
import connectToDatabase from '../_db.js';
import { requireAuth } from '../_auth.js';
import Asset from '../models/Asset.js';
import AssetHistory from '../models/AssetHistory.js';

export default async function handler(req, res) {
  const auth = requireAuth(req, res, ['admin']);
  if (!auth) return;
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
  }
  await connectToDatabase();
  try {
    const { assetId, userId, handoverDate } = req.body || {};
    if (!assetId || !userId) throw new Error('assetId and userId required');
    const asset = await Asset.findById(assetId);
    if (!asset) throw new Error('Asset not found');
    const previousUserId = asset.assigneeUserId || null;
    asset.assigneeUserId = userId;
    asset.handoverDate = handoverDate ? new Date(handoverDate) : new Date();
    asset.status = 'using';
    asset.userName = ''; // Clear manual userName when assigning from database
    await asset.save();
    await AssetHistory.create({
      assetId: asset._id,
      type: 'assignment',
      previousUserId,
      assignedToUserId: userId,
      assignedByUserId: auth.sub,
      handoverDate: asset.handoverDate,
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true }));
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: e.message }));
  }
}


