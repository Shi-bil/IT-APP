import 'dotenv/config';
import connectToDatabase from '../_db.js';
import { requireAuth } from '../_auth.js';
import TicketComment from '../models/TicketComment.js';

export default async function handler(req, res) {
  const auth = requireAuth(req, res, []);
  if (!auth) return;
  await connectToDatabase();

  if (req.method === 'GET') {
    try {
      const ticketId = req.query?.ticketId;
      if (!ticketId) throw new Error('ticketId required');
      const comments = await TicketComment.find({ ticketId })
        .populate('createdByUserId', 'fullname email department')
        .sort({ createdAt: 1 });
      const commentsData = comments.map(c => {
        const json = c.toJSON();
        // Map the populated fields to match frontend expectations
        if (json.createdByUserId) {
          json.createdBy = {
            id: json.createdByUserId._id || json.createdByUserId.id,
            fullname: json.createdByUserId.fullname,
            email: json.createdByUserId.email,
            department: json.createdByUserId.department
          };
        }
        return json;
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, comments: commentsData }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

  if (req.method === 'POST') {
    try {
      const { ticketId, text } = req.body || {};
      if (!ticketId || !text) throw new Error('ticketId and text required');
      await TicketComment.create({
        ticketId,
        text,
        createdByUserId: auth.sub,
      });
      res.writeHead(201, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

  res.writeHead(405, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Method Not Allowed' }));
}


