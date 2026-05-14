import 'dotenv/config';
import connectToDatabase from '../_db.js';
import { requireAuth } from '../_auth.js';
import Asset from '../models/Asset.js';
import User from '../models/User.js';

export default async function handler(req, res) {
  const auth = requireAuth(req, res, []); // admin and employee
  if (!auth) return;
  await connectToDatabase();

  if (req.method === 'GET') {
    try {
      const mine = String(req.query?.mine || 'false') === 'true';
      const filter = {};
      if (mine) {
        filter.assigneeUserId = auth.sub;
      } else if (auth.role !== 'admin') {
        filter.assigneeUserId = auth.sub;
      }

      // Use lean() for ~3-5x faster reads (skips Mongoose document hydration).
      const assets = await Asset.find(filter)
        .sort({ createdAt: -1 })
        .lean();

      // Batch-fetch every needed user in ONE query instead of one-per-asset (N+1 fix).
      const userIds = [
        ...new Set(
          assets
            .filter((a) => a.status !== 'free' && (!a.userName || !a.userName.trim()) && a.assigneeUserId)
            .map((a) => String(a.assigneeUserId))
        ),
      ];
      const userMap = new Map();
      if (userIds.length) {
        const users = await User.find({ _id: { $in: userIds } })
          .select('fullname username email')
          .lean();
        users.forEach((u) => userMap.set(String(u._id), u));
      }

      const assetsData = assets.map((a) => {
        const id = a._id.toString();
        let assignee;
        if (a.status === 'free') {
          assignee = 'N/A';
        } else if (a.userName && a.userName.trim()) {
          assignee = a.userName;
        } else if (a.assigneeUserId) {
          const u = userMap.get(String(a.assigneeUserId));
          assignee = u ? (u.fullname || u.username || u.email || 'Unknown User') : 'User Not Found';
        } else {
          assignee = 'N/A';
        }
        return {
          id,
          name: a.name,
          categoryId: a.categoryId,
          serialNumber: a.serialNumber,
          status: a.status,
          quantity: a.quantity,
          remark: a.remark,
          userName: a.userName,
          simType: a.simType,
          plan: a.plan,
          assigneeUserId: a.assigneeUserId,
          handoverDate: a.handoverDate,
          createdAt: a.createdAt,
          updatedAt: a.updatedAt,
          assignee,
        };
      });

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=0, stale-while-revalidate=60',
      });
      return res.end(JSON.stringify({ success: true, assets: assetsData }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

  if (req.method === 'POST') {
    if (auth.role !== 'admin') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'Forbidden' }));
    }
    try {
      const body = req.body || {};
      const doc = {
        name: body.name,
        categoryId: body.categoryId,
        serialNumber: body.serialNumber,
        status: body.status || 'free',
        quantity: Number(body.quantity || 0),
        remark: body.remark || '',
        userName: body.userName || '',
        simType: body.simType || '',
        plan: body.plan || '',
        createdByUserId: auth.sub,
      };
      const created = await Asset.create(doc);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, asset: created.toJSON() }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

  res.writeHead(405, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Method Not Allowed' }));
}
