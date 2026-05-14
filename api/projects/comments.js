import 'dotenv/config';
import connectToDatabase from '../_db.js';
import { requireAuth } from '../_auth.js';
import ProjectComment from '../models/ProjectComment.js';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import { sendToUser } from '../notifications/_send.js';

function commentToJSON(c) {
  const json = c.toJSON();
  if (json.createdByUserId && typeof json.createdByUserId === 'object' && json.createdByUserId.fullname !== undefined) {
    json.createdBy = {
      id: json.createdByUserId._id?.toString() || json.createdByUserId.id,
      fullname: json.createdByUserId.fullname,
      email: json.createdByUserId.email,
      department: json.createdByUserId.department,
    };
    json.createdByUserId = json.createdBy.id;
  }
  if (Array.isArray(json.mentions)) {
    json.mentions = json.mentions.map((m) => (typeof m === 'object' ? (m._id?.toString() || m.id) : String(m)));
  }
  return json;
}

async function canAccessProject(projectId, auth) {
  if (auth.role === 'admin') return true;
  const project = await Project.findById(projectId).select('ownerUserId memberUserIds');
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
      const { projectId, taskId } = req.query || {};
      if (!projectId && !taskId) throw new Error('projectId or taskId required');
      let scopedProjectId = projectId;
      if (taskId && !projectId) {
        const t = await Task.findById(taskId).select('projectId');
        if (!t) throw new Error('Task not found');
        scopedProjectId = t.projectId;
      }
      if (!(await canAccessProject(scopedProjectId, auth))) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'Forbidden' }));
      }
      const filter = { projectId: scopedProjectId };
      if (taskId) filter.taskId = taskId;
      else filter.taskId = null;
      const comments = await ProjectComment.find(filter)
        .populate('createdByUserId', 'fullname email department')
        .sort({ createdAt: 1 });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, comments: comments.map(commentToJSON) }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

  if (req.method === 'POST') {
    try {
      const { projectId, taskId, parentCommentId, text, mentions } = req.body || {};
      if (!text) throw new Error('text required');
      let scopedProjectId = projectId;
      if (taskId && !projectId) {
        const t = await Task.findById(taskId).select('projectId');
        if (!t) throw new Error('Task not found');
        scopedProjectId = t.projectId;
      }
      if (!scopedProjectId) throw new Error('projectId or taskId required');
      if (!(await canAccessProject(scopedProjectId, auth))) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'Forbidden' }));
      }
      const created = await ProjectComment.create({
        projectId: scopedProjectId,
        taskId: taskId || null,
        parentCommentId: parentCommentId || null,
        text,
        mentions: Array.isArray(mentions) ? mentions : [],
        createdByUserId: auth.sub,
      });
      const populated = await ProjectComment.findById(created._id).populate(
        'createdByUserId',
        'fullname email department'
      );

      // Build the "everyone involved" recipient set.
      // Mentioned users get a stronger "@you" framing; everyone else gets a generic "new comment" ping.
      const mentionRecipientIds = new Set();
      (Array.isArray(mentions) ? mentions : []).forEach((u) => {
        if (String(u) !== String(auth.sub)) mentionRecipientIds.add(String(u));
      });
      if (parentCommentId) {
        const parent = await ProjectComment.findById(parentCommentId).select('createdByUserId');
        if (parent && String(parent.createdByUserId) !== String(auth.sub)) {
          mentionRecipientIds.add(String(parent.createdByUserId));
        }
      }

      const involvedRecipientIds = new Set();
      const addInvolved = (uid) => {
        if (!uid) return;
        const id = String(uid);
        if (id === String(auth.sub)) return;
        if (mentionRecipientIds.has(id)) return; // mentioned users already covered with stronger framing
        involvedRecipientIds.add(id);
      };

      // Always: project members + project owner
      const project = await Project.findById(scopedProjectId).select('name ownerUserId memberUserIds');
      if (project) {
        addInvolved(project.ownerUserId);
        (project.memberUserIds || []).forEach(addInvolved);
      }

      // If this is a comment on a task: also the task assignees + task creator
      if (taskId) {
        const task = await Task.findById(taskId).select('assigneeUserIds createdByUserId');
        if (task) {
          (task.assigneeUserIds || []).forEach(addInvolved);
          addInvolved(task.createdByUserId);
        }
      }

      // Thread participants — anyone who has commented in this same scope before (task thread, or project discussion)
      const threadFilter = { projectId: scopedProjectId };
      if (taskId) threadFilter.taskId = taskId; else threadFilter.taskId = null;
      const prior = await ProjectComment.find(threadFilter).select('createdByUserId').lean();
      prior.forEach((c) => addInvolved(c.createdByUserId));

      if (mentionRecipientIds.size || involvedRecipientIds.size) {
        const projectName = project?.name || 'project';
        const author = populated?.createdByUserId;
        const senderName =
          (author && typeof author === 'object' && (author.fullname || author.email)) ||
          'Someone';
        // Strip inline mention markup @[name](id) → @name for the notification preview
        const plainText = text.replace(/@\[([^\]]+)\]\([^)]+\)/g, (_m, name) => `@${name.trim()}`);
        const preview = plainText.length > 80 ? plainText.slice(0, 77) + '...' : plainText;
        const data = { url: `/projects/${scopedProjectId}`, taskId: taskId || null };

        await Promise.all(
          [...mentionRecipientIds].map((u) =>
            sendToUser(u, {
              title: `${senderName} mentioned you in ${projectName}`,
              body: preview,
              data,
            }, { category: 'projects' }).catch(() => {})
          )
        );
        await Promise.all(
          [...involvedRecipientIds].map((u) =>
            sendToUser(u, {
              title: `${senderName} commented in ${projectName}`,
              body: preview,
              data,
            }, { category: 'projects' }).catch(() => {})
          )
        );
      }

      res.writeHead(201, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, comment: commentToJSON(populated) }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    try {
      const { commentId, text, mentions } = req.body || {};
      if (!commentId || !text) throw new Error('commentId and text required');
      const existing = await ProjectComment.findById(commentId);
      if (!existing) throw new Error('Comment not found');
      if (String(existing.createdByUserId) !== String(auth.sub) && auth.role !== 'admin') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'Forbidden' }));
      }
      existing.text = text;
      if (Array.isArray(mentions)) existing.mentions = mentions;
      existing.editedAt = new Date();
      await existing.save();
      const populated = await ProjectComment.findById(commentId).populate(
        'createdByUserId',
        'fullname email department'
      );
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, comment: commentToJSON(populated) }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { commentId } = req.body || {};
      if (!commentId) throw new Error('commentId required');
      const existing = await ProjectComment.findById(commentId);
      if (!existing) throw new Error('Comment not found');
      if (String(existing.createdByUserId) !== String(auth.sub) && auth.role !== 'admin') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'Forbidden' }));
      }
      // Also delete replies
      await ProjectComment.deleteMany({ parentCommentId: commentId });
      await ProjectComment.findByIdAndDelete(commentId);
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
