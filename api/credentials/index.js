import 'dotenv/config';
import connectToDatabase from '../_db.js';
import { requireAuth } from '../_auth.js';
import Credential from '../models/Credential.js';
import { encrypt, decrypt } from '../utils/encryption.js';

export default async function handler(req, res) {
  const auth = requireAuth(req, res, []); // admin or owner will be enforced
  if (!auth) return;
  await connectToDatabase();

  if (req.method === 'GET') {
    try {
      let filter;
      if (auth.role === 'admin') {
        // For admins, show credentials they own or that are shared with them
        filter = {
          $or: [
            { ownerUserId: auth.sub },
            { isPrivate: false },
            { sharedWithUserIds: auth.sub }
          ]
        };
      } else {
        // For employees, only show their own credentials
        filter = { ownerUserId: auth.sub };
      }
      
      const credentials = await Credential.find(filter)
        .populate('ownerUserId', 'fullname email')
        .populate('sharedWithUserIds', 'fullname email')
        .sort({ createdAt: -1 })
        .lean();

      const credentialsData = credentials.map((c) => {
        const json = { ...c, id: c._id.toString() };
        delete json._id;
        delete json.__v;
        if (json.password) {
          json.password = decrypt(json.password);
        }
        const ownerIdFromDoc = c.ownerUserId?._id || c.ownerUserId;
        json.isOwner = ownerIdFromDoc ? String(ownerIdFromDoc) === String(auth.sub) : false;
        json.canEdit = json.isOwner;
        json.canView = true;
        return json;
      });

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=0, stale-while-revalidate=60',
      });
      return res.end(JSON.stringify({ success: true, credentials: credentialsData }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      
      console.log('Received credential data:', JSON.stringify(body, null, 2));
      
      // Validate required fields (password not required for "Continue with Google" type)
      if (!body.name || !body.name.trim()) {
        console.error('Validation failed: Missing name');
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'Name is required' }));
      }
      const isGoogleType = body.type === 'google';
      if (!isGoogleType && (!body.password || !String(body.password).trim())) {
        console.error('Validation failed: Missing password');
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'Password is required' }));
      }
      
      // Encrypt the password before storing (empty for google type)
      const encryptedPassword = encrypt(body.password != null ? body.password : '');
      
      const doc = {
        name: body.name,
        type: body.type || 'password',
        username: body.username || '',
        password: encryptedPassword,
        url: body.url || '',
        category: body.category || 'Database',
        isEncrypted: true, // Always encrypted now
        notes: body.notes || '',
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
        ownerUserId: auth.sub,
        isPrivate: body.isPrivate !== undefined ? body.isPrivate : true,
        sharedWithUserIds: Array.isArray(body.sharedWithUserIds) ? body.sharedWithUserIds : [],
      };
      
      console.log('Creating credential with doc:', JSON.stringify(doc, null, 2));
      
      const created = await Credential.create(doc);
      console.log('Credential created with ID:', created._id);
      
      const populated = await Credential.findById(created._id)
        .populate('ownerUserId', 'fullname email')
        .populate('sharedWithUserIds', 'fullname email');
      
      if (!populated) {
        console.error('Failed to populate credential after creation');
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'Failed to create credential' }));
      }
      
      const json = populated.toJSON();
      // Decrypt password for the response
      if (json.password) {
        json.password = decrypt(json.password);
      }
      json.isOwner = true;
      json.canEdit = true;
      json.canView = true;
      
      console.log('Successfully created credential:', json.id);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, credential: json }));
    } catch (e) {
      console.error('Create credential error:', e);
      console.error('Error stack:', e.stack);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: e.message || 'Failed to create credential' }));
    }
  }

  res.writeHead(405, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Method Not Allowed' }));
}


