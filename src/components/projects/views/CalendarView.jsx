import React, { useState, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, Calendar as CalIcon, Flag, Rocket, Play,
} from 'lucide-react';
import {
  startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addMonths,
  isSameMonth, isToday, format, isSameDay, isWithinInterval, startOfDay,
} from 'date-fns';

const STATUS_COLOR = {
  todo: 'border-l-slate-400 bg-slate-700/50',
  'in-progress': 'border-l-blue-400 bg-blue-500/15',
  review: 'border-l-purple-400 bg-purple-500/15',
  done: 'border-l-emerald-400 bg-emerald-500/15 line-through opacity-70',
};

const PRIORITY_DOT = {
  low: 'bg-slate-400',
  medium: 'bg-blue-400',
  high: 'bg-amber-400',
  urgent: 'bg-red-500',
};

export default function CalendarView({ tasks, project, onTaskClick }) {
  const [cursor, setCursor] = useState(new Date());

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  // Map every day → list of tasks active on that day (spanning start..due range)
  const tasksByDay = useMemo(() => {
    const m = new Map();
    for (const t of tasks) {
      if (!t.dueDate && !t.startDate) continue;
      const s = startOfDay(t.startDate ? new Date(t.startDate) : new Date(t.dueDate));
      const e = startOfDay(t.dueDate ? new Date(t.dueDate) : new Date(t.startDate));
      for (const d of days) {
        const day = startOfDay(d);
        if (isWithinInterval(day, { start: s, end: e })) {
          const key = format(day, 'yyyy-MM-dd');
          if (!m.has(key)) m.set(key, []);
          m.get(key).push({
            task: t,
            isStart: isSameDay(day, s),
            isEnd: isSameDay(day, e),
            isSingle: isSameDay(s, e),
          });
        }
      }
    }
    return m;
  }, [tasks, days]);

  const projectStart = project?.startDate ? startOfDay(new Date(project.startDate)) : null;
  const projectDeadline = project?.deadline ? startOfDay(new Date(project.deadline)) : null;

  // Count totals visible in current view
  const monthTaskCount = useMemo(() => {
    let count = 0;
    for (const t of tasks) {
      if (!t.dueDate && !t.startDate) continue;
      const ref = t.dueDate ? new Date(t.dueDate) : new Date(t.startDate);
      if (isSameMonth(ref, cursor)) count++;
    }
    return count;
  }, [tasks, cursor]);

  const weekHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="rounded-2xl border border-white/5 bg-slate-900/30 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-white/5 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <CalIcon className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-semibold text-white">{format(cursor, 'MMMM yyyy')}</h3>
          <span className="text-xs text-slate-500">· {monthTaskCount} task{monthTaskCount === 1 ? '' : 's'}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setCursor((d) => addMonths(d, -1))} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => setCursor(new Date())} className="px-3 py-1.5 text-xs rounded-lg text-slate-300 hover:text-white hover:bg-white/5">
            Today
          </button>
          <button onClick={() => setCursor((d) => addMonths(d, 1))} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-white/5 flex-wrap text-[10px] text-slate-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Project start</span>
        <span className="flex items-center gap-1"><Flag className="w-3 h-3 text-red-400" /> Project deadline</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-slate-400" /> To Do</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-400" /> In Progress</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-purple-400" /> Review</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-400" /> Done</span>
      </div>

      <div className="grid grid-cols-7 text-xs text-slate-400 border-b border-white/5">
        {weekHeaders.map((d) => (
          <div key={d} className="px-2 py-2 text-center font-medium">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const inMonth = isSameMonth(day, cursor);
          const today = isToday(day);
          const key = format(day, 'yyyy-MM-dd');
          const dayItems = tasksByDay.get(key) || [];
          const isProjectStart = projectStart && isSameDay(day, projectStart);
          const isProjectDeadline = projectDeadline && isSameDay(day, projectDeadline);
          const isMilestone = isProjectStart || isProjectDeadline;

          return (
            <div
              key={idx}
              className={`min-h-[120px] border-b border-r border-white/5 p-1.5 transition-colors ${
                !inMonth ? 'bg-slate-950/40' : ''
              } ${today ? 'bg-cyan-500/5' : ''} ${isMilestone ? (isProjectDeadline ? 'bg-red-500/5' : 'bg-emerald-500/5') : ''}`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className={`text-xs font-medium ${
                  today ? 'text-cyan-300' : inMonth ? 'text-slate-300' : 'text-slate-600'
                }`}>
                  {today ? (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-cyan-500 text-white text-xs">{format(day, 'd')}</span>
                  ) : format(day, 'd')}
                </div>
                <div className="flex items-center gap-0.5">
                  {isProjectStart && (
                    <span title={`Project start: ${project.name}`} className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      <Play className="w-2.5 h-2.5" /> START
                    </span>
                  )}
                  {isProjectDeadline && (
                    <span title={`Project deadline: ${project.name}`} className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-semibold bg-red-500/20 text-red-300 border border-red-500/40">
                      <Flag className="w-2.5 h-2.5" /> DUE
                    </span>
                  )}
                </div>
              </div>

              {/* Project milestone band */}
              {isProjectStart && (
                <button
                  className="w-full mb-1 px-1.5 py-1 rounded text-[10px] text-left bg-gradient-to-r from-emerald-500/20 to-emerald-500/5 border-l-2 border-emerald-400 text-emerald-200 truncate"
                  title={project.name}
                >
                  <Rocket className="w-2.5 h-2.5 inline mr-1" />
                  {project.name} starts
                </button>
              )}
              {isProjectDeadline && (
                <button
                  className="w-full mb-1 px-1.5 py-1 rounded text-[10px] text-left bg-gradient-to-r from-red-500/20 to-red-500/5 border-l-2 border-red-400 text-red-200 truncate"
                  title={project.name}
                >
                  <Flag className="w-2.5 h-2.5 inline mr-1" />
                  {project.name} due
                </button>
              )}

              {/* Tasks */}
              <div className="space-y-1">
                {dayItems.slice(0, 4).map((item, i) => {
                  const { task, isStart, isEnd, isSingle } = item;
                  const colorClass = STATUS_COLOR[task.status] || STATUS_COLOR.todo;
                  return (
                    <button
                      key={`${task.id}-${i}`}
                      onClick={() => onTaskClick(task)}
                      className={`w-full text-left px-1.5 py-1 text-[11px] truncate flex items-center gap-1 hover:brightness-125 transition-all border-l-2 text-slate-200 ${colorClass} ${
                        isSingle ? 'rounded' :
                        isStart ? 'rounded-l rounded-r-none' :
                        isEnd ? 'rounded-r rounded-l-none' : 'rounded-none'
                      }`}
                      title={`${task.title}${task.assignees?.length ? ' · ' + task.assignees.map(a => a.fullname || a.email).join(', ') : ''}`}
                    >
                      <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[task.priority] || PRIORITY_DOT.medium}`} />
                      <span className="truncate">{isStart || isSingle ? task.title : '...'}</span>
                    </button>
                  );
                })}
                {dayItems.length > 4 && (
                  <div className="text-[10px] text-slate-500 px-1">+{dayItems.length - 4} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
