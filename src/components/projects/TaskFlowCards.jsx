import React, { useEffect, useState } from 'react';
import {
  X, FileText, TrendingUp, ListChecks, MessageSquare,
  Calendar, Flag, Trash2, CheckSquare, Square, Plus, Tag, Lock, Check, RotateCcw,
} from 'lucide-react';
import { format, isPast } from 'date-fns';
import toast from 'react-hot-toast';
import Avatar from './Avatar';
import CommentThread from './CommentThread';
import MarkCompleteButton from './MarkCompleteButton';
import taskService from '../../services/taskService';
import { useAuth } from '../../contexts/AuthContext';
import ConfirmModal from '../ConfirmModal';

const STATUS_OPTIONS = [
  { value: 'todo', label: 'To Do', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  { value: 'in-progress', label: 'In Progress', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { value: 'review', label: 'Review', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  { value: 'done', label: 'Done', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
];
const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', dot: '#64748b' },
  { value: 'medium', label: 'Medium', dot: '#3b82f6' },
  { value: 'high', label: 'High', dot: '#f59e0b' },
  { value: 'urgent', label: 'Urgent', dot: '#ef4444' },
];

/* Card with same visual language as board stage columns. Height is
   content-driven (no flex-1) so each card collapses to its natural size.
   The pipeline is always vertical inside the popup. */
function FlowCard({ index, total, icon: Icon, label, accent, headerExtra, children }) {
  const isLast = index === total - 1;
  return (
    <>
      <div
        className="w-full rounded-2xl border bg-gradient-to-b from-slate-900/60 to-slate-950/30 backdrop-blur-sm flex flex-col overflow-hidden relative"
        style={{
          borderColor: 'rgba(255,255,255,0.06)',
          borderTopColor: `${accent}66`,
          borderTopWidth: 2,
        }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-0.5"
          style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
        />
        <div className="flex items-center justify-between gap-2 p-3 border-b border-white/5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] text-slate-500 font-bold tabular-nums">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide text-white"
              style={{
                background: `linear-gradient(135deg, ${accent}, ${accent}aa)`,
                boxShadow: `0 0 10px -4px ${accent}`,
              }}
            >
              <Icon className="w-3 h-3" />
              {label}
            </div>
          </div>
          {headerExtra}
        </div>
        <div className="p-3">{children}</div>
      </div>
      {!isLast && (
        <div className="flex flex-shrink-0 items-center justify-center w-full h-8 relative">
          <svg viewBox="0 0 40 56" className="relative h-7 w-7 rotate-90">
            <defs>
              <linearGradient id={`flow-${accent}-${index}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={accent} stopOpacity="0.5" />
                <stop offset="100%" stopColor={accent} stopOpacity="0.9" />
              </linearGradient>
            </defs>
            <path
              d="M2,8 L26,28 L2,48 L8,48 L34,28 L8,8 Z"
              fill={`url(#flow-${accent}-${index})`}
              stroke={accent}
              strokeOpacity="0.4"
              strokeWidth="1"
            />
          </svg>
        </div>
      )}
    </>
  );
}

/**
 * TaskFlowCards — horizontal pipeline of 4 cards (Overview, Progress, Subtasks, Discussion)
 * Continues the board's flow visually with the same arrow style.
 * Used inline inside Board / List / Calendar focus mode.
 */
export default function TaskFlowCards({ task, projectMembers, projectId, projectOwnerId, onClose, onUpdated, onDeleted, height = 'auto' }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [draft, setDraft] = useState(task || {});
  const [subtasks, setSubtasks] = useState([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    setDraft(task || {});
    if (task?.id) {
      taskService.listSubtasks(task.id).then((r) => {
        if (r.success) setSubtasks(r.subtasks);
      });
    }
  }, [task?.id]);

  // Keep status and progress in sync with the task prop when they change externally
  // (e.g. mark-complete from the board card updates the parent but draft only resets on id change).
  // Only status/progress are patched — text fields are left alone to avoid interrupting edits.
  useEffect(() => {
    if (!task) return;
    setDraft((d) => ({ ...d, status: task.status, progress: task.progress }));
  }, [task?.status, task?.progress]);

  if (!task) return null;

  const saveField = async (field, value) => {
    const prev = draft[field];
    setDraft((d) => ({ ...d, [field]: value }));
    // Optimistic: notify parent immediately so the board column updates at once.
    onUpdated({ ...task, ...draft, [field]: value });
    setSaving(true);
    const res = await taskService.update(task.id, { [field]: value });
    setSaving(false);
    if (res.success) {
      onUpdated(res.task);
    } else {
      // Rollback local draft and parent state.
      setDraft((d) => ({ ...d, [field]: prev }));
      onUpdated(task);
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
    const r = await taskService.createSubtask({ taskId: task.id, title: newSubtask.trim() });
    if (r.success) { setSubtasks((s) => [...s, r.subtask]); setNewSubtask(''); }
    else toast.error(r.error || 'Failed');
  };
  const toggleSubtask = async (s) => {
    const r = await taskService.updateSubtask(s.id, { completed: !s.completed });
    if (r.success) setSubtasks((arr) => arr.map((x) => (x.id === s.id ? r.subtask : x)));
  };
  const removeSubtask = async (id) => {
    const r = await taskService.removeSubtask(id);
    if (r.success) setSubtasks((arr) => arr.filter((x) => x.id !== id));
  };
  const deleteTask = () => setConfirmingDelete(true);
  const confirmDeleteTask = async () => {
    setConfirmingDelete(false);
    const r = await taskService.remove(task.id);
    if (r.success) { onDeleted(task.id); onClose(); }
    else toast.error(r.error || 'Delete failed');
  };

  const statusOpt = STATUS_OPTIONS.find((s) => s.value === draft.status) || STATUS_OPTIONS[0];
  const priorityOpt = PRIORITY_OPTIONS.find((p) => p.value === draft.priority) || PRIORITY_OPTIONS[1];
  const completedCount = subtasks.filter((s) => s.completed).length;

  const isExplicitAssignee = (draft.assigneeUserIds || []).some((u) => String(u) === String(user?.id));
  // The task creator gets the same mark-done / progress rights as an assignee.
  const isCreator = draft.createdByUserId && String(draft.createdByUserId) === String(user?.id);
  const isAssignee = isExplicitAssignee || isCreator;
  const isOwner = projectOwnerId && String(projectOwnerId) === String(user?.id);
  const inReview = draft.status === 'review';
  const isDone = draft.status === 'done';
  // Progress edits: in REVIEW or DONE → only owner/admin. Otherwise → assignee/owner/admin.
  const canEditProgress = (inReview || isDone)
    ? (isAdmin || isOwner)
    : (isAdmin || isAssignee || isOwner);
  // Mark complete (status→done): only from REVIEW, and only owner/admin.
  // Assignees move the task to REVIEW first; the owner approves there.
  const canMarkDone = inReview && (isAdmin || isOwner);
  // Reopen (done→in-progress): owner or admin only
  const canReopen = isAdmin || isOwner;
  // Edit any task field (title, description, status, priority, due, assignees, tags, delete):
  // owner or admin. Assignees cannot edit — only mark done / report progress.
  const canEdit = isAdmin || isOwner;
  const progress = Math.max(0, Math.min(100, Number(draft.progress) || 0));
  const setProgress = async (val) => {
    const v = Math.max(0, Math.min(100, Math.round(val)));
    setDraft((d) => ({ ...d, progress: v }));
    await saveField('progress', v);
  };
  const progressColor = progress >= 100 ? '#10b981' : progress >= 75 ? '#06b6d4' : progress >= 50 ? '#3b82f6' : progress >= 25 ? '#8b5cf6' : '#64748b';

  const assignees = (draft.assigneeUserIds || [])
    .map((id) => projectMembers.find((m) => m.id === id))
    .filter(Boolean);

  const due = draft.dueDate ? new Date(draft.dueDate) : null;
  const overdue = due && isPast(due) && draft.status !== 'done';

  const totalCards = 4;
  const containerStyle = height === 'auto' ? {} : { height };

  return (
    <div className="flex flex-col" style={containerStyle}>
      {/* Card 1 — OVERVIEW (also contains the task title + close button) */}
      <FlowCard
        index={0} total={totalCards} icon={FileText} label="OVERVIEW" accent="#06b6d4"
        width={360}
        headerExtra={
          <div className="flex items-center gap-1">
            {saving && <span className="text-[10px] text-cyan-400 animate-pulse">Saving...</span>}
            {canEdit && (
              <button onClick={deleteTask} className="p-1 rounded text-slate-400 hover:text-red-300 hover:bg-red-500/10" title="Delete task">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/5" title="Close">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        }
      >
        {/* Task title row */}
        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/5">
          <MarkCompleteButton task={draft} onUpdated={onUpdated} size="md" stopPropagation={false} projectOwnerId={projectOwnerId} />
          <input
            value={draft.title || ''}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            onBlur={(e) => { if (e.target.value !== task.title) saveField('title', e.target.value); }}
            readOnly={!canEdit}
            className={`flex-1 bg-transparent text-base font-bold focus:outline-none focus:bg-slate-800/30 rounded px-1 ${
              draft.status === 'done' ? 'line-through text-slate-500' : 'text-white'
            }`}
            placeholder="Task title"
          />
        </div>

        <label className="text-[10px] text-slate-500 uppercase tracking-wider">Description</label>
        <textarea
          value={draft.description || ''}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          onBlur={(e) => { if (e.target.value !== (task.description || '')) saveField('description', e.target.value); }}
          rows={4}
          readOnly={!canEdit}
          placeholder={canEdit ? 'What is this task about?' : 'No description'}
          className="mt-1.5 w-full bg-slate-800/50 border border-white/10 rounded-lg p-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/50 resize-none"
        />

        <div className="mt-3 pt-3 border-t border-white/5 space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-slate-500 flex items-center gap-1"><Flag className="w-3 h-3" /> Status</span>
            {canEdit ? (
              <select value={draft.status} onChange={(e) => saveField('status', e.target.value)}
                className="px-1.5 py-0.5 text-[11px] bg-slate-800/50 border border-white/10 rounded text-white focus:outline-none focus:border-cyan-400/50">
                {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            ) : (
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full border ${statusOpt.color}`}>{statusOpt.label}</span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-slate-500 flex items-center gap-1"><Flag className="w-3 h-3" /> Priority</span>
            {canEdit ? (
              <select value={draft.priority} onChange={(e) => saveField('priority', e.target.value)}
                className="px-1.5 py-0.5 text-[11px] bg-slate-800/50 border border-white/10 rounded text-white focus:outline-none focus:border-cyan-400/50">
                {PRIORITY_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: priorityOpt.dot }} /> {priorityOpt.label}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-slate-500 flex items-center gap-1"><Calendar className="w-3 h-3" /> Due</span>
            {canEdit ? (
              <input type="date" value={draft.dueDate ? format(new Date(draft.dueDate), 'yyyy-MM-dd') : ''}
                onChange={(e) => saveField('dueDate', e.target.value || null)}
                className="px-1.5 py-0.5 text-[11px] bg-slate-800/50 border border-white/10 rounded text-white focus:outline-none focus:border-cyan-400/50" />
            ) : (
              <span className={`text-[11px] ${overdue ? 'text-red-300' : 'text-slate-300'}`}>{due ? format(due, 'MMM d, yyyy') : '—'}</span>
            )}
          </div>
          <div>
            <div className="text-[10px] text-slate-500 mb-1">Assignees ({assignees.length})</div>
            {canEdit ? (
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {projectMembers.map((m) => {
                  const checked = (draft.assigneeUserIds || []).includes(m.id);
                  return (
                    <label key={m.id} className={`flex items-center gap-1.5 p-1 rounded cursor-pointer border transition-colors ${
                      checked ? 'bg-cyan-500/10 border-cyan-500/30' : 'border-white/5 hover:bg-white/5'
                    }`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleAssignee(m.id)} className="accent-cyan-500" />
                      <Avatar name={m.fullname || m.email} size={18} ringClass="" />
                      <span className="text-[11px] text-white flex-1 truncate">{m.fullname || m.email}</span>
                    </label>
                  );
                })}
              </div>
            ) : assignees.length === 0 ? (
              <p className="text-[11px] text-slate-500">No one assigned</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {assignees.map((a) => (
                  <span key={a.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800/50 text-[10px] text-slate-200">
                    <Avatar name={a.fullname || a.email} size={14} ringClass="" />
                    {a.fullname || a.email}
                  </span>
                ))}
              </div>
            )}
          </div>
          {(canEdit || (draft.tags || []).length > 0) && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-500 flex items-center gap-1"><Tag className="w-3 h-3" /> Tags</span>
              {canEdit ? (
                <input type="text" value={(draft.tags || []).join(', ')}
                  onChange={(e) => setDraft({ ...draft, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
                  onBlur={(e) => saveField('tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))}
                  placeholder="comma, separated"
                  className="px-1.5 py-0.5 text-[11px] bg-slate-800/50 border border-white/10 rounded text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/50 max-w-[160px]" />
              ) : (
                <div className="flex flex-wrap gap-1 justify-end">
                  {(draft.tags || []).map((t) => (
                    <span key={t} className="text-[10px] px-1 py-0.5 rounded bg-cyan-500/10 text-cyan-300">{t}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </FlowCard>

      {/* Card 2 — SUBTASKS */}
      <FlowCard index={1} total={totalCards} icon={ListChecks} label={`SUBTASKS · ${completedCount}/${subtasks.length}`} accent="#f59e0b" width={320}>
        <div className="space-y-1">
          {subtasks.length === 0 && (
            <p className="text-[11px] text-slate-500 py-1 text-center">No subtasks yet</p>
          )}
          {subtasks.map((s) => (
            <div key={s.id} className="group flex items-center gap-2 p-1.5 rounded hover:bg-white/5">
              <button disabled={!canEdit} onClick={() => canEdit && toggleSubtask(s)}
                className={`text-cyan-400 ${canEdit ? 'hover:text-cyan-300' : 'opacity-50 cursor-not-allowed'}`}>
                {s.completed ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              </button>
              <span className={`flex-1 text-xs ${s.completed ? 'line-through text-slate-500' : 'text-white'}`}>{s.title}</span>
              {canEdit && (
                <button onClick={() => removeSubtask(s.id)}
                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
        {canEdit && (
          <div className="flex gap-1 pt-2 mt-2 border-t border-white/5">
            <input value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSubtask()}
              placeholder="Add a subtask..."
              className="flex-1 px-2 py-1 bg-slate-800/50 border border-white/10 rounded-lg text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-400/50" />
            <button onClick={addSubtask}
              className="px-2 py-1 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs hover:from-cyan-600 hover:to-blue-700 flex items-center">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </FlowCard>

      {/* Card 3 — PROGRESS */}
      <FlowCard index={2} total={totalCards} icon={TrendingUp} label="PROGRESS" accent="#8b5cf6" width={340}>
        <div className="text-center mb-2">
          <div className="text-5xl font-bold tabular-nums leading-none" style={{ color: progressColor }}>{progress}%</div>
          <p className="mt-2 text-[10px] text-slate-400">
            {progress === 0 ? 'Not started' :
             isDone ? 'Complete' :
             inReview ? 'Awaiting owner review' :
             progress < 100 ? 'In progress' : 'Ready for review'}
          </p>
          {!canEditProgress && (
            <p className="mt-1 text-[10px] text-slate-500 flex items-center justify-center gap-0.5">
              <Lock className="w-3 h-3" />
              {inReview ? 'only owner / admin can adjust' : isDone ? 'reopen first to edit' : 'read-only'}
            </p>
          )}
        </div>
        <div className="relative h-2.5 rounded-full bg-slate-800/60 overflow-hidden border border-white/5">
          <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
            style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${progressColor}, ${progressColor}aa)`, boxShadow: `0 0 12px -2px ${progressColor}` }} />
        </div>
        <input type="range" min="0" max="100" step="5" value={progress} disabled={!canEditProgress}
          onChange={(e) => setDraft((d) => ({ ...d, progress: Number(e.target.value) }))}
          onMouseUp={(e) => canEditProgress && setProgress(Number(e.target.value))}
          onTouchEnd={(e) => canEditProgress && setProgress(Number(e.target.value))}
          onKeyUp={(e) => canEditProgress && setProgress(Number(e.target.value))}
          className="mt-2 w-full accent-cyan-500 disabled:opacity-50" />
        <div className="mt-2 grid grid-cols-5 gap-1">
          {[0, 25, 50, 75, 100].map((p) => (
            <button key={p} type="button" disabled={!canEditProgress} onClick={() => setProgress(p)}
              className={`py-1 text-[10px] rounded-md border font-medium transition-all ${
                progress === p ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-200'
                  : 'bg-slate-900/40 border-white/5 text-slate-300 hover:border-white/15'
              } disabled:opacity-40 disabled:cursor-not-allowed`}>
              {p}%
            </button>
          ))}
        </div>
        {/* Bottom action: Mark Complete (anyone allowed), or Reopen (owner/admin only) when task is done */}
        <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
          {isDone && canReopen && (
            <button type="button"
              onClick={async () => {
                const next = { progress: 75, status: 'in-progress' };
                setDraft((d) => ({ ...d, ...next }));
                onUpdated({ ...task, ...draft, ...next });
                const r = await taskService.update(task.id, next);
                if (r.success) onUpdated(r.task);
                else { setDraft((d) => ({ ...d, ...task })); onUpdated(task); toast.error(r.error || 'Failed'); }
              }}
              className="w-full px-3 py-2 text-xs rounded-lg bg-slate-800/60 border border-white/10 text-slate-300 hover:bg-slate-700 flex items-center justify-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" /> Reopen Task
            </button>
          )}
          {!isDone && canMarkDone && (
            <button type="button"
              onClick={async () => {
                const next = { progress: 100, status: 'done' };
                setDraft((d) => ({ ...d, ...next }));
                onUpdated({ ...task, ...draft, ...next });
                const r = await taskService.update(task.id, next);
                if (r.success) { onUpdated(r.task); toast.success('Marked complete'); }
                else { setDraft((d) => ({ ...d, ...task })); onUpdated(task); toast.error(r.error || 'Failed'); }
              }}
              className="w-full px-3 py-2.5 text-sm rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold flex items-center justify-center gap-2 shadow-[0_0_18px_-3px_rgba(16,185,129,0.6)]">
              <Check className="w-4 h-4" strokeWidth={3} /> {inReview ? 'Approve & Mark Complete' : 'Mark Complete'}
            </button>
          )}
        </div>
      </FlowCard>

      {/* Card 4 — DISCUSSION */}
      <FlowCard index={3} total={totalCards} icon={MessageSquare} label="DISCUSSION" accent="#10b981" width={400}>
        <CommentThread projectId={projectId} taskId={task.id} mentionableUsers={projectMembers} />
      </FlowCard>

      <ConfirmModal
        open={confirmingDelete}
        title="Delete this task?"
        message="This will permanently remove the task along with all its subtasks and comments. This action cannot be undone."
        confirmLabel="Delete task"
        variant="danger"
        onConfirm={confirmDeleteTask}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}
