import React, { useState, useMemo, useEffect } from 'react';
import {
  ChevronDown, ChevronRight, Calendar, Plus, GitBranch, CheckCircle2, Circle, Loader2, Eye, Trash2,
} from 'lucide-react';
import { format, isPast } from 'date-fns';
import toast from 'react-hot-toast';
import Avatar from '../Avatar';
import MarkCompleteButton from '../MarkCompleteButton';
import TaskFlowCards from '../TaskFlowCards';
import taskService from '../../../services/taskService';
import { useAuth } from '../../../contexts/AuthContext';

const STATUS_GROUPS = [
  { id: 'todo', label: 'TO DO', pillClass: 'bg-slate-600 text-white', iconColor: '#94a3b8', Icon: Circle },
  { id: 'in-progress', label: 'IN PROGRESS', pillClass: 'bg-blue-500 text-white', iconColor: '#3b82f6', Icon: Loader2 },
  { id: 'review', label: 'IN REVIEW', pillClass: 'bg-purple-500 text-white', iconColor: '#8b5cf6', Icon: Eye },
  { id: 'done', label: 'DONE', pillClass: 'bg-emerald-500 text-white', iconColor: '#10b981', Icon: CheckCircle2 },
];

const PRIORITY_DOT = {
  low: 'bg-slate-400',
  medium: 'bg-blue-400',
  high: 'bg-amber-400',
  urgent: 'bg-red-500',
};

