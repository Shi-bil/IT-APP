import 'dotenv/config';
import connectToDatabase from '../_db.js';
import { requireAuth } from '../_auth.js';
import Ticket from '../models/Ticket.js';

export default async function handler(req, res) {
  const auth = requireAuth(req, res, []); // allow both admin and employee; filter below
  if (!auth) return;
  await connectToDatabase();

  if (req.method === 'GET') {
    try {
      const mine = String(req.query?.mine || 'false') === 'true';
      const filter = {};
      if (mine) {
        filter.$or = [{ createdByUserId: auth.sub }, { assignedToUserId: auth.sub }];
      }
      const tickets = await Ticket.find(filter)
        .populate('createdByUserId', 'fullname email department')
        .populate('assignedToUserId', 'fullname email department')
        .sort({ createdAt: -1 })
        .lean();
      const ticketsData = tickets.map((t) => {
        const json = { ...t, id: t._id.toString() };
        delete json._id;
        delete json.__v;
        if (t.createdByUserId && typeof t.createdByUserId === 'object' && t.createdByUserId._id) {
          json.createdBy = {
            id: t.createdByUserId._id.toString(),
            fullname: t.createdByUserId.fullname,
            email: t.createdByUserId.email,
            department: t.createdByUserId.department,
          };
          json.createdByUserId = json.createdBy.id;
        }
        if (t.assignedToUserId && typeof t.assignedToUserId === 'object' && t.assignedToUserId._id) {
          json.assignedTo = {
            id: t.assignedToUserId._id.toString(),
            fullname: t.assignedToUserId.fullname,
            email: t.assignedToUserId.email,
            department: t.assignedToUserId.department,
          };
          json.assignedToUserId = json.assignedTo.id;
        }
        return json;
      });
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=0, stale-while-revalidate=60',
      });
      return res.end(JSON.stringify({ success: true, tickets: ticketsData }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const doc = {
        title: body.title,
        description: body.description || '',
        category: body.category || '',
        priority: body.priority || '',
        status: 'open',
        tags: Array.isArray(body.tags) ? body.tags : [],
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        createdByUserId: auth.sub,
      };
      const created = await Ticket.create(doc);
      
      // Populate the user data before returning
      const populated = await Ticket.findById(created._id)
        .populate('createdByUserId', 'fullname email department')
        .populate('assignedToUserId', 'fullname email department');
      
      const ticketData = populated.toJSON();
      // Map the populated fields to match frontend expectations
      if (ticketData.createdByUserId) {
        ticketData.createdBy = {
          id: ticketData.createdByUserId._id || ticketData.createdByUserId.id,
          fullname: ticketData.createdByUserId.fullname,
          email: ticketData.createdByUserId.email,
          department: ticketData.createdByUserId.department
        };
      }
      if (ticketData.assignedToUserId) {
        ticketData.assignedTo = {
          id: ticketData.assignedToUserId._id || ticketData.assignedToUserId.id,
          fullname: ticketData.assignedToUserId.fullname,
          email: ticketData.assignedToUserId.email,
          department: ticketData.assignedToUserId.department
        };
      }
      
      res.writeHead(201, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, ticket: ticketData }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

  res.writeHead(405, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Method Not Allowed' }));
}


