import 'dotenv/config';
import connectToDatabase from '../_db.js';
import { requireAuth } from '../_auth.js';
import Project from '../models/Project.js';

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
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
  }
  await connectToDatabase();
  try {
    const projectId = req.query?.projectId;
    if (!projectId) throw new Error('projectId required');
    const project = await Project.findById(projectId)
      .populate('ownerUserId', 'fullname email department')
      .populate('memberUserIds', 'fullname email department');
    if (!project) throw new Error('Project not found');
    if (auth.role !== 'admin') {
      const isMember =
        String(project.ownerUserId?._id || project.ownerUserId) === String(auth.sub) ||
        (project.memberUserIds || []).some((m) => String(m?._id || m) === String(auth.sub));
      if (!isMember) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'Forbidden' }));
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, project: projectToJSON(project) }));
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: e.message }));
  }
}
