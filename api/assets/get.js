import 'dotenv/config';
import connectToDatabase from '../_db.js';
import { requireAuth } from '../_auth.js';
import Asset from '../models/Asset.js';
import User from '../models/User.js';

export default async function handler(req, res) {
  const auth = requireAuth(req, res, []);
  if (!auth) return;
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
  }
  await connectToDatabase();
  try {
    const assetId = req.query?.assetId || req.body?.assetId;
    if (!assetId) throw new Error('assetId required');
    const asset = await Asset.findById(assetId);
    if (!asset) throw new Error('Asset not found');
    
    const assetObj = asset.toObject(); // Use toObject instead of toJSON
    
    // Add id field
    assetObj.id = assetObj._id.toString();
    delete assetObj._id;
    delete assetObj.__v;
    
    // If status is 'free', always show N/A regardless of any stored userName
    if (assetObj.status === 'free') {
      assetObj.assignee = 'N/A';
    }
    // Priority 1: If userName is set (manual entry), use it
    else if (assetObj.userName && assetObj.userName.trim()) {
      assetObj.assignee = assetObj.userName;
    } 
    // Priority 2: If assigneeUserId exists, fetch user from database
    else if (assetObj.assigneeUserId) {
      try {
        const user = await User.findById(assetObj.assigneeUserId).select('fullname username email');
        if (user) {
          assetObj.assignee = user.fullname || user.username || user.email || 'Unknown User';
        } else {
          assetObj.assignee = 'User Not Found';
        }
      } catch (err) {
        assetObj.assignee = 'Error Loading User';
        console.error('Error fetching user:', err.message);
      }
    } else {
      assetObj.assignee = 'N/A';
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, asset: assetObj }));
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: e.message }));
  }
}


