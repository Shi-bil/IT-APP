import React, { useState } from 'react';
import { Plus, Calendar, CheckCircle2, Loader2, Eye, Circle } from 'lucide-react';
import { format, isPast } from 'date-fns';
import Avatar from '../Avatar';
import MarkCompleteButton from '../MarkCompleteButton';
import TaskFlowCards from '../TaskFlowCards';
import taskService from '../../../services/taskService';
import toast from 'react-hot-toast';

const STAGES = [
  { id: 'todo',        label: 'TO DO',       accent: '#94a3b8', bg: 'from-slate-500/10 to-slate-700/5',   pill: 'bg-slate-600 text-white',    Icon: Circle },
  { id: 'in-progress', label: 'IN PROGRESS', accent: '#3b82f6', bg: 'from-blue-500/15 to-cyan-600/5',     pill: 'bg-blue-500 text-white',     Icon: Loader2 },
  { id: 'review',      label: 'REVIEW',      accent: '#8b5cf6', bg: 'from-purple-500/15 to-fuchsia-600/5',pill: 'bg-purple-500 text-white',   Icon: Eye },
  { id: 'done',        label: 'DONE',        accent: '#10b981', bg: 'from-emerald-500/15 to-teal-600/5',  pill: 'bg-emerald-500 text-white',  Icon: CheckCircle2 },
];

const PRIORITY_COLORS = { low: '#64748b', medium: '#3b82f6', high: '#f59e0b', urgent: '#ef4444' };

