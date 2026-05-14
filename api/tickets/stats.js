import 'dotenv/config';
import connectToDatabase from '../_db.js';
import { requireAuth } from '../_auth.js';
import Ticket from '../models/Ticket.js';

export default async function handler(req, res) {
  const auth = requireAuth(req, res, []); // Allow both admin and employee
  if (!auth) return;
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
  }
  await connectToDatabase();
  try {
    const isAdmin = auth.role === 'admin';
    
    // Build filter based on user role
    const filter = {};
    if (!isAdmin) {
      // For employees, only count tickets they created or are assigned to
      filter.$or = [{ createdByUserId: auth.sub }, { assignedToUserId: auth.sub }];
    }
    
    // Get counts for different statuses
    const total = await Ticket.countDocuments(filter);
    const openCount = await Ticket.countDocuments({ ...filter, status: 'open' });
    const inProgressCount = await Ticket.countDocuments({ ...filter, status: 'in-progress' });
    const resolvedCount = await Ticket.countDocuments({ ...filter, status: 'resolved' });
    const closedCount = await Ticket.countDocuments({ ...filter, status: 'closed' });
    
    // For admins, calculate additional stats
    let resolvedToday = 0;
    let avgResolutionTime = 0;
    
    if (isAdmin) {
      // Get tickets resolved today
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      resolvedToday = await Ticket.countDocuments({
        status: 'resolved',
        updatedAt: { $gte: startOfDay }
      });
      
      // Calculate average resolution time (simplified - just using resolved tickets)
      // In production, you'd want to track resolution time more precisely
      avgResolutionTime = 24; // Placeholder for now
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ 
      success: true, 
      stats: { 
        total, 
        openCount, 
        inProgressCount, 
        resolvedCount,
        closedCount,
        resolvedToday, 
        avgResolutionTime 
      } 
    }));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: e.message }));
  }
}


