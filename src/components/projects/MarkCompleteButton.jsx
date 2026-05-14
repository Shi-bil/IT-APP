import React, { useState } from 'react';
import { Check, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import taskService from '../../services/taskService';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Circle button that toggles a task to/from completed.
 * Permitted: admin OR an assignee of the task.
 */
export default function MarkCompleteButton({ task, onUpdated, size = 'md', stopPropagation = true, projectOwnerId }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  const isAdmin = user?.role === 'admin';
  const isAssignee = (task.assigneeUserIds || []).some((u) => String(u) === String(user?.id));
  // Task creator gets the same mark-done rights as an explicit assignee.
  const isCreator = task.createdByUserId && String(task.createdByUserId) === String(user?.id);
  const isOwner = projectOwnerId && String(projectOwnerId) === String(user?.id);
  const inReview = task.status === 'review';
  const done = task.status === 'done';

  const dim = size === 'sm' ? 14 : size === 'lg' ? 24 : 20;

  // Reopen (done → in-progress): owner/admin only.
  // Approve (review → done): owner/admin only.
  // Mark complete from any other state: assignee/creator, owner, or admin.
  const canReopen = isAdmin || isOwner;
  const canApprove = isAdmin || isOwner;
  const canEdit = inReview ? canApprove : (isAdmin || isAssignee || isCreator || isOwner);
  const effectiveCanEdit = done ? canReopen : canEdit;

  const toggle = async (e) => {
    if (stopPropagation) { e.stopPropagation(); e.preventDefault(); }
    if (!effectiveCanEdit || busy) return;
    setBusy(true);
    const next = done
      ? { status: 'in-progress', progress: 75 }
      : { status: 'done', progress: 100 };
    const res = await taskService.update(task.id, next);
    setBusy(false);
    if (res.success) {
      onUpdated?.(res.task);
      toast.success(done ? 'Reopened' : 'Marked complete', { duration: 1500 });
    } else {
      toast.error(res.error || 'Failed to update');
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!effectiveCanEdit || busy}
      title={
        done
          ? (canReopen ? 'Reopen task' : 'Only project owner or admin can reopen this task')
          : inReview
            ? (canApprove ? 'Approve & mark complete' : 'Only project owner or admin can approve a task in review')
            : (canEdit ? 'Mark complete' : 'Only assignees, project owner, or admin can complete this task')
      }
      style={{ width: dim, height: dim, minWidth: dim, minHeight: dim }}
      className={`relative inline-flex items-center justify-center rounded-full flex-shrink-0 transition-all border ${
        done
          ? 'bg-gradient-to-br from-emerald-500 to-teal-600 border-emerald-400 shadow-[0_0_10px_-2px_rgba(16,185,129,0.6)]'
          : 'border-slate-500 bg-slate-800/60 hover:border-emerald-400 hover:bg-emerald-500/10'
      } ${!effectiveCanEdit ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${busy ? 'animate-pulse' : ''}`}
    >
      {done && <Check className="text-white" style={{ width: dim * 0.6, height: dim * 0.6 }} strokeWidth={3} />}
      {!done && !canEdit && <Lock className="text-slate-500" style={{ width: dim * 0.5, height: dim * 0.5 }} />}
    </button>
  );
}
