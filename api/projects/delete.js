import 'dotenv/config';
import connectToDatabase from '../_db.js';
import { requireAuth } from '../_auth.js';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import Subtask from '../models/Subtask.js';
import ProjectComment from '../models/ProjectComment.js';

export default async function handler(req, res) {
  const auth = requireAuth(req, res, []);
  if (!auth) return;
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
  }
  await connectToDatabase();
  try {
    const { projectId } = req.body || {};
    if (!projectId) throw new Error('projectId required');
    // Only the project owner or an admin can delete the project
    const owning = await Project.findById(projectId).select('ownerUserId');
    if (!owning) throw new Error('Project not found');
    if (auth.role !== 'admin' && String(owning.ownerUserId) !== String(auth.sub)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'Only the project owner or an admin can delete this project' }));
    }
    const tasks = await Task.find({ projectId }).select('_id');
    const taskIds = tasks.map((t) => t._id);
    await Subtask.deleteMany({ taskId: { $in: taskIds } });
    await ProjectComment.deleteMany({ projectId });
    await Task.deleteMany({ projectId });
    const deleted = await Project.findByIdAndDelete(projectId);
    if (!deleted) throw new Error('Project not found');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true }));
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: e.message }));
  }
}
