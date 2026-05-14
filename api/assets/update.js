import 'dotenv/config';
import connectToDatabase from '../_db.js';
import { requireAuth } from '../_auth.js';
import Asset from '../models/Asset.js';
import AssetHistory from '../models/AssetHistory.js';

export default async function handler(req, res) {
  const auth = requireAuth(req, res, []); // admin required for some updates
  if (!auth) return;
  if (req.method !== 'PUT' && req.method !== 'PATCH') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
  }
  await connectToDatabase();
  try {
    const { assetId, ...changes } = req.body || {};
    if (!assetId) throw new Error('assetId required');
    const existing = await Asset.findById(assetId);
    if (!existing) throw new Error('Not found');

    // Only admins can change critical fields
    const allowedAny = ['remark', 'userName', 'status'];
    const allowedAdmin = ['name', 'categoryId', 'serialNumber', 'quantity', 'handoverDate', 'assigneeUserId', 'simType', 'plan'];
    const update = {};
    for (const k of allowedAny) if (changes[k] !== undefined) update[k] = changes[k];
    if (auth.role === 'admin') {
      for (const k of allowedAdmin) if (changes[k] !== undefined) update[k] = changes[k];
    }
    
    // Handle ObjectId fields - convert empty strings to null
    if (update.assigneeUserId === '' || update.assigneeUserId === null) {
      update.assigneeUserId = null;
    }
    if (update.createdByUserId === '' || update.createdByUserId === null) {
      update.createdByUserId = null;
    }

    // Track status changes and unassign events
    if (update.status && update.status !== existing.status) {
      await AssetHistory.create({
        assetId: existing._id,
        type: 'status',
        previousStatus: existing.status || '',
        newStatus: update.status,
        previousUserId: existing.assigneeUserId || null,
        unassignedDate: update.status === 'free' ? new Date() : null,
      });
      if (update.status === 'free') {
        update.assigneeUserId = null;
        update.handoverDate = null;
        update.userName = '';
      }
    }

    const updated = await Asset.findByIdAndUpdate(assetId, update, { new: true });
    if (!updated) throw new Error('Asset not found');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, asset: updated.toJSON() }));
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: e.message }));
  }
}


