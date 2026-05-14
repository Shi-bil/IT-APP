import 'dotenv/config';
import connectToDatabase from '../_db.js';
import { requireAuth } from '../_auth.js';
import Project from '../models/Project.js';
import { sendToUser } from '../notifications/_send.js';

function projectToJSON(p) {
  const json = p.toJSON();
  if (json.ownerUserId && typeof json.ownerUserId === 'object' && json.ownerUserId.fullname !== undefined) {
    json.owner = {
      id: json.ownerUserId._id?.toString() || json.ownerUserId.id,
      fullname: json.ownerUserId.fullname,
      email: json.ownerUserId.email,
      department: json.ownerUserId.department,
    };
    json.ownerUserId = json.owner.id;
  }
  if (Array.isArray(json.memberUserIds)) {
    json.members = json.memberUserIds
      .filter((m) => m && typeof m === 'object' && m.fullname !== undefined)
      .map((m) => ({
        id: m._id?.toString() || m.id,
        fullname: m.fullname,
        email: m.email,
        department: m.department,
      }));
    json.memberUserIds = json.memberUserIds.map((m) => (typeof m === 'object' ? (m._id?.toString() || m.id) : String(m)));
  }
  return json;
}

export default async function handler(req, res) {
  const auth = requireAuth(req, res, []);
  if (!auth) return;
  if (req.method !== 'PUT' && req.method !== 'PATCH') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
  }
  await connectToDatabase();
  try {
    const { projectId, ...changes } = req.body || {};
    if (!projectId) throw new Error('projectId required');
    const existing = await Project.findById(projectId).select('memberUserIds name ownerUserId');
    if (!existing) throw new Error('Project not found');
    // Only the project owner or an admin can update a project
    if (auth.role !== 'admin' && String(existing.ownerUserId) !== String(auth.sub)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'Only the project owner or an admin can update this project' }));
    }
    const allowed = ['name', 'description', 'color', 'icon', 'status', 'priority', 'startDate', 'deadline', 'tags', 'memberUserIds'];
    const update = {};
    for (const k of allowed) if (changes[k] !== undefined) update[k] = changes[k];
    if (update.startDate) update.startDate = new Date(update.startDate);
    if (update.deadline) update.deadline = new Date(update.deadline);

    // Track newly added members for notification
    let newMembers = [];
    if (Array.isArray(update.memberUserIds)) {
      const prev = new Set((existing.memberUserIds || []).map((x) => String(x)));
      newMembers = update.memberUserIds.filter((u) => !prev.has(String(u)) && String(u) !== String(auth.sub));
    }

    const updated = await Project.findByIdAndUpdate(projectId, update, { new: true })
      .populate('ownerUserId', 'fullname email department')
      .populate('memberUserIds', 'fullname email department');

    if (newMembers.length) {
      await Promise.all(
        newMembers.map((u) =>
          sendToUser(u, {
            title: `Added to project: ${updated.name}`,
            body: 'You can now see this project in DevKitchen',
            data: { url: `/projects/${projectId}` },
          }, { category: 'projects' }).catch(() => {})
        )
      );
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, project: projectToJSON(updated) }));
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: e.message }));
  }
}
