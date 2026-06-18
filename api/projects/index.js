import 'dotenv/config';
import connectToDatabase from '../_db.js';
import { requireAuth } from '../_auth.js';
import Project from '../models/Project.js';
import ProjectComment from '../models/ProjectComment.js';
import { sendToUser } from '../notifications/_send.js';

function projectToJSON(p) {
  const json = typeof p.toJSON === 'function' ? p.toJSON() : { ...p };
  if (json._id) {
    json.id = json._id.toString();
    delete json._id;
    delete json.__v;
  }
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
  await connectToDatabase();

  if (req.method === 'GET') {
    try {
      const mine = String(req.query?.mine || 'false') === 'true';
      const filter = {};
      if (mine || auth.role !== 'admin') {
        filter.$or = [{ ownerUserId: auth.sub }, { memberUserIds: auth.sub }];
      }
      // Run project fetch and discussion-comment aggregate in parallel.
      // The aggregate scans all taskId=null comments; the JS join below keeps
      // only entries matching the returned project IDs.
      const [projects, latestComments] = await Promise.all([
        Project.find(filter)
          .populate('ownerUserId', 'fullname email department')
          .populate('memberUserIds', 'fullname email department')
          .sort({ createdAt: -1 })
          .lean(),
        ProjectComment.aggregate([
          { $match: { taskId: null } },
          { $sort: { createdAt: -1 } },
          {
            $group: {
              _id: '$projectId',
              latestAt: { $first: '$createdAt' },
              latestBy: { $first: '$createdByUserId' },
              count: { $sum: 1 },
            },
          },
        ]),
      ]);
      const data = projects.map(projectToJSON);

      // Annotate each project with the latest project-discussion comment
      // (taskId=null) timestamp, author, and total count so the client can
      // render an unread badge with a number.
      if (data.length) {
        const projectIdSet = new Set(projects.map((p) => String(p._id)));
        const byPid = new Map(
          latestComments
            .filter((l) => projectIdSet.has(String(l._id)))
            .map((l) => [String(l._id), l])
        );
        data.forEach((p) => {
          const hit = byPid.get(String(p.id || p._id));
          p.latestDiscussionAt = hit ? hit.latestAt : null;
          p.latestDiscussionBy = hit ? String(hit.latestBy) : null;
          p.discussionCommentCount = hit ? hit.count : 0;
        });
      }

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=0, stale-while-revalidate=60',
      });
      return res.end(JSON.stringify({ success: true, projects: data }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

  if (req.method === 'POST') {
    // Anyone authenticated can create a project; the creator automatically
    // becomes the owner (ownerUserId: auth.sub below) and gets full access.
    try {
      const body = req.body || {};
      const created = await Project.create({
        name: body.name,
        description: body.description || '',
        color: body.color || '#06b6d4',
        icon: body.icon || 'Rocket',
        status: body.status || 'active',
        priority: body.priority || 'medium',
        startDate: body.startDate ? new Date(body.startDate) : null,
        deadline: body.deadline ? new Date(body.deadline) : null,
        tags: Array.isArray(body.tags) ? body.tags : [],
        ownerUserId: auth.sub,
        memberUserIds: Array.isArray(body.memberUserIds) ? body.memberUserIds : [],
      });
      const populated = await Project.findById(created._id)
        .populate('ownerUserId', 'fullname email department')
        .populate('memberUserIds', 'fullname email department');

      // Notify newly added project members
      const members = Array.isArray(body.memberUserIds) ? body.memberUserIds : [];
      await Promise.all(
        members
          .filter((u) => String(u) !== String(auth.sub))
          .map((u) =>
            sendToUser(u, {
              title: `Added to project: ${created.name}`,
              body: 'You can now see this project in DevKitchen',
              data: { url: `/projects/${created._id}` },
            }, { category: 'projects' }).catch(() => {})
          )
      );

      res.writeHead(201, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, project: projectToJSON(populated) }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

  res.writeHead(405, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Method Not Allowed' }));
}