function TaskCard({ task, onClick, onDragStart, onUpdated, isSelected, projectOwnerId, draggable: dragEnabled = true }) {
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const overdue = due && isPast(due) && task.status !== 'done';
  const assignees = (task.assignees || []).slice(0, 3);
  return (
    <div
      draggable={dragEnabled}
      onDragStart={(e) => dragEnabled && onDragStart(e, task)}
      onClick={() => onClick(task)}
      className={`group cursor-pointer p-2 sm:p-2.5 rounded-lg border transition-all ${
        isSelected
          ? 'bg-cyan-500/10 border-cyan-400/50 shadow-[0_0_14px_-6px_rgba(6,182,212,0.5)]'
          : 'bg-slate-800/60 border-white/5 hover:border-cyan-400/40 hover:bg-slate-800/80'
      }`}
    >
      <div className="flex items-start gap-1.5 sm:gap-2">
        <div className="w-0.5 self-stretch rounded-full flex-shrink-0" style={{ background: PRIORITY_COLORS[task.priority] || '#64748b' }} />
        <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0 pt-0.5">
          <MarkCompleteButton task={task} onUpdated={onUpdated} size="sm" projectOwnerId={projectOwnerId} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-xs sm:text-sm font-medium line-clamp-2 leading-snug ${task.status === 'done' ? 'line-through text-slate-500' : 'text-white'}`}>
            {task.title}
          </p>
          {task.description && <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{task.description}</p>}
          {due && (
            <div className="mt-1.5">
              <span className={`text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1 ${
                overdue ? 'bg-red-500/15 text-red-300' : 'bg-slate-700/50 text-slate-300'
              }`}>
                <Calendar className="w-3 h-3" />
                {format(due, 'MMM d')}
              </span>
            </div>
          )}
          <div className="mt-1.5 flex items-center gap-1.5">
            <div className="flex-1 h-1 rounded-full bg-white/[0.07] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${task.progress || 0}%`,
                  background: (task.progress || 0) >= 100 ? '#10b981' : (task.progress || 0) >= 50 ? '#06b6d4' : (task.progress || 0) > 0 ? '#8b5cf6' : 'transparent',
                }}
              />
            </div>
            <span className="text-[10px] tabular-nums text-slate-400 w-7 text-right">{task.progress || 0}%</span>
          </div>
          {assignees.length > 0 && (
            <div className="flex items-center justify-end mt-1.5">
              <div className="flex -space-x-1.5">
                {assignees.map((a) => (
                  <Avatar key={a.id} name={a.fullname || a.email} size={18} ringClass="ring-2 ring-slate-800" />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* Slim gradient arrow between stages */
function StageArrow({ leftColor, rightColor, dim }) {
  return (
    <div className="flex-shrink-0 flex items-center justify-center w-6 sm:w-10 self-stretch relative">
      <svg width="32" height="44" viewBox="0 0 40 56" className="relative" style={{ opacity: dim ? 0.4 : 0.9 }}>
        <defs>
          <linearGradient id={`bArrow-${leftColor}-${rightColor}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={leftColor} stopOpacity="0.5" />
            <stop offset="100%" stopColor={rightColor} stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <path d="M2,8 L26,28 L2,48 L8,48 L34,28 L8,8 Z"
          fill={`url(#bArrow-${leftColor}-${rightColor})`} stroke={rightColor} strokeOpacity="0.4" strokeWidth="1" />
      </svg>
    </div>
  );
}

/* Collapsed stage: vertical thin strip */
function CollapsedStage({ stage, count, onClick }) {
  const Icon = stage.Icon;
  return (
    <button
      onClick={onClick}
      className="w-14 flex-shrink-0 rounded-2xl border bg-gradient-to-b transition-all relative overflow-hidden hover:bg-slate-800/60 group"
      style={{
        background: `linear-gradient(to bottom, ${stage.accent}15, transparent)`,
        borderColor: 'rgba(255,255,255,0.05)',
        borderTopColor: `${stage.accent}44`,
        borderTopWidth: 2,
      }}
      title={`${stage.label} (${count}) — click to exit focus`}
    >
      <div
        className="absolute top-0 left-0 right-0 h-0.5"
        style={{ background: `linear-gradient(90deg, transparent, ${stage.accent}, transparent)` }}
      />
      <div className="flex flex-col items-center gap-3 p-3 h-full">
        <div className="p-1.5 rounded-md" style={{ background: `${stage.accent}25` }}>
          <Icon className="w-4 h-4" style={{ color: stage.accent }} />
        </div>
        <div
          className="text-[10px] font-bold tracking-widest text-slate-300 group-hover:text-white"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          {stage.label}
        </div>
        <span className="mt-auto text-xs tabular-nums text-slate-400">{count}</span>
      </div>
    </button>
  );
}

/* Normal stage column (default render) */
function StageColumn({ stage, tasks, isDragOver, canCreate, canManage, onAddTask, onDragOver, onDragLeave, onDrop, onTaskClick, onTaskUpdated, onDragStart, selectedTaskId, projectOwnerId }) {
  const Icon = stage.Icon;
  return (
    <div
      className={`w-64 sm:w-72 flex-shrink-0 rounded-2xl border bg-slate-900/40 transition-all relative overflow-hidden ${
        isDragOver ? 'border-cyan-400/60 ring-2 ring-cyan-400/30' : 'border-white/5'
      }`}
      style={{ borderTopColor: `${stage.accent}44`, borderTopWidth: 2 }}
      onDragOver={canManage ? onDragOver : undefined}
      onDragLeave={canManage ? onDragLeave : undefined}
      onDrop={canManage ? onDrop : undefined}
    >
      <div className="p-3 flex items-center justify-between gap-2 border-b border-white/5">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold ${stage.pill}`}>
            <Icon className="w-3.5 h-3.5" />
            {stage.label}
          </div>
        </div>
        <span className="text-xs text-slate-400 tabular-nums">{tasks.length}</span>
      </div>
      <div className="absolute top-0 left-0 right-0 h-0.5"
        style={{ background: `linear-gradient(90deg, transparent, ${stage.accent}, transparent)` }} />
      <div className="p-3 space-y-2 min-h-[280px]">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task}
            onClick={onTaskClick} onDragStart={onDragStart} onUpdated={onTaskUpdated}
            isSelected={selectedTaskId === task.id}
            draggable={canManage}
            projectOwnerId={projectOwnerId} />
        ))}
        {tasks.length === 0 && (
          <div className="text-xs text-slate-600 text-center py-6 border-2 border-dashed border-white/5 rounded-lg">
            {canManage ? 'Drop tasks here' : 'No tasks'}
          </div>
        )}
        {canCreate && (
          <button
            onClick={() => onAddTask(stage.id)}
            className="w-full flex items-center justify-center gap-1.5 text-[11px] text-slate-500 hover:text-cyan-300 hover:bg-white/[0.03] py-2 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add task
          </button>
        )}
      </div>
    </div>
  );
}

/* Focused stage column: same as normal stage column, but selected task is highlighted.
   The task detail flows AFTER this column as horizontal pipeline cards. */
function FocusedStageColumn({ stage, tasks, selectedTask, onTaskClick, onTaskUpdated, onDragStart, projectOwnerId, canManage }) {
  const Icon = stage.Icon;
  return (
    <div
      className="w-72 flex-shrink-0 rounded-2xl border bg-gradient-to-b relative overflow-hidden"
      style={{
        background: `linear-gradient(to bottom, ${stage.accent}15, rgba(15,23,42,0.4))`,
        borderColor: 'rgba(255,255,255,0.08)',
        borderTopColor: `${stage.accent}aa`,
        borderTopWidth: 2,
      }}
    >
      <div className="absolute top-0 left-0 right-0 h-0.5"
        style={{ background: `linear-gradient(90deg, transparent, ${stage.accent}, transparent)` }} />
      <div className="p-3 flex items-center justify-between gap-2 border-b border-white/5">
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold ${stage.pill}`}>
          <Icon className="w-3.5 h-3.5" />
          {stage.label}
        </div>
        <span className="text-xs text-slate-400 tabular-nums">{tasks.length}</span>
      </div>
      <div className="p-3 space-y-2 min-h-[280px]">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onClick={onTaskClick}
            onDragStart={onDragStart}
            onUpdated={onTaskUpdated}
            isSelected={selectedTask.id === task.id}
            draggable={canManage}
            projectOwnerId={projectOwnerId}
          />
        ))}
      </div>
    </div>
  );
}

export default function BoardView({
  tasks, onTaskClick, onTaskUpdated, onTaskDeleted,
  selectedTask, projectMembers, projectId, projectOwnerId,
  canCreate, canManage = canCreate, onAddTask,
}) {
  const [dragOver, setDragOver] = useState(null);

  const byStage = STAGES.reduce((acc, c) => {
    acc[c.id] = tasks.filter((t) => t.status === c.id);
    return acc;
  }, {});

  const onDragStart = (e, task) => {
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = async (e, colId) => {
    e.preventDefault();
    setDragOver(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === colId) return;
    const res = await taskService.update(taskId, { status: colId });
    if (res.success) onTaskUpdated(res.task);
    else toast.error(res.error || 'Failed to move');
  };

  return (
    <div className="overflow-x-auto pb-3">
      <div className="flex items-stretch gap-0 min-w-max">
        {STAGES.map((stage, i) => {
          const next = STAGES[i + 1];
          return (
            <React.Fragment key={stage.id}>
              <StageColumn
                stage={stage}
                tasks={byStage[stage.id]}
                isDragOver={dragOver === stage.id}
                canCreate={canCreate}
                canManage={canManage}
                onAddTask={onAddTask}
                onDragOver={(e) => { e.preventDefault(); setDragOver(stage.id); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => onDrop(e, stage.id)}
                onTaskClick={onTaskClick}
                onTaskUpdated={onTaskUpdated}
                onDragStart={onDragStart}
                selectedTaskId={selectedTask?.id}
                projectOwnerId={projectOwnerId}
              />
              {i < STAGES.length - 1 && next && (
                <StageArrow leftColor={stage.accent} rightColor={next.accent} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
