import 'dotenv/config';
import connectToDatabase from '../_db.js';
import { requireAuth } from '../_auth.js';
import Task from '../models/Task.js';
import Project from '../models/Project.js';
import { sendToUser } from '../notifications/_send.js';

function taskToJSON(t) {
  const json = t.toJSON();
  if (json.createdByUserId && typeof json.createdByUserId === 'object' && json.createdByUserId.fullname !== undefined) {
    json.createdBy = {
      id: json.createdByUserId._id?.toString() || json.createdByUserId.id,
      fullname: json.createdByUserId.fullname,
      email: json.createdByUserId.email,
      department: json.createdByUserId.department,
    };
    json.createdByUserId = json.createdBy.id;
  }
  if (Array.isArray(json.assigneeUserIds)) {
    json.assignees = json.assigneeUserIds
      .filter((m) => m && typeof m === 'object' && m.fullname !== undefined)
      .map((m) => ({
        id: m._id?.toString() || m.id,
        fullname: m.fullname,
        email: m.email,
        department: m.department,
      }));
    json.assigneeUserIds = json.assigneeUserIds.map((m) => (typeof m === 'object' ? (m._id?.toString() || m.id) : String(m)));
  }
  return json;
}

async function userCanAccessProject(projectId, auth) {
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
      const projectId = req.query?.projectId;
      if (!projectId) throw new Error('projectId required');
      if (!(await userCanAccessProject(projectId, auth))) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'Forbidden' }));
      }
      const tasks = await Task.find({ projectId })
        .populate('createdByUserId', 'fullname email department')
        .populate('assigneeUserIds', 'fullname email department')
        .sort({ status: 1, orderIndex: 1, createdAt: -1 });
      const data = tasks.map(taskToJSON);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, tasks: data }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      if (!body.projectId || !body.title) throw new Error('projectId and title required');
      // Anyone with access to the project (owner, members, admin) can create tasks.
      // Editing/deleting tasks remains owner+admin only — enforced in PUT/DELETE below.
      if (!(await userCanAccessProject(body.projectId, auth))) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'Forbidden' }));
      }
      const created = await Task.create({
        projectId: body.projectId,
        title: body.title,
        description: body.description || '',
        status: body.status || 'todo',
        priority: body.priority || 'medium',
        startDate: body.startDate ? new Date(body.startDate) : new Date(),
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        tags: Array.isArray(body.tags) ? body.tags : [],
        createdByUserId: auth.sub,
        assigneeUserIds: Array.isArray(body.assigneeUserIds) ? body.assigneeUserIds : [],
        orderIndex: typeof body.orderIndex === 'number' ? body.orderIndex : 0,
      });
      const populated = await Task.findById(created._id)
        .populate('createdByUserId', 'fullname email department')
        .populate('assigneeUserIds', 'fullname email department');

      // Notify everyone "involved":
      //   - Assignees of this task get the stronger "you were assigned" framing
      //   - Other project members (owner + memberUserIds) get a generic "new task in project" ping
      // Removed members (anyone not in memberUserIds at the time of write) are automatically excluded.
      const project = await Project.findById(body.projectId).select('name ownerUserId memberUserIds');
      const projectName = project?.name || 'project';
      const assignees = Array.isArray(body.assigneeUserIds) ? body.assigneeUserIds : [];
      const assigneeIds = new Set(assignees.map(String));

      const assigneeRecipients = assignees.filter((u) => String(u) !== String(auth.sub));
      await Promise.all(
        assigneeRecipients.map((u) =>
          sendToUser(u, {
            title: `New task: ${created.title}`,
            body: `You were assigned in ${projectName}`,
            data: { url: `/projects/${body.projectId}`, taskId: created._id.toString() },
          }, { category: 'projects' }).catch(() => {})
        )
      );

      // Fan-out to other project members (not the creator, not already-notified assignees)
      const memberRecipients = new Set();
      const addMember = (uid) => {
        if (!uid) return;
        const id = String(uid);
        if (id === String(auth.sub)) return;
        if (assigneeIds.has(id)) return;
        memberRecipients.add(id);
      };
      if (project) {
        addMember(project.ownerUserId);
        (project.memberUserIds || []).forEach(addMember);
      }
      await Promise.all(
        [...memberRecipients].map((u) =>
          sendToUser(u, {
            title: `New task in ${projectName}`,
            body: created.title,
            data: { url: `/projects/${body.projectId}`, taskId: created._id.toString() },
          }, { category: 'projects' }).catch(() => {})
        )
      );

      res.writeHead(201, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, task: taskToJSON(populated) }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    try {
      const { taskId, ...changes } = req.body || {};
      if (!taskId) throw new Error('taskId required');
      const existing = await Task.findById(taskId);
      if (!existing) throw new Error('Task not found');
      if (!(await userCanAccessProject(existing.projectId, auth))) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'Forbidden' }));
      }
      const allowed = ['title', 'description', 'status', 'priority', 'progress', 'startDate', 'dueDate', 'tags', 'assigneeUserIds', 'orderIndex'];
      const update = {};
      for (const k of allowed) if (changes[k] !== undefined) update[k] = changes[k];
      if (update.startDate) update.startDate = new Date(update.startDate);
      if (update.dueDate) update.dueDate = new Date(update.dueDate);

      // Resolve roles for permission checks. The task creator gets the same
      // mark-done / progress rights as an explicit assignee — a member who
      // created the task can drive it to completion on their own task.
      const projectForAuth = await Project.findById(existing.projectId).select('ownerUserId');
      const isExplicitAssignee = (existing.assigneeUserIds || []).some((u) => String(u) === String(auth.sub));
      const isCreator = existing.createdByUserId && String(existing.createdByUserId) === String(auth.sub);
      const isAssignee = isExplicitAssignee || isCreator;
      const isOwner = projectForAuth && String(projectForAuth.ownerUserId) === String(auth.sub);
      const isAdmin = auth.role === 'admin';
      const explicitStatusChange = update.status !== undefined && update.status !== existing.status;

      // Field-level gate: anything beyond status/progress requires owner or admin.
      // Assignees can only report progress and mark done — never edit title, due date,
      // priority, tags, assignees, or reorder.
      const editFields = Object.keys(update).filter((k) => k !== 'status' && k !== 'progress');
      if (editFields.length && !isOwner && !isAdmin) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'Only the project owner or an admin can edit this task' }));
      }

      // Progress permission:
      //   - existing status REVIEW  → only owner or admin (assignee waits for review)
      //   - existing status DONE    → only owner or admin (need to reopen first)
      //   - other statuses           → assignee, owner, or admin
      if (update.progress !== undefined) {
        if (existing.status === 'review') {
          if (!isOwner && !isAdmin) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: false, error: 'Only the project owner or an admin can change progress while in review' }));
          }
        } else if (existing.status === 'done') {
          if (!isOwner && !isAdmin) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: false, error: 'Only the project owner or an admin can reopen a completed task' }));
          }
        } else {
          if (!isAssignee && !isOwner && !isAdmin) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: false, error: 'Only assignees, the project owner, or an admin can update progress' }));
          }
        }
        const p = Number(update.progress);
        if (!Number.isFinite(p) || p < 0 || p > 100) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'progress must be 0-100' }));
        }
        update.progress = Math.round(p);

        // Auto-sync status so the task moves columns as progress changes:
        //   100%  → REVIEW  (the new "ready for owner approval" stage; NOT done anymore)
        //   < 100% from REVIEW or DONE → in-progress (owner reopened / rejected)
        //   > 0% from TO DO → in-progress
        if (!explicitStatusChange) {
          if (update.progress === 100 && !['review', 'done'].includes(existing.status)) {
            update.status = 'review';
          } else if (update.progress < 100 && (existing.status === 'done' || existing.status === 'review')) {
            update.status = 'in-progress';
          } else if (update.progress > 0 && update.progress < 100 && existing.status === 'todo') {
            update.status = 'in-progress';
          }
        }
      }

      // Manual status changes:
      //   - "done" from REVIEW (= approval) → only owner or admin
      //   - "done" from any other status → assignee, owner, or admin (direct mark-complete)
      //   - any other status change → owner or admin only
      if (explicitStatusChange) {
        if (update.status === 'done') {
          if (existing.status === 'review') {
            if (!isOwner && !isAdmin) {
              res.writeHead(403, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify({ success: false, error: 'Only the project owner or an admin can approve a task in review' }));
            }
          } else if (!isAssignee && !isOwner && !isAdmin) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: false, error: 'Only assignees, the project owner, or an admin can mark a task complete' }));
          }
        } else {
          if (!isOwner && !isAdmin) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: false, error: 'Only the project owner or an admin can change task status' }));
          }
        }
      }

      if (update.status === 'done' && existing.status !== 'done') {
        update.completedAt = new Date();
        if (update.progress === undefined) update.progress = 100;
      } else if (update.status && update.status !== 'done' && existing.status === 'done') {
        update.completedAt = null;
      }

      // Track new assignees for notification
      let newAssignees = [];
      if (Array.isArray(update.assigneeUserIds)) {
        const prevSet = new Set((existing.assigneeUserIds || []).map((x) => String(x)));
        newAssignees = update.assigneeUserIds.filter((u) => !prevSet.has(String(u)) && String(u) !== String(auth.sub));
      }

      const updated = await Task.findByIdAndUpdate(taskId, update, { new: true })
        .populate('createdByUserId', 'fullname email department')
        .populate('assigneeUserIds', 'fullname email department');

      // Build a recipient set for change notifications (assignees + creator), excluding the actor
      const project = await Project.findById(existing.projectId).select('name ownerUserId');
      const projectName = project?.name || 'project';
      const finalAssigneeIds = (updated.assigneeUserIds || []).map((u) => String(u._id || u));
      const baseRecipients = new Set();
      finalAssigneeIds.forEach((id) => { if (id !== String(auth.sub)) baseRecipients.add(id); });
      if (existing.createdByUserId && String(existing.createdByUserId) !== String(auth.sub)) {
        baseRecipients.add(String(existing.createdByUserId));
      }

      const notifyAll = async (recipients, payload) => {
        await Promise.all(
          [...recipients].map((u) =>
            sendToUser(u, {
              ...payload,
              data: { url: `/projects/${existing.projectId}`, taskId, ...payload.data },
            }, { category: 'projects' }).catch(() => {})
          )
        );
      };

      // 1) New assignees → "you were assigned"
      if (newAssignees.length) {
        await Promise.all(
          newAssignees.map((u) =>
            sendToUser(u, {
              title: `Assigned: ${updated.title}`,
              body: `In ${projectName}`,
              data: { url: `/projects/${existing.projectId}`, taskId },
            }, { category: 'projects' }).catch(() => {})
          )
        );
        // Don't double-notify the newly-added assignees with the generic change ping
        newAssignees.forEach((u) => baseRecipients.delete(String(u)));
      }

      // 2) Status changed
      if (update.status !== undefined && update.status !== existing.status) {
        if (update.status === 'done') {
          // Mark complete — notify base recipients (assignees + creator) AND project owner
          const completeRecipients = new Set(baseRecipients);
          if (project?.ownerUserId && String(project.ownerUserId) !== String(auth.sub)) {
            completeRecipients.add(String(project.ownerUserId));
          }
          await notifyAll(completeRecipients, {
            title: `✅ Task completed: ${updated.title}`,
            body: `Marked complete in ${projectName}`,
          });
        } else {
          await notifyAll(baseRecipients, {
            title: `Status: ${updated.title}`,
            body: `Now "${update.status}" in ${projectName}`,
          });
        }
      }

      // 3) Due date changed
      if (update.dueDate !== undefined && String(update.dueDate || '') !== String(existing.dueDate || '')) {
        const when = update.dueDate ? new Date(update.dueDate).toLocaleDateString() : 'cleared';
        await notifyAll(baseRecipients, {
          title: `Due date updated: ${updated.title}`,
          body: `New due date: ${when} · ${projectName}`,
        });
      }

      // 4) Priority changed to high/urgent
      if (update.priority !== undefined && update.priority !== existing.priority && ['high', 'urgent'].includes(update.priority)) {
        await notifyAll(baseRecipients, {
          title: `Priority ${update.priority.toUpperCase()}: ${updated.title}`,
          body: `Priority raised in ${projectName}`,
        });
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, task: taskToJSON(updated) }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { taskId } = req.body || {};
      if (!taskId) throw new Error('taskId required');
      const existing = await Task.findById(taskId);
      if (!existing) throw new Error('Task not found');
      if (!(await userCanAccessProject(existing.projectId, auth))) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'Forbidden' }));
      }
      const proj = await Project.findById(existing.projectId).select('ownerUserId');
      const isOwner = proj && String(proj.ownerUserId) === String(auth.sub);
      if (!isOwner && auth.role !== 'admin') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'Only the project owner or an admin can delete tasks' }));
      }
      await Task.findByIdAndDelete(taskId);
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