function SubtaskRow({ subtask, onToggle, onDelete, canEdit }) {
  return (
    <div className="group flex items-center gap-2 pl-12 pr-3 py-1.5 hover:bg-white/[0.03] transition-colors">
      <button
        onClick={onToggle}
        disabled={!canEdit}
        className={`w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center transition-all ${
          subtask.completed
            ? 'bg-emerald-500 border-emerald-400'
            : 'border-slate-500 hover:border-emerald-400'
        } ${!canEdit ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        {subtask.completed && <CheckCircle2 className="w-3 h-3 text-white" strokeWidth={3} />}
      </button>
      <span className={`flex-1 text-sm truncate ${subtask.completed ? 'line-through text-slate-500' : 'text-slate-300'}`}>
        {subtask.title}
      </span>
      {canEdit && (
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400"
          title="Remove subtask"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function TaskRow({ task, onTaskClick, onTaskUpdated, depth = 0, projectOwnerId }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isOwner = projectOwnerId && String(projectOwnerId) === String(user?.id);
  // Only the project owner or an admin can edit subtasks. Assignees cannot.
  const canEditSubtasks = isAdmin || isOwner;

  const [expanded, setExpanded] = useState(false);
  const [subtasks, setSubtasks] = useState(null); // null = unloaded
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [newSubtask, setNewSubtask] = useState('');
  const [savingSub, setSavingSub] = useState(false);

  const due = task.dueDate ? new Date(task.dueDate) : null;
  const overdue = due && isPast(due) && task.status !== 'done';

  const loadSubtasks = async () => {
    if (subtasks !== null) return;
    setLoadingSubs(true);
    const r = await taskService.listSubtasks(task.id);
    setLoadingSubs(false);
    if (r.success) setSubtasks(r.subtasks);
  };

  const toggleExpand = async (e) => {
    e.stopPropagation();
    if (!expanded && subtasks === null) await loadSubtasks();
    setExpanded((v) => !v);
  };

  const addSubtask = async (e) => {
    e?.preventDefault?.();
    if (!newSubtask.trim() || savingSub) return;
    setSavingSub(true);
    const r = await taskService.createSubtask({ taskId: task.id, title: newSubtask.trim() });
    setSavingSub(false);
    if (r.success) {
      setSubtasks((arr) => [...(arr || []), r.subtask]);
      setNewSubtask('');
    } else {
      toast.error(r.error || 'Failed to add subtask');
    }
  };

  const toggleSub = async (s) => {
    const r = await taskService.updateSubtask(s.id, { completed: !s.completed });
    if (r.success) setSubtasks((arr) => arr.map((x) => (x.id === s.id ? r.subtask : x)));
  };

  const removeSub = async (id) => {
    const r = await taskService.removeSubtask(id);
    if (r.success) setSubtasks((arr) => arr.filter((x) => x.id !== id));
  };

  const subtaskCount = subtasks?.length;

  return (
    <>
      <div
        onClick={() => onTaskClick(task)}
        className="group flex items-center gap-2 pr-3 py-2 hover:bg-white/[0.04] cursor-pointer border-b border-white/[0.03] transition-colors"
        style={{ paddingLeft: 12 + depth * 24 }}
      >
        {/* Expand arrow */}
        <button
          onClick={toggleExpand}
          className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-cyan-300 flex-shrink-0"
          title={expanded ? 'Collapse subtasks' : 'Show subtasks'}
        >
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {/* Mark-complete circle */}
        <div onClick={(e) => e.stopPropagation()}>
          <MarkCompleteButton task={task} onUpdated={onTaskUpdated} size="sm" projectOwnerId={projectOwnerId} />
        </div>

        {/* Priority dot */}
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[task.priority] || PRIORITY_DOT.medium}`} />

        {/* Title + subtask count badge */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className={`text-sm truncate ${task.status === 'done' ? 'line-through text-slate-500' : 'text-white'}`}>
            {task.title}
          </span>
          {typeof subtaskCount === 'number' && subtaskCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 bg-slate-800/60 px-1.5 py-0.5 rounded">
              <GitBranch className="w-2.5 h-2.5" />
              {subtaskCount}
            </span>
          )}
        </div>

        {/* Progress mini — always visible so it stays in place as it fills */}
        <div className="hidden md:flex items-center gap-1.5 w-24">
          <div className="flex-1 h-1.5 rounded-full bg-white/[0.07] overflow-hidden border border-white/5">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${task.progress || 0}%`,
                background: (task.progress || 0) >= 100 ? '#10b981' : (task.progress || 0) >= 50 ? '#06b6d4' : (task.progress || 0) > 0 ? '#8b5cf6' : 'transparent',
              }}
            />
          </div>
          <span className="text-[10px] tabular-nums text-slate-500 w-8 text-right">{task.progress || 0}%</span>
        </div>

        {/* Due date */}
        {due && (
          <span className={`hidden md:flex items-center gap-1 text-[11px] ${overdue ? 'text-red-300' : 'text-slate-400'}`}>
            <Calendar className="w-3 h-3" />
            {format(due, 'MMM d')}
          </span>
        )}

        {/* Assignees */}
        <div className="flex -space-x-1.5 flex-shrink-0 w-16 justify-end">
          {(task.assignees || []).slice(0, 3).map((a) => (
            <Avatar key={a.id} name={a.fullname || a.email} size={22} ringClass="ring-2 ring-slate-950" />
          ))}
        </div>
      </div>

      {/* Subtasks */}
      {expanded && (
        <div className="bg-slate-950/30 border-b border-white/[0.03]">
          {loadingSubs && (
            <div className="pl-12 pr-3 py-2 text-xs text-slate-500">Loading subtasks...</div>
          )}
          {!loadingSubs && subtasks?.length === 0 && (
            <div className="pl-12 pr-3 py-1 text-xs text-slate-600">No subtasks</div>
          )}
          {!loadingSubs && subtasks?.map((s) => (
            <SubtaskRow
              key={s.id}
              subtask={s}
              canEdit={canEditSubtasks}
              onToggle={() => toggleSub(s)}
              onDelete={() => removeSub(s.id)}
            />
          ))}
          {!loadingSubs && canEditSubtasks && (
            <form onSubmit={addSubtask} className="flex items-center gap-2 pl-12 pr-3 py-1.5">
              <Plus className="w-3.5 h-3.5 text-slate-500" />
              <input
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                placeholder="Add subtask"
                className="flex-1 bg-transparent text-xs text-slate-300 placeholder-slate-600 focus:outline-none"
              />
              {newSubtask.trim() && (
                <button
                  type="submit"
                  disabled={savingSub}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 disabled:opacity-50"
                >
                  {savingSub ? '...' : 'Add'}
                </button>
              )}
            </form>
          )}
        </div>
      )}
    </>
  );
}

function StatusGroup({
  status, tasks, defaultOpen, onTaskClick, onTaskUpdated, onTaskDeleted, onAddTask, canCreate,
  selectedTask, projectMembers, projectId, projectOwnerId,
}) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const meta = STATUS_GROUPS.find((g) => g.id === status) || STATUS_GROUPS.find((g) => g.id === 'todo');
  const { Icon } = meta;

  const submitAdd = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || saving) return;
    setSaving(true);
    await onAddTask({ title: newTitle.trim(), status });
    setSaving(false);
    setNewTitle('');
    setAdding(false);
  };

  return (
    <div className="mb-3">
      {/* Group header pill */}
      <div className="flex items-center gap-2 mb-1.5">
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-slate-400 hover:text-white p-0.5"
        >
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide ${meta.pillClass}`}>
          <Icon className="w-3.5 h-3.5" />
          {meta.label}
        </div>
        <span className="text-sm text-slate-400 tabular-nums">{tasks.length}</span>
      </div>

      {/* Rows */}
      {open && (
        <div className="rounded-xl border border-white/5 bg-slate-900/30 overflow-hidden">
          {tasks.length === 0 && !adding && (
            <div className="px-4 py-3 text-xs text-slate-600">No tasks</div>
          )}
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onTaskClick={onTaskClick}
              onTaskUpdated={onTaskUpdated}
              projectOwnerId={projectOwnerId}
            />
          ))}

          {canCreate && (
            adding ? (
              <form onSubmit={submitAdd} className="flex items-center gap-2 px-3 py-2 border-t border-white/5 bg-slate-950/40">
                <Plus className="w-4 h-4 text-cyan-400 ml-5" />
                <input
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onBlur={() => { if (!newTitle.trim()) setAdding(false); }}
                  placeholder="Task name. Press Enter to save."
                  className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
                />
                {newTitle.trim() && (
                  <button type="submit" disabled={saving} className="text-xs text-cyan-400 hover:text-cyan-300 disabled:opacity-50">
                    {saving ? '...' : 'Add'}
                  </button>
                )}
              </form>
            ) : (
              <button
                onClick={() => setAdding(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:text-cyan-300 hover:bg-white/[0.03] border-t border-white/5 transition-colors"
              >
                <Plus className="w-4 h-4 ml-5" />
                Add task
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

export default function ListView({
  tasks, onTaskClick, onTaskUpdated, onTaskCreated, onTaskDeleted,
  selectedTask, projectId, projectMembers, projectOwnerId, canCreate = true,
}) {
  const grouped = useMemo(() => {
    const map = {};
    for (const g of STATUS_GROUPS) map[g.id] = [];
    for (const t of tasks) {
      const key = map[t.status] ? t.status : 'todo';
      map[key].push(t);
    }
    // sort each group by createdAt desc / due asc
    for (const g of Object.values(map)) {
      g.sort((a, b) => {
        const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return da - db;
      });
    }
    return map;
  }, [tasks]);

  const handleAddTask = async ({ title, status }) => {
    const r = await taskService.create({ projectId, title, status, priority: 'medium' });
    if (r.success) {
      onTaskCreated?.(r.task);
      toast.success('Task added');
    } else {
      toast.error(r.error || 'Failed to add task');
    }
  };

  return (
    <div>
      {STATUS_GROUPS.map((g) => (
        <StatusGroup
          key={g.id}
          status={g.id}
          tasks={grouped[g.id]}
          defaultOpen={g.id !== 'done'}
          onTaskClick={onTaskClick}
          onTaskUpdated={onTaskUpdated}
          onTaskDeleted={onTaskDeleted}
          onAddTask={handleAddTask}
          canCreate={canCreate}
          selectedTask={selectedTask}
          projectId={projectId}
          projectMembers={projectMembers}
          projectOwnerId={projectOwnerId}
        />
      ))}
    </div>
  );
}
