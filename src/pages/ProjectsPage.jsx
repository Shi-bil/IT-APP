import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Rocket, Plus, Calendar, Flag, X, Trash2, Sparkles, Zap, Users as UsersIcon,
  KanbanSquare, List as ListIcon, Calendar as CalIcon, MessageSquare, Settings,
  ChevronRight, ArrowLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, isPast, differenceInDays } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import projectService from '../services/projectService';
import taskService from '../services/taskService';
import { userService } from '../services/userService';
import Avatar from '../components/projects/Avatar';
import TaskFlowCards from '../components/projects/TaskFlowCards';
import CommentThread from '../components/projects/CommentThread';
import BoardView from '../components/projects/views/BoardView';
import ListView from '../components/projects/views/ListView';
import CalendarView from '../components/projects/views/CalendarView';

const PROJECT_COLORS = [
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f59e0b', '#10b981', '#14b8a6', '#6366f1', '#84cc16',
];

const STATUS_DOT = {
  active: 'bg-emerald-400',
  'on-hold': 'bg-amber-400',
  completed: 'bg-cyan-400',
  archived: 'bg-slate-500',
};

const VIEWS = [
  { id: 'board', label: 'Board', icon: KanbanSquare },
  { id: 'list', label: 'List', icon: ListIcon },
  { id: 'calendar', label: 'Calendar', icon: CalIcon },
  { id: 'discussion', label: 'Discussion', icon: MessageSquare },
];

/* ---------- Modals ---------- */

