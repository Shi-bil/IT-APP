import 'dotenv/config';
import connectToDatabase from './_db.js';
import { requireAuth } from './_auth.js';
import Asset from './models/Asset.js';
import Ticket from './models/Ticket.js';
import Credential from './models/Credential.js';
import User from './models/User.js';
import Vps from './models/Vps.js';
import Subscription from './models/Subscription.js';

export default async function handler(req, res) {
  const auth = requireAuth(req, res, ['admin']); // search is admin-only
  if (!auth) return;
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
  }
  await connectToDatabase();
  try {
    const q = (req.query?.q || '').trim();
    if (!q) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, results: [] }));
    }
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const [assets, users, tickets, credentials, vpsItems, subscriptions] = await Promise.all([
      Asset.find({ $or: [{ name: regex }, { serialNumber: regex }, { remark: regex }] }).limit(10).lean(),
      User.find({ $or: [{ fullname: regex }, { username: regex }, { email: regex }] }).limit(10).lean(),
      Ticket.find({ $or: [{ title: regex }, { description: regex }, { category: regex }] }).limit(10).lean(),
      Credential.find({ $or: [{ name: regex }, { username: regex }, { category: regex }, { notes: regex }, { url: regex }, { ip: regex }] }).limit(10).lean(),
      Vps.find({ $or: [{ name: regex }, { provider: regex }, { providerAccount: regex }, { hostname: regex }, { ipAddress: regex }, { status: regex }, { notes: regex }] }).limit(10).lean(),
      Subscription.find({ $or: [{ name: regex }, { provider: regex }, { category: regex }, { username: regex }, { url: regex }, { status: regex }, { notes: regex }] }).limit(10).lean(),
    ]);
    const results = [
      ...assets.map(a => ({ type: 'Asset', label: a.name, id: String(a._id) })),
      ...users.map(u => ({ type: 'User', label: u.fullname || u.username || u.email, id: String(u._id) })),
      ...tickets.map(t => ({ type: 'Ticket', label: t.title, id: String(t._id) })),
      ...credentials.map(c => ({ type: 'Credential', label: c.name || c.username, id: String(c._id) })),
      ...vpsItems.map(v => ({ type: 'VPS', label: v.name, id: String(v._id) })),
      ...subscriptions.map(s => ({ type: 'Subscription', label: s.name, id: String(s._id) })),
    ];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, results }));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: e.message }));
  }
}


