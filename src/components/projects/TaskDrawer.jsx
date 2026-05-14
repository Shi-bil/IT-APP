import React, { useEffect, useState } from 'react';
import {
  X, Calendar, Flag, User as UserIcon, Trash2, CheckSquare, Square, Plus, MessageSquare, Tag,
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import Avatar from './Avatar';
import CommentThread from './CommentThread';
import taskService from '../../services/taskService';
import { useAuth } from '../../contexts/AuthContext';

const STATUS_OPTIONS = [
  { value: 'todo', label: 'To Do', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  { value: 'in-progress', label: 'In Progress', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { value: 'review', label: 'Review', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  { value: 'done', label: 'Done', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: 'text-slate-300' },
  { value: 'medium', label: 'Medium', color: 'text-blue-300' },
  { value: 'high', label: 'High', color: 'text-amber-300' },
  { value: 'urgent', label: 'Urgent', color: 'text-red-300' },
];

export default function TaskDrawer({ task, open, onClose, projectMembers, onUpdated, onDeleted, projectId }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [draft, setDraft] = useState(task || {});
  const [subtasks, setSubtasks] = useState([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('details');

  useEffect(() => {
    setDraft(task || {});
    setTab('details');
    if (task?.id) {
      taskService.listSubtasks(task.id).then((r) => {
        if (r.success) setSubtasks(r.subtasks);
      });
    }
  }, [task?.id]);

  if (!open || !task) return null;

  const saveField = async (field, value) => {
    setDraft((d) => ({ ...d, [field]: value }));
    setSaving(true);
    const res = await taskService.update(task.id, { [field]: value });
    setSaving(false);
    if (res.success) {
      onUpdated(res.task);
    } else {
      toast.error(res.error || 'Update failed');
    }
  };

  const toggleAssignee = async (uid) => {
    const cur = draft.assigneeUserIds || [];
    const next = cur.includes(uid) ? cur.filter((x) => x !== uid) : [...cur, uid];
    await saveField('assigneeUserIds', next);
  };

  const addSubtask = async () => {
    if (!newSubtask.trim()) return;
    const res = await taskService.createSubtask({ taskId: task.id, title: newSubtask.trim() });
    if (res.success) {
      setSubtasks((s) => [...s, res.subtask]);
      setNewSubtask('');
    } else {
      toast.error(res.error || 'Failed to add');
    }
  };

  const toggleSubtask = async (s) => {
    const res = await taskService.updateSubtask(s.id, { completed: !s.completed });
    if (res.success) setSubtasks((arr) => arr.map((x) => (x.id === s.id ? res.subtask : x)));
  };

  const removeSubtask = async (id) => {
    const res = await taskService.removeSubtask(id);
    if (res.success) setSubtasks((arr) => arr.filter((x) => x.id !== id));
  };

  const deleteTask = async () => {
    if (!confirm('Delete this task and all its subtasks/comments?')) return;
    const res = await taskService.remove(task.id);
    if (res.success) {
      onDeleted(task.id);
      onClose();
    } else {
      toast.error(res.error || 'Delete failed');
    }
  };

  const statusOpt = STATUS_OPTIONS.find((s) => s.value === draft.status) || STATUS_OPTIONS[0];
  const completedCount = subtasks.filter((s) => s.completed).length;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[55]" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full md:w-[560px] bg-gradient-to-b from-slate-900 to-slate-950 border-l border-white/10 shadow-2xl z-[60] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full border ${statusOpt.color}`}>{statusOpt.label}</span>
            {saving && <span className="text-[11px] text-slate-500">Saving...</span>}
          </div>
          <div className="flex items-center gap-1">
            {isAdmin && (
              <button onClick={deleteTask} className="p-2 rounded-lg text-slate-400 hover:text-red-300 hover:bg-red-500/10">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-4 pt-4">
          <input
            value={draft.title || ''}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            onBlur={(e) => { if (e.target.value !== task.title) saveField('title', e.target.value); }}
            className="w-full bg-transparent text-xl font-semibold text-white focus:outline-none focus:bg-slate-800/30 rounded px-1 -mx-1"
            placeholder="Task title"
          />
        </div>

        <div className="px-4 mt-2 flex gap-1 border-b border-white/5">
          {[
            { id: 'details', label: 'Details' },
            { id: 'subtasks', label: `Subtasks (${completedCount}/${subtasks.length})` },
            { id: 'comments', label: 'Discussion', icon: MessageSquare },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-sm border-b-2 transition-colors ${
                tab === t.id ? 'border-cyan-400 text-white' : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {tab === 'details' && (
            <>
              <div>
                <label className="text-xs text-slate-400">Description</label>
                <textarea
                  value={draft.description || ''}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  onBlur={(e) => { if (e.target.value !== (task.description || '')) saveField('description', e.target.value); }}
                  rows={4}
                  placeholder="Add a description..."
                  className="mt-1 w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-400/50 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 flex items-center gap-1"><Flag className="w-3 h-3" /> Status</label>
                  <select
                    value={draft.status}
                    onChange={(e) => saveField('status', e.target.value)}
                    className="mt-1 w-full px-2 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-400/50"
                  >
                    {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 flex items-center gap-1"><Flag className="w-3 h-3" /> Priority</label>
                  <select
                    value={draft.priority}
                    onChange={(e) => saveField('priority', e.target.value)}
                    className="mt-1 w-full px-2 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-400/50"
                  >
                    {PRIORITY_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 flex items-center gap-1"><Calendar className="w-3 h-3" /> Start Date</label>
                  <input
                    type="date"
                    value={draft.startDate ? format(new Date(draft.startDate), 'yyyy-MM-dd') : ''}
                    onChange={(e) => saveField('startDate', e.target.value || null)}
                    className="mt-1 w-full px-2 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-400/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 flex items-center gap-1"><Calendar className="w-3 h-3" /> Due Date</label>
                  <input
                    type="date"
                    value={draft.dueDate ? format(new Date(draft.dueDate), 'yyyy-MM-dd') : ''}
                    onChange={(e) => saveField('dueDate', e.target.value || null)}
                    className="mt-1 w-full px-2 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-400/50"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 flex items-center gap-1"><UserIcon className="w-3 h-3" /> Assignees</label>
                <div className="mt-1 max-h-44 overflow-y-auto border border-white/10 rounded-lg p-2 bg-slate-800/30 space-y-0.5">
                  {projectMembers.length === 0 && <p className="text-xs text-slate-500 p-2">No members in this project</p>}
                  {projectMembers.map((m) => {
                    const checked = (draft.assigneeUserIds || []).includes(m.id);
                    return (
                      <label key={m.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-white/5 cursor-pointer">
                        <input type="checkbox" checked={checked} onChange={() => toggleAssignee(m.id)} className="accent-cyan-500" />
                        <Avatar name={m.fullname || m.email} size={24} ringClass="" />
                        <span className="text-sm text-white flex-1 truncate">{m.fullname || m.email}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 flex items-center gap-1"><Tag className="w-3 h-3" /> Tags</label>
                <input
                  type="text"
                  value={(draft.tags || []).join(', ')}
                  onChange={(e) => setDraft({ ...draft, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
                  onBlur={(e) => {
                    const tags = e.target.value.split(',').map((t) => t.trim()).filter(Boolean);
                    saveField('tags', tags);
                  }}
                  placeholder="comma, separated, tags"
                  className="mt-1 w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-400/50"
                />
              </div>
            </>
          )}

          {tab === 'subtasks' && (
            <div className="space-y-2">
              <div className="space-y-1">
                {subtasks.length === 0 && (
                  <p className="text-sm text-slate-500 py-3 text-center">No subtasks yet</p>
                )}
                {subtasks.map((s) => (
                  <div key={s.id} className="group flex items-center gap-2 p-2 rounded hover:bg-white/5">
                    <button onClick={() => toggleSubtask(s)} className="text-cyan-400 hover:text-cyan-300">
                      {s.completed ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                    </button>
                    <span className={`flex-1 text-sm ${s.completed ? 'line-through text-slate-500' : 'text-white'}`}>
                      {s.title}
                    </span>
                    <button
                      onClick={() => removeSubtask(s.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-2 border-t border-white/5">
                <input
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addSubtask()}
                  placeholder="Add a subtask..."
                  className="flex-1 px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-400/50"
                />
                <button
                  onClick={addSubtask}
                  className="px-3 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm hover:from-cyan-600 hover:to-blue-700 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
            </div>
          )}

          {tab === 'comments' && (
            <CommentThread
              projectId={projectId}
              taskId={task.id}
              mentionableUsers={projectMembers}
            />
          )}
        </div>
      </div>
    </>
  );
}
