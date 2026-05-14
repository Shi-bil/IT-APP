import 'dotenv/config';
import connectToDatabase from '../_db.js';
import { requireAuth } from '../_auth.js';
import Subtask from '../models/Subtask.js';
import Task from '../models/Task.js';
import Project from '../models/Project.js';

async function canAccessTask(taskId, auth) {
  if (auth.role === 'admin') return true;
  const task = await Task.findById(taskId).select('projectId');
  if (!task) return false;
  const project = await Project.findById(task.projectId).select('ownerUserId memberUserIds');
  if (!project) return false;
  if (String(project.ownerUserId) === String(auth.sub)) return true;
  return (project.memberUserIds || []).some((m) => String(m) === String(auth.sub));
}

export default async function handler(req, res) {
  const auth = requireAuth(req, res, []);
  if (!auth) return;
  await connectToDatabase();

  if (req.method === 'GET') {
    try {
      const taskId = req.query?.taskId;
      if (!taskId) throw new Error('taskId required');
      if (!(await canAccessTask(taskId, auth))) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'Forbidden' }));
      }
      const subtasks = await Subtask.find({ taskId }).sort({ orderIndex: 1, createdAt: 1 });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, subtasks: subtasks.map((s) => s.toJSON()) }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

  if (req.method === 'POST') {
    try {
      const { taskId, title, assigneeUserId } = req.body || {};
      if (!taskId || !title) throw new Error('taskId and title required');
      if (!(await canAccessTask(taskId, auth))) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'Forbidden' }));
      }
      const count = await Subtask.countDocuments({ taskId });
      const created = await Subtask.create({
        taskId,
        title,
        assigneeUserId: assigneeUserId || null,
        orderIndex: count,
      });
      res.writeHead(201, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, subtask: created.toJSON() }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    try {
      const { subtaskId, ...changes } = req.body || {};
      if (!subtaskId) throw new Error('subtaskId required');
      const existing = await Subtask.findById(subtaskId);
      if (!existing) throw new Error('Subtask not found');
      if (!(await canAccessTask(existing.taskId, auth))) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'Forbidden' }));
      }
      const allowed = ['title', 'completed', 'assigneeUserId', 'orderIndex'];
      const update = {};
      for (const k of allowed) if (changes[k] !== undefined) update[k] = changes[k];
      const updated = await Subtask.findByIdAndUpdate(subtaskId, update, { new: true });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, subtask: updated.toJSON() }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { subtaskId } = req.body || {};
      if (!subtaskId) throw new Error('subtaskId required');
      const existing = await Subtask.findById(subtaskId);
      if (!existing) throw new Error('Subtask not found');
      if (!(await canAccessTask(existing.taskId, auth))) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'Forbidden' }));
      }
      await Subtask.findByIdAndDelete(subtaskId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

  res.writeHead(405, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Method Not Allowed' }));
}
