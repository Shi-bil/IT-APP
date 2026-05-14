import 'dotenv/config';
import connectToDatabase from '../_db.js';
import { requireAuth } from '../_auth.js';
import Credential from '../models/Credential.js';
import { encrypt, decrypt } from '../utils/encryption.js';

export default async function handler(req, res) {
  const auth = requireAuth(req, res, []);
  if (!auth) return;
  if (req.method !== 'PUT' && req.method !== 'PATCH') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
  }
  await connectToDatabase();
  try {
    const { id, ...changes } = req.body || {};
    if (!id) throw new Error('id required');
    const existing = await Credential.findById(id);
    if (!existing) throw new Error('Not found');
    
    // Only the owner can update the credential
    if (String(existing.ownerUserId) !== String(auth.sub)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'Only the owner can update this credential' }));
    }
    
    const allowed = ['name', 'type', 'username', 'password', 'url', 'category', 'isEncrypted', 'notes', 'expiryDate', 'isPrivate', 'sharedWithUserIds'];
    const update = {};
    for (const k of allowed) {
      if (changes[k] !== undefined) {
        update[k] = changes[k];
      }
    }
    
    // Encrypt password if it's being updated
    if (update.password) {
      update.password = encrypt(update.password);
      update.isEncrypted = true;
    }
    
    if (update.expiryDate) update.expiryDate = new Date(update.expiryDate);
    
    const updated = await Credential.findByIdAndUpdate(id, update, { new: true })
      .populate('ownerUserId', 'fullname email')
      .populate('sharedWithUserIds', 'fullname email');
    
    if (!updated) throw new Error('Credential not found');
    
    const json = updated.toJSON();
    // Decrypt password for the response
    if (json.password) {
      json.password = decrypt(json.password);
    }
    const ownerIdFromDoc = updated.ownerUserId?._id || updated.ownerUserId;
    json.isOwner = ownerIdFromDoc ? String(ownerIdFromDoc) === String(auth.sub) : false;
    json.canEdit = json.isOwner;
    json.canView = true;
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, credential: json }));
  } catch (e) {
    console.error('Update credential error:', e);
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: e.message }));
  }
}


