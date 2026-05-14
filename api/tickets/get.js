import 'dotenv/config';
import connectToDatabase from '../_db.js';
import { requireAuth } from '../_auth.js';
import Ticket from '../models/Ticket.js';

export default async function handler(req, res) {
  const auth = requireAuth(req, res, []);
  if (!auth) return;
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
  }
  await connectToDatabase();
  try {
    const ticketId = req.query?.ticketId || req.body?.ticketId;
    if (!ticketId) throw new Error('ticketId required');
    const ticket = await Ticket.findById(ticketId)
      .populate('createdByUserId', 'fullname email department')
      .populate('assignedToUserId', 'fullname email department');
    if (!ticket) throw new Error('Ticket not found');
    
    const ticketData = ticket.toJSON();
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
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, ticket: ticketData }));
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: e.message }));
  }
}