function CreateProjectModal({ open, onClose, onCreated, users }) {
  const [form, setForm] = useState({
    name: '', description: '', color: PROJECT_COLORS[0], priority: 'medium',
    startDate: '', deadline: '', memberUserIds: [],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        name: '', description: '', color: PROJECT_COLORS[0], priority: 'medium',
        startDate: '', deadline: '', memberUserIds: [],
      });
    }
  }, [open]);

  if (!open) return null;

  const toggleMember = (id) => {
    setForm((f) => ({
      ...f,
      memberUserIds: f.memberUserIds.includes(id)
        ? f.memberUserIds.filter((x) => x !== id)
        : [...f.memberUserIds, id],
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Name required');
    setSaving(true);
    const r = await projectService.create({
      ...form, name: form.name.trim(),
      startDate: form.startDate || null, deadline: form.deadline || null,
    });
    setSaving(false);
    if (r.success) { toast.success('Project created'); onCreated(r.project); onClose(); }
    else toast.error(r.error || 'Failed');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm flex items-center justify-between p-5 border-b border-white/10 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-white">New Project</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Project name"
            className="w-full px-3 py-2.5 bg-slate-800/50 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/50" />
          <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Description"
            className="w-full px-3 py-2.5 bg-slate-800/50 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/50 resize-none" />
          <div className="grid grid-cols-2 gap-3">
            <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="px-3 py-2.5 bg-slate-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-400/50" />
            <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              className="px-3 py-2.5 bg-slate-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-400/50" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
              className="px-3 py-2.5 bg-slate-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-400/50">
              <option value="low">Low</option><option value="medium">Medium</option>
              <option value="high">High</option><option value="urgent">Urgent</option>
            </select>
            <div className="flex gap-1.5 flex-wrap pt-1.5">
              {PROJECT_COLORS.map((c) => (
                <button type="button" key={c} onClick={() => setForm({ ...form, color: c })}
                  className={`w-7 h-7 rounded-full transition-transform ${form.color === c ? 'ring-2 ring-white scale-110' : 'hover:scale-110'}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Members ({form.memberUserIds.length})</label>
            <div className="max-h-40 overflow-y-auto border border-white/10 rounded-lg p-2 space-y-1 bg-slate-800/30">
              {users.length === 0 && <p className="text-xs text-slate-500 p-2">No users available</p>}
              {users.map((u) => (
                <label key={u.id} className="flex items-center gap-2 p-2 rounded hover:bg-white/5 cursor-pointer">
                  <input type="checkbox" checked={form.memberUserIds.includes(u.id)} onChange={() => toggleMember(u.id)} className="accent-cyan-500" />
                  <Avatar name={u.fullname || u.email} size={24} ringClass="" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{u.fullname || u.email}</div>
                    <div className="text-xs text-slate-500 truncate">{u.email}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-slate-300 hover:bg-white/5">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50">
              {saving ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function QuickAddTask({ projectId, defaultStatus, members, onCreated, onClose }) {
  const [form, setForm] = useState({
    title: '', description: '', priority: 'medium',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    dueDate: '', assigneeUserIds: [],
  });
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    const r = await taskService.create({
      projectId, status: defaultStatus || 'todo', ...form, title: form.title.trim(),
      startDate: form.startDate || null, dueDate: form.dueDate || null,
    });
    setSaving(false);
    if (r.success) { onCreated(r.task); onClose(); }
    else toast.error(r.error || 'Failed');
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">New Task</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-3">
          <input autoFocus placeholder="Task title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-2.5 bg-slate-800/50 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/50" />
          <textarea placeholder="Description (optional)" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-400/50 resize-none" />
          <div className="grid grid-cols-3 gap-2">
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
              className="px-2 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-400/50">
              <option value="low">Low</option><option value="medium">Medium</option>
              <option value="high">High</option><option value="urgent">Urgent</option>
            </select>
            <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="px-2 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-400/50" />
            <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="px-2 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-400/50" />
          </div>
          <div>
            <label className="text-xs text-slate-400">Assignees</label>
            <div className="mt-1 max-h-32 overflow-y-auto border border-white/10 rounded-lg p-2 bg-slate-800/30 space-y-0.5">
              {members.length === 0 && <p className="text-xs text-slate-500 p-1">No members</p>}
              {members.map((m) => {
                const checked = form.assigneeUserIds.includes(m.id);
                return (
                  <label key={m.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-white/5 cursor-pointer">
                    <input type="checkbox" checked={checked}
                      onChange={() => setForm((f) => ({
                        ...f, assigneeUserIds: checked ? f.assigneeUserIds.filter((x) => x !== m.id) : [...f.assigneeUserIds, m.id],
                      }))}
                      className="accent-cyan-500" />
                    <Avatar name={m.fullname || m.email} size={22} ringClass="" />
                    <span className="text-sm text-white truncate">{m.fullname || m.email}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-2 text-sm rounded-lg text-slate-300 hover:bg-white/5">Cancel</button>
            <button type="submit" disabled={saving || !form.title.trim()}
              className="px-4 py-2 text-sm rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50">
              {saving ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProjectSettingsModal({ project, allUsers, onClose, onUpdated, onDeleted }) {
  const [form, setForm] = useState({
    name: project.name, description: project.description || '',
    status: project.status, priority: project.priority,
    deadline: project.deadline ? format(new Date(project.deadline), 'yyyy-MM-dd') : '',
    startDate: project.startDate ? format(new Date(project.startDate), 'yyyy-MM-dd') : '',
    memberUserIds: project.memberUserIds || (project.members || []).map((m) => m.id),
    color: project.color,
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const r = await projectService.update(project.id, {
      ...form, startDate: form.startDate || null, deadline: form.deadline || null,
    });
    setSaving(false);
    if (r.success) { onUpdated(r.project); onClose(); toast.success('Saved'); }
    else toast.error(r.error || 'Failed');
  };
  const remove = async () => {
    if (!confirm(`Delete "${project.name}" and ALL its data?`)) return;
    const r = await projectService.remove(project.id);
    if (r.success) onDeleted();
    else toast.error(r.error || 'Delete failed');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-900/95 flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">Project Settings</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-400/50" />
          <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-400/50 resize-none" />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="px-2 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-400/50">
              <option value="active">Active</option><option value="on-hold">On Hold</option>
              <option value="completed">Completed</option><option value="archived">Archived</option>
            </select>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
              className="px-2 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-400/50">
              <option value="low">Low</option><option value="medium">Medium</option>
              <option value="high">High</option><option value="urgent">Urgent</option>
            </select>
            <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="px-2 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-400/50" />
            <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              className="px-2 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-400/50" />
          </div>
          <div>
            <label className="text-xs text-slate-400">Members ({form.memberUserIds.length})</label>
            <div className="mt-1 max-h-40 overflow-y-auto border border-white/10 rounded-lg p-2 bg-slate-800/30 space-y-0.5">
              {allUsers.map((u) => {
                const checked = form.memberUserIds.includes(u.id);
                const isOwner = u.id === project.ownerUserId;
                return (
                  <label key={u.id} className={`flex items-center gap-2 p-1.5 rounded ${isOwner ? 'opacity-60' : 'hover:bg-white/5 cursor-pointer'}`}>
                    <input type="checkbox" checked={checked || isOwner} disabled={isOwner}
                      onChange={() => setForm((f) => ({
                        ...f, memberUserIds: checked ? f.memberUserIds.filter((x) => x !== u.id) : [...f.memberUserIds, u.id],
                      }))} className="accent-cyan-500" />
                    <Avatar name={u.fullname || u.email} size={22} ringClass="" />
                    <span className="text-sm text-white truncate flex-1">{u.fullname || u.email}</span>
                    {isOwner && <span className="text-[10px] text-slate-500">Owner</span>}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
        <div className="sticky bottom-0 bg-slate-900/95 flex items-center justify-between p-4 border-t border-white/10">
          <button onClick={remove} className="px-3 py-2 text-sm rounded-lg text-red-300 hover:bg-red-500/10 flex items-center gap-1.5">
            <Trash2 className="w-4 h-4" /> Delete
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-2 text-sm rounded-lg text-slate-300 hover:bg-white/5">Cancel</button>
            <button onClick={save} disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Project Row (left rail) — expandable menu item ---------- */

const PROJECT_SUB_ITEMS = [
  { id: 'board', label: 'Board', icon: KanbanSquare },
  { id: 'list', label: 'List', icon: ListIcon },
  { id: 'calendar', label: 'Calendar', icon: CalIcon },
  { id: 'discussion', label: 'Discussion', icon: MessageSquare },
];

function ProjectRow({ project, selected, stats, hasUnreadDiscussion, unreadDiscussionCount = 0, onClick, onNavigateToView, currentView, index = 0 }) {
  const [expanded, setExpanded] = useState(false);
  const progress = stats?.total ? Math.round((stats.done / stats.total) * 100) : 0;
  const deadline = project.deadline ? new Date(project.deadline) : null;
  const overdue = deadline && isPast(deadline) && progress < 100;
  const daysLeft = deadline ? differenceInDays(deadline, new Date()) : null;

  // Auto-expand when this project becomes selected
  useEffect(() => {
    if (selected) setExpanded(true);
  }, [selected]);

  const toggle = (e) => {
    e.stopPropagation();
    setExpanded((v) => !v);
  };

  return (
    <div
      style={{ animationDelay: `${Math.min(index, 12) * 60}ms` }}
      className={`animate-slide-in-left group rounded-xl border transition-all relative overflow-hidden ${
        selected
          ? 'border-cyan-400/50 bg-gradient-to-r from-cyan-500/10 to-blue-500/5 shadow-[0_0_20px_-8px_rgba(6,182,212,0.5)]'
          : 'border-white/5 bg-slate-900/30 hover:border-white/15 hover:bg-slate-800/40'
      }`}
    >
      {selected && (
        <div className="absolute left-0 top-0 bottom-0 w-1 rounded-r" style={{ background: project.color }} />
      )}

      {/* Main row */}
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left px-2 py-1.5 flex items-center gap-1.5 ml-0.5"
      >
        {/* Expand arrow */}
        <span
          role="button"
          tabIndex={0}
          onClick={toggle}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggle(e); }}
          className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded text-slate-500 hover:text-cyan-300 hover:bg-white/5 transition-colors cursor-pointer"
          title={expanded ? 'Collapse' : 'Expand'}
        >
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </span>

        {/* Color icon */}
        <div
          className="w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center"
          style={{ background: `${project.color}22`, border: `1px solid ${project.color}55` }}
        >
          <Rocket className="w-3 h-3" style={{ color: project.color }} />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className={`text-[13px] font-semibold truncate leading-tight flex items-center gap-1 ${selected ? 'text-white' : 'text-slate-200'}`}>
            <span className="truncate">{project.name}</span>
            {hasUnreadDiscussion && (
              <span className="flex-shrink-0 w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.85)] animate-pulse" title={`${unreadDiscussionCount} new discussion message${unreadDiscussionCount === 1 ? '' : 's'}`} />
            )}
          </h3>
          <div className="flex items-center gap-1 text-[10px] text-slate-400 leading-tight">
            <span className={`w-1 h-1 rounded-full ${STATUS_DOT[project.status] || 'bg-slate-500'}`} />
            <span>{progress}%</span>
            <span>·</span>
            <span>{stats?.total ?? 0}t</span>
            {deadline && (
              <>
                <span>·</span>
                <span className={overdue ? 'text-red-300' : daysLeft <= 7 ? 'text-amber-300' : ''}>
                  {overdue ? 'overdue' : daysLeft === 0 ? 'today' : daysLeft > 0 ? `${daysLeft}d` : `${Math.abs(daysLeft)}d ago`}
                </span>
              </>
            )}
          </div>
        </div>
      </button>

      {/* Inline progress bar */}
      <div className="px-2 pb-1.5 ml-6">
        <div className="h-0.5 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: project.color }} />
        </div>
      </div>

      {/* Expanded sub-menu */}
      {expanded && (
        <div className="animate-accordion-down border-t border-white/5 bg-slate-950/40 py-0.5">
          {PROJECT_SUB_ITEMS.map((s) => {
            const Icon = s.icon;
            const active = selected && currentView === s.id;
            const showDot = s.id === 'discussion' && hasUnreadDiscussion;
            return (
              <button
                key={s.id}
                onClick={(e) => { e.stopPropagation(); onNavigateToView(project, s.id); }}
                className={`w-full flex items-center gap-1.5 pl-9 pr-2 py-1 text-[11px] transition-colors ${
                  active
                    ? 'text-cyan-300 bg-cyan-500/10'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span className="flex-1 text-left">{s.label}</span>
                {showDot && (
                  <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)] animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Right pane content ---------- */

function ProjectPane({
  project, allUsers, onProjectUpdated, onProjectDeleted, onBack,
  tasks, loading, selectedTask, onTaskClick, onTaskUpdated, onTaskCreated, onTaskDeleted,
  initialView = 'board', hasUnreadDiscussion = false, unreadDiscussionCount = 0, onMarkDiscussionRead,
}) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [view, setView] = useState(initialView);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddStatus, setQuickAddStatus] = useState('todo');
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => { setView(initialView); }, [project.id, initialView]);

  // Mark discussion as read whenever the user lands on that view
  useEffect(() => {
    if (view === 'discussion' && onMarkDiscussionRead) onMarkDiscussionRead(project.id);
  }, [view, project.id, onMarkDiscussionRead]);

  const members = useMemo(() => {
    const all = [project.owner, ...(project.members || [])].filter(Boolean);
    const seen = new Set();
    return all.filter((m) => { if (seen.has(m.id)) return false; seen.add(m.id); return true; });
  }, [project]);

  const projectOwnerId = project.owner?.id || project.ownerUserId;
  const isOwner = projectOwnerId && String(projectOwnerId) === String(user?.id);
  const isMember = members.some((m) => String(m.id) === String(user?.id));
  // Edit/delete/drag-drop on existing tasks: owner + admin only.
  // Creating new tasks: anyone involved in the project (owner, members, admin).
  // Assignees can still mark their own tasks done — handled by the task action UI.
  const canManageTasks = isAdmin || isOwner;
  const canCreateTasks = isAdmin || isOwner || isMember;

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === 'done').length;
    return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
  }, [tasks]);

  return (
    <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
      {/* Pane header */}
      <div
        className="relative overflow-hidden border-b border-white/10 p-4"
        style={{ background: `linear-gradient(135deg, ${project.color}22, transparent 60%), rgba(15,23,42,0.5)` }}
      >
        <div
          className="absolute -top-12 -right-12 w-40 h-40 rounded-full opacity-30 blur-3xl"
          style={{ background: project.color }}
        />
        <div className="relative flex items-start gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden p-2 -ml-2 text-slate-400 hover:text-white"
              title="Back to list"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${project.color}33`, border: `1px solid ${project.color}66` }}
          >
            <Rocket className="w-5 h-5" style={{ color: project.color }} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg md:text-xl font-bold text-white truncate">{project.name}</h1>
            <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{project.description || 'No description'}</p>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap text-[11px]">
              <span className="text-slate-300 flex items-center gap-1"><Flag className="w-3 h-3" /> {project.priority}</span>
              {project.deadline && (
                <span className="text-slate-300 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {format(new Date(project.deadline), 'MMM d, yyyy')}
                </span>
              )}
              <span className="text-slate-300 flex items-center gap-1"><UsersIcon className="w-3 h-3" /> {members.length}</span>
              <span className="text-emerald-300">{stats.percent}% · {stats.done}/{stats.total}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="hidden md:flex -space-x-2">
              {members.slice(0, 4).map((m) => (
                <Avatar key={m.id} name={m.fullname || m.email} size={28} />
              ))}
              {members.length > 4 && (
                <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-[10px] text-slate-300 ring-2 ring-slate-900">
                  +{members.length - 4}
                </div>
              )}
            </div>
            {canManageTasks && (
              <button onClick={() => setSettingsOpen(true)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5">
                <Settings className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* View tabs + add */}
      <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-white/5 flex-wrap">
        <div className="flex bg-slate-900/50 border border-white/5 rounded-xl p-1 overflow-x-auto">
          {VIEWS.map((v) => {
            const Icon = v.icon;
            const active = view === v.id;
            const showDot = v.id === 'discussion' && hasUnreadDiscussion && !active;
            return (
              <button key={v.id} onClick={() => setView(v.id)}
                className={`relative px-2.5 py-1.5 text-xs rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-all ${
                  active
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}>
                <Icon className="w-3.5 h-3.5" />
                {v.label}
                {showDot && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)] animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
        {canCreateTasks && (
          <button onClick={() => { setQuickAddStatus('todo'); setQuickAddOpen(true); }}
            className="px-3 py-1.5 text-xs rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-600 hover:to-blue-700 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> New Task
          </button>
        )}
      </div>

      {/* View body — focus mode happens INSIDE each view (no full-pane swap) */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="h-64 rounded-xl bg-slate-800/30 animate-pulse" />
        ) : (
          <>
            {view === 'board' && (
              <BoardView
                tasks={tasks}
                onTaskClick={onTaskClick}
                onTaskUpdated={onTaskUpdated}
                onTaskDeleted={onTaskDeleted}
                selectedTask={selectedTask}
                projectMembers={members}
                projectId={project.id}
                projectOwnerId={projectOwnerId}
                canCreate={canCreateTasks}
                canManage={canManageTasks}
                onAddTask={(colId) => { setQuickAddStatus(colId); setQuickAddOpen(true); }}
              />
            )}
            {view === 'list' && (
              <ListView
                tasks={tasks}
                onTaskClick={onTaskClick}
                onTaskUpdated={onTaskUpdated}
                onTaskDeleted={onTaskDeleted}
                onTaskCreated={onTaskCreated}
                selectedTask={selectedTask}
                projectId={project.id}
                projectMembers={members}
                projectOwnerId={projectOwnerId}
                canCreate={canCreateTasks}
              />
            )}
            {view === 'calendar' && (
              <CalendarView tasks={tasks} project={project} onTaskClick={onTaskClick} />
            )}
            {view === 'discussion' && (
              <div className="rounded-2xl border border-white/5 bg-slate-900/30 p-4">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-cyan-400" /> Project Discussion
                </h3>
                <CommentThread projectId={project.id} mentionableUsers={members} />
              </div>
            )}
          </>
        )}
      </div>

      {quickAddOpen && (
        <QuickAddTask projectId={project.id} defaultStatus={quickAddStatus} members={members}
          onCreated={(t) => onTaskCreated(t)} onClose={() => setQuickAddOpen(false)} />
      )}

      {settingsOpen && (
        <ProjectSettingsModal project={project} allUsers={allUsers}
          onClose={() => setSettingsOpen(false)} onUpdated={onProjectUpdated} onDeleted={onProjectDeleted} />
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          projectMembers={members}
          projectId={project.id}
          projectOwnerId={projectOwnerId}
          onClose={() => onTaskClick(null)}
          onUpdated={onTaskUpdated}
          onDeleted={onTaskDeleted}
        />
      )}
    </div>
  );
}

/* ---------- Task detail popup ---------- */

function TaskDetailModal({ task, projectMembers, projectId, projectOwnerId, onClose, onUpdated, onDeleted }) {
  // Close on Escape; lock body scroll while open.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md sm:max-w-lg h-[92vh] sm:h-auto sm:max-h-[88vh] rounded-t-2xl sm:rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-auto p-3 sm:p-4">
          <TaskFlowCards
            task={task}
            projectMembers={projectMembers}
            projectId={projectId}
            projectOwnerId={projectOwnerId}
            onClose={onClose}
            onUpdated={onUpdated}
            onDeleted={onDeleted}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------- Main page ---------- */

export default function ProjectsPage() {
  const { projectId: urlProjectId } = useParams();
  const [searchParams] = useSearchParams();
  const urlView = searchParams.get('view') || 'board';
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [projects, setProjects] = useState([]);
  const [taskStats, setTaskStats] = useState({});
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);

  // Selected project's task state (lifted so the left rail can render task detail)
  const [paneTasks, setPaneTasks] = useState([]);
  const [paneLoading, setPaneLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  // Per-user, per-project last-read state for the discussion view.
  // Stored in localStorage so the unread badge persists across reloads.
  // Shape: { [projectId]: { at: ISO string, count: number } }
  const discussionReadKey = useMemo(
    () => `projects.discussionRead.${user?.id || user?.email || 'anon'}`,
    [user?.id, user?.email]
  );
  const [discussionRead, setDiscussionRead] = useState(() => {
    try { return JSON.parse(localStorage.getItem(discussionReadKey) || '{}'); }
    catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem(discussionReadKey, JSON.stringify(discussionRead)); }
    catch { /* ignore quota */ }
  }, [discussionReadKey, discussionRead]);
  // Reload map when the active user changes
  useEffect(() => {
    try { setDiscussionRead(JSON.parse(localStorage.getItem(discussionReadKey) || '{}')); }
    catch { setDiscussionRead({}); }
  }, [discussionReadKey]);

  // Mark current discussion as read: snapshot the latest server count + now.
  // The project's current count is looked up from state at call time.
  const projectsRef = React.useRef(projects);
  useEffect(() => { projectsRef.current = projects; }, [projects]);
  const markDiscussionRead = useCallback((pid) => {
    if (!pid) return;
    const p = (projectsRef.current || []).find((x) => x.id === pid);
    setDiscussionRead((m) => ({
      ...m,
      [pid]: { at: new Date().toISOString(), count: p?.discussionCommentCount ?? 0 },
    }));
  }, []);

  // Unread count for a project's discussion. 0 = no badge.
  // Computed from total comments on the server minus the count at last read.
  // The sender's own comments don't count.
  const unreadDiscussionCount = (p) => {
    if (!p?.latestDiscussionAt) return 0;
    if (p.latestDiscussionBy && user?.id && String(p.latestDiscussionBy) === String(user.id)) return 0;
    const total = Number(p.discussionCommentCount || 0);
    const rec = discussionRead[p.id];
    const readCount = rec?.count ?? 0;
    const readAt = rec?.at ? new Date(rec.at) : null;
    // If never read, show the full count.
    if (!readAt) return total;
    // If the latest comment timestamp is older than our last-read mark, nothing new.
    if (new Date(p.latestDiscussionAt) <= readAt) return 0;
    return Math.max(1, total - readCount);
  };
  const hasUnreadDiscussion = (p) => unreadDiscussionCount(p) > 0;

  const loadProjects = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    const r = await projectService.list();
    if (r.success) {
      setProjects(r.projects);
      const results = await Promise.all(
        r.projects.map((p) => taskService.list(p.id).then((tr) => ({ pid: p.id, tasks: tr.tasks })))
      );
      const stats = {};
      results.forEach(({ pid, tasks }) => {
        stats[pid] = { total: tasks.length, done: tasks.filter((t) => t.status === 'done').length };
      });
      setTaskStats(stats);
    } else if (!silent) {
      toast.error(r.error || 'Failed to load');
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    loadProjects();
    // Everyone needs the user list so they can pick members when creating
    // their own projects (and owners can edit members in settings). Admins
    // get the full record (role, status, etc.); non-admins get the public
    // directory endpoint with just name/email/department.
    const fetchUsers = isAdmin ? userService.getAllUsers() : userService.getDirectory();
    fetchUsers.then((r) => {
      if (r.success) setAllUsers((r.users || []).filter((u) => u.isActive !== false));
    });
  }, [isAdmin]);

  // Silent auto-refresh: pause when tab hidden, also refresh on visibility return.
  // Fast cadence so the unread-discussion dot lights up within a few seconds.
  useEffect(() => {
    const REFRESH_MS = 6000;
    let timer = null;
    const tick = () => { if (!document.hidden) loadProjects({ silent: true }); };
    const start = () => { if (timer == null) timer = setInterval(tick, REFRESH_MS); };
    const stop = () => { if (timer != null) { clearInterval(timer); timer = null; } };
    const onVis = () => {
      if (document.hidden) stop();
      else { loadProjects({ silent: true }); start(); }
    };
    start();
    document.addEventListener('visibilitychange', onVis);
    return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      return true;
    });
  }, [projects, statusFilter]);

  // Resolve selected project from URL
  const selected = useMemo(() => {
    if (urlProjectId) return projects.find((p) => p.id === urlProjectId) || null;
    return null;
  }, [urlProjectId, projects]);

  // Auto-select first project when no URL selection and projects loaded (desktop only)
  useEffect(() => {
    if (!urlProjectId && filtered.length > 0 && typeof window !== 'undefined' && window.innerWidth >= 768) {
      navigate(`/projects/${filtered[0].id}`, { replace: true });
    }
  }, [urlProjectId, filtered, navigate]);

  // Silent refresh of selected project's tasks
  useEffect(() => {
    if (!selected) return;
    const REFRESH_MS = 20000;
    const tick = async () => {
      if (document.hidden) return;
      const r = await taskService.list(selected.id);
      if (r.success) setPaneTasks(r.tasks);
    };
    const timer = setInterval(tick, REFRESH_MS);
    return () => clearInterval(timer);
  }, [selected?.id]);

  // Load tasks whenever selected project changes; reset selected task
  useEffect(() => {
    if (!selected) { setPaneTasks([]); setSelectedTask(null); return; }
    let alive = true;
    setPaneLoading(true);
    setSelectedTask(null);
    taskService.list(selected.id).then((r) => {
      if (!alive) return;
      if (r.success) setPaneTasks(r.tasks);
      setPaneLoading(false);
    });
    return () => { alive = false; };
  }, [selected?.id]);

  const projectMembers = useMemo(() => {
    if (!selected) return [];
    const all = [selected.owner, ...(selected.members || [])].filter(Boolean);
    const seen = new Set();
    return all.filter((m) => { if (seen.has(m.id)) return false; seen.add(m.id); return true; });
  }, [selected]);

  const handleTaskUpdated = (u) => {
    setPaneTasks((arr) => arr.map((t) => (t.id === u.id ? u : t)));
    setSelectedTask((d) => (d && d.id === u.id ? u : d));
    // Refresh project stats
    setTaskStats((prev) => {
      if (!selected) return prev;
      const list = paneTasks.map((t) => (t.id === u.id ? u : t));
      return { ...prev, [selected.id]: { total: list.length, done: list.filter((x) => x.status === 'done').length } };
    });
  };
  const handleTaskDeleted = (id) => {
    setPaneTasks((arr) => arr.filter((t) => t.id !== id));
    setSelectedTask((d) => (d && d.id === id ? null : d));
  };
  const handleTaskCreated = (t) => {
    setPaneTasks((arr) => [...arr, t]);
    if (selected) {
      setTaskStats((prev) => {
        const cur = prev[selected.id] || { total: 0, done: 0 };
        return { ...prev, [selected.id]: { total: cur.total + 1, done: cur.done + (t.status === 'done' ? 1 : 0) } };
      });
    }
  };

  const selectProject = (p) => navigate(`/projects/${p.id}`);
  const navigateToView = (p, viewId) => {
    if (viewId === 'discussion') markDiscussionRead(p.id);
    navigate(`/projects/${p.id}?view=${viewId}`);
  };
  const clearSelection = () => navigate('/projects');

  return (
    <div className="h-[calc(100vh-8rem)] md:h-[calc(100vh-6rem)] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Zap className="w-6 h-6 text-cyan-400" />
          <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
            DevKitchen
          </h1>
          <span className="text-xs text-slate-500 hidden md:inline">
            · {projects.length} project{projects.length === 1 ? '' : 's'}
          </span>
        </div>
        <button onClick={() => setCreateOpen(true)}
          className="px-3 py-1.5 text-sm rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium flex items-center gap-1.5 shadow-lg shadow-cyan-500/20">
          <Plus className="w-4 h-4" /> New
        </button>
      </div>

      <div className="flex-1 min-h-0 flex gap-3 rounded-2xl border border-white/5 overflow-hidden bg-slate-950/40">
        {/* Left rail — project list */}
        <div className={`${selected ? 'hidden md:flex' : 'flex'} w-full md:w-50 lg:w-60 flex-shrink-0 flex-col border-r border-white/5`}>
          <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between gap-2">
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
              {filtered.length} project{filtered.length === 1 ? '' : 's'}
            </span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2 py-1 text-[11px] bg-slate-800/50 border border-white/10 rounded-md text-slate-300 focus:outline-none focus:border-cyan-400/50">
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="on-hold">On Hold</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <div key={i} className="h-12 rounded-lg bg-slate-800/30 animate-pulse" />
              ))
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Rocket className="w-10 h-10 text-slate-700 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No projects yet</p>
                <button onClick={() => setCreateOpen(true)} className="mt-3 text-xs text-cyan-400 hover:text-cyan-300">
                  + Create your first project
                </button>
              </div>
            ) : (
              filtered.map((p, i) => (
                <ProjectRow
                  key={p.id}
                  project={p}
                  stats={taskStats[p.id]}
                  hasUnreadDiscussion={hasUnreadDiscussion(p)}
                  unreadDiscussionCount={unreadDiscussionCount(p)}
                  selected={selected?.id === p.id}
                  onClick={() => selectProject(p)}
                  onNavigateToView={navigateToView}
                  currentView={urlView}
                  index={i}
                />
              ))
            )}
          </div>
        </div>

        {/* Right pane */}
        <div className={`${selected ? 'flex' : 'hidden md:flex'} flex-1 min-w-0`}>
          {selected ? (
            <ProjectPane
              key={selected.id}
              project={selected}
              allUsers={allUsers}
              initialView={urlView}
              tasks={paneTasks}
              loading={paneLoading}
              selectedTask={selectedTask}
              hasUnreadDiscussion={hasUnreadDiscussion(selected)}
              unreadDiscussionCount={unreadDiscussionCount(selected)}
              onMarkDiscussionRead={markDiscussionRead}
              onTaskClick={(t) => setSelectedTask((cur) => (cur && t && cur.id === t.id ? null : t))}
              onTaskUpdated={handleTaskUpdated}
              onTaskCreated={handleTaskCreated}
              onTaskDeleted={handleTaskDeleted}
              onBack={clearSelection}
              onProjectUpdated={(p) => setProjects((arr) => arr.map((x) => (x.id === p.id ? p : x)))}
              onProjectDeleted={() => {
                setProjects((arr) => arr.filter((x) => x.id !== selected.id));
                clearSelection();
              }}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center max-w-sm">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center">
                  <Rocket className="w-8 h-8 text-cyan-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">Select a project</h2>
                <p className="text-sm text-slate-400 mt-1">
                  Choose a project from the list to see tasks, comments, and discussions.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <CreateProjectModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(p) => {
          setProjects((prev) => [p, ...prev]);
          setTaskStats((prev) => ({ ...prev, [p.id]: { total: 0, done: 0 } }));
          navigate(`/projects/${p.id}`);
        }}
        users={allUsers}
      />
    </div>
  );
}
