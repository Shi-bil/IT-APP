import React, { useState, useRef, useEffect } from 'react';
import { CornerDownRight, Trash2, Edit2, AtSign, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Avatar from './Avatar';
import projectCommentService from '../../services/projectCommentService';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

// Renders comment text with @mentions highlighted
function CommentBody({ text, mentionMap }) {
  // Mentions stored inline as @[name](userId)
  const parts = [];
  const regex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push({ kind: 'text', value: text.slice(last, m.index), key: i++ });
    parts.push({ kind: 'mention', name: m[1].trim(), id: m[2], key: i++ });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ kind: 'text', value: text.slice(last), key: i++ });

  return (
    <div className="text-sm text-slate-200 whitespace-pre-wrap break-words leading-relaxed">
      {parts.map((p) =>
        p.kind === 'mention' ? (
          <span
            key={p.key}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 text-xs font-medium border border-cyan-500/30 mx-0.5"
          >
            <AtSign className="w-3 h-3" />
            {p.name}
          </span>
        ) : (
          <span key={p.key}>{p.value}</span>
        )
      )}
    </div>
  );
}

function MentionInput({ value, onChange, onSubmit, users, placeholder, autoFocus }) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuQuery, setMenuQuery] = useState('');
  const [menuPos, setMenuPos] = useState(0);
  const [highlight, setHighlight] = useState(0);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (autoFocus && textareaRef.current) textareaRef.current.focus();
  }, [autoFocus]);

  const onTextChange = (e) => {
    const v = e.target.value;
    onChange(v);
    const caret = e.target.selectionStart;
    const before = v.slice(0, caret);
    const at = before.lastIndexOf('@');
    if (at >= 0) {
      const after = before.slice(at + 1);
      // Only show if no space/newline between @ and caret
      if (!/\s/.test(after) && after.length <= 30) {
        setShowMenu(true);
        setMenuQuery(after);
        setMenuPos(at);
        setHighlight(0);
        return;
      }
    }
    setShowMenu(false);
  };

  const filteredUsers = (users || []).filter((u) => {
    if (!menuQuery) return true;
    const q = menuQuery.toLowerCase();
    return (u.fullname || u.email || '').toLowerCase().includes(q);
  }).slice(0, 6);

  const pickUser = (u) => {
    const t = textareaRef.current;
    const caret = t.selectionStart;
    const before = value.slice(0, menuPos);
    const after = value.slice(caret);
    const inserted = `@[${u.fullname || u.email}](${u.id}) `;
    const newVal = before + inserted + after;
    onChange(newVal);
    setShowMenu(false);
    requestAnimationFrame(() => {
      t.focus();
      const newPos = before.length + inserted.length;
      t.setSelectionRange(newPos, newPos);
    });
  };

  const onKey = (e) => {
    if (showMenu && filteredUsers.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => (h + 1) % filteredUsers.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => (h - 1 + filteredUsers.length) % filteredUsers.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        pickUser(filteredUsers[highlight]);
        return;
      }
      if (e.key === 'Escape') { setShowMenu(false); return; }
    }
    // Enter sends; Shift+Enter inserts a newline.
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={onTextChange}
        onKeyDown={onKey}
        placeholder={placeholder || 'Write a comment... use @ to mention'}
        rows={2}
        className="w-full px-3 py-2 bg-slate-800/60 border border-white/10 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400/50 resize-none"
      />
      {showMenu && filteredUsers.length > 0 && (
        <div className="absolute z-30 left-2 -top-2 -translate-y-full w-64 max-h-56 overflow-auto bg-slate-900 border border-white/10 rounded-lg shadow-2xl">
          {filteredUsers.map((u, idx) => (
            <button
              type="button"
              key={u.id}
              onMouseDown={(e) => { e.preventDefault(); pickUser(u); }}
              onMouseEnter={() => setHighlight(idx)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left ${
                idx === highlight ? 'bg-cyan-500/15' : 'hover:bg-white/5'
              }`}
            >
              <Avatar name={u.fullname || u.email} size={24} ringClass="" />
              <div className="min-w-0 flex-1">
                <div className="text-sm text-white truncate">{u.fullname || u.email}</div>
                <div className="text-[11px] text-slate-500 truncate">{u.email}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function extractMentionIds(text) {
  const ids = [];
  const regex = /@\[[^\]]+\]\(([^)]+)\)/g;
  let m;
  while ((m = regex.exec(text)) !== null) ids.push(m[1]);
  return [...new Set(ids)];
}

function CommentItem({ comment, replies, depth, onReplyPosted, projectId, taskId, mentionableUsers, onDeleted, onEdited }) {
  const { user } = useAuth();
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [editText, setEditText] = useState(comment.text);
  const [sending, setSending] = useState(false);

  const isMine = comment.createdBy?.id === user?.id || comment.createdByUserId === user?.id;

  const submitReply = () => {
    const text = replyText.trim();
    if (!text) return;
    // Optimistic: close composer + clear text + show pending bubble immediately.
    setReplyText('');
    setReplying(false);
    const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const optimistic = {
      id: tempId,
      _pending: true,
      text,
      parentCommentId: comment.id,
      createdAt: new Date().toISOString(),
      createdBy: user
        ? { id: user.id, fullname: user.fullname, email: user.email }
        : { fullname: 'You' },
    };
    onReplyPosted(optimistic);

    projectCommentService
      .create({ projectId, taskId, parentCommentId: comment.id, text, mentions: extractMentionIds(text) })
      .then((res) => {
        if (res.success) {
          onEdited({ ...res.comment, _replaces: tempId });
        } else {
          onDeleted(tempId);
          toast.error(res.error || 'Failed to post reply');
        }
      })
      .catch((err) => {
        onDeleted(tempId);
        toast.error(err?.message || 'Failed to post reply');
      });
  };

  const submitEdit = async () => {
    if (!editText.trim()) return;
    setSending(true);
    const res = await projectCommentService.update(comment.id, editText.trim(), extractMentionIds(editText));
    setSending(false);
    if (res.success) {
      onEdited(res.comment);
      setEditing(false);
    } else {
      toast.error(res.error || 'Failed to update');
    }
  };

  const remove = async () => {
    if (!confirm('Delete this comment? Replies will also be deleted.')) return;
    const res = await projectCommentService.remove(comment.id);
    if (res.success) onDeleted(comment.id);
    else toast.error(res.error || 'Delete failed');
  };

  return (
    <div className={depth > 0 ? 'pl-4 border-l border-white/5' : ''}>
      <div className={`group flex gap-3 py-2 ${comment._pending ? 'opacity-60' : ''}`}>
        <Avatar name={comment.createdBy?.fullname || comment.createdBy?.email || '?'} size={32} ringClass="" />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white">
              {comment.createdBy?.fullname || comment.createdBy?.email}
            </span>
            <span className="text-[11px] text-slate-500">
              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
              {comment.editedAt && <span className="ml-1">(edited)</span>}
            </span>
          </div>
          {editing ? (
            <div className="mt-1 space-y-2">
              <MentionInput
                value={editText}
                onChange={setEditText}
                onSubmit={submitEdit}
                users={mentionableUsers}
                autoFocus
              />
              <div className="flex gap-2 text-xs">
                <button
                  onClick={submitEdit}
                  disabled={sending}
                  className="px-3 py-1 rounded bg-cyan-500 text-white hover:bg-cyan-600 disabled:opacity-50"
                >
                  Save
                </button>
                <button onClick={() => { setEditing(false); setEditText(comment.text); }} className="px-3 py-1 rounded text-slate-300 hover:bg-white/5">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <CommentBody text={comment.text} />
          )}

          {!editing && !comment._pending && (
            <div className="mt-1 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => setReplying((r) => !r)}
                className="text-[11px] text-slate-400 hover:text-cyan-300 flex items-center gap-1"
              >
                <CornerDownRight className="w-3 h-3" /> Reply
              </button>
              {isMine && (
                <>
                  <button onClick={() => setEditing(true)} className="text-[11px] text-slate-400 hover:text-cyan-300 flex items-center gap-1">
                    <Edit2 className="w-3 h-3" /> Edit
                  </button>
                  <button onClick={remove} className="text-[11px] text-slate-400 hover:text-red-300 flex items-center gap-1">
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </>
              )}
            </div>
          )}

          {replying && (
            <div className="mt-2 space-y-2">
              <MentionInput
                value={replyText}
                onChange={setReplyText}
                onSubmit={submitReply}
                users={mentionableUsers}
                autoFocus
                placeholder="Reply..."
              />
              <div className="flex gap-2">
                <button
                  onClick={submitReply}
                  disabled={sending || !replyText.trim()}
                  className="px-3 py-1 text-xs rounded bg-cyan-500 text-white hover:bg-cyan-600 disabled:opacity-50 flex items-center gap-1"
                >
                  <Send className="w-3 h-3" /> Send
                </button>
                <button
                  onClick={() => { setReplying(false); setReplyText(''); }}
                  className="px-3 py-1 text-xs rounded text-slate-300 hover:bg-white/5"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {replies && replies.length > 0 && (
        <div className="ml-4 space-y-0">
          {replies.map((r) => (
            <CommentItem
              key={r.id}
              comment={r}
              replies={r._replies || []}
              depth={depth + 1}
              onReplyPosted={onReplyPosted}
              projectId={projectId}
              taskId={taskId}
              mentionableUsers={mentionableUsers}
              onDeleted={onDeleted}
              onEdited={onEdited}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommentThread({ projectId, taskId, mentionableUsers }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  // Pending = optimistic comments shown immediately while the server confirms.
  // Kept separate from `comments` so background polling can refresh the real
  // list without wiping out the optimistic entries.
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newText, setNewText] = useState('');

  const load = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    const res = await projectCommentService.list({ projectId, taskId });
    if (res.success) {
      // Only update state if the comment set actually changed — avoids
      // re-renders that would steal focus from the composer or flash the list.
      setComments((prev) => {
        const a = prev.map((c) => `${c.id}:${c.editedAt || c.createdAt}`).join('|');
        const b = res.comments.map((c) => `${c.id}:${c.editedAt || c.createdAt}`).join('|');
        return a === b ? prev : res.comments;
      });
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    if (projectId || taskId) load();
  }, [projectId, taskId]);

  // Live refresh: poll every few seconds while visible so new comments appear
  // without a manual reload. Pauses when the tab is hidden.
  useEffect(() => {
    if (!projectId && !taskId) return undefined;
    const REFRESH_MS = 4000;
    let timer = null;
    const tick = () => { if (!document.hidden) load({ silent: true }); };
    const start = () => { if (timer == null) timer = setInterval(tick, REFRESH_MS); };
    const stop = () => { if (timer != null) { clearInterval(timer); timer = null; } };
    const onVis = () => {
      if (document.hidden) stop();
      else { load({ silent: true }); start(); }
    };
    start();
    document.addEventListener('visibilitychange', onVis);
    return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
  }, [projectId, taskId]);

  // Build tree from confirmed + pending comments
  const tree = (() => {
    const all = [...comments, ...pending];
    const byParent = new Map();
    for (const c of all) {
      const pid = c.parentCommentId || null;
      if (!byParent.has(pid)) byParent.set(pid, []);
      byParent.get(pid).push(c);
    }
    const attach = (c) => ({ ...c, _replies: (byParent.get(c.id) || []).map(attach) });
    return (byParent.get(null) || []).map(attach);
  })();

  const submit = () => {
    const text = newText.trim();
    if (!text) return;
    // Optimistic: clear the input immediately and add a pending bubble.
    setNewText('');
    const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const optimistic = {
      id: tempId,
      _pending: true,
      text,
      parentCommentId: null,
      createdAt: new Date().toISOString(),
      createdBy: user
        ? { id: user.id, fullname: user.fullname, email: user.email }
        : { fullname: 'You' },
    };
    setPending((p) => [...p, optimistic]);

    projectCommentService
      .create({ projectId, taskId, text, mentions: extractMentionIds(text) })
      .then((res) => {
        setPending((p) => p.filter((c) => c.id !== tempId));
        if (res.success) {
          setComments((prev) =>
            prev.some((c) => c.id === res.comment.id) ? prev : [...prev, res.comment]
          );
        } else {
          setNewText((cur) => (cur ? cur : text));
          toast.error(res.error || 'Failed to post comment');
        }
      })
      .catch((err) => {
        setPending((p) => p.filter((c) => c.id !== tempId));
        setNewText((cur) => (cur ? cur : text));
        toast.error(err?.message || 'Failed to post comment');
      });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1 max-h-[50vh] overflow-y-auto pr-1">
        {loading ? (
          <p className="text-sm text-slate-500 text-center py-4">Loading comments...</p>
        ) : tree.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">No comments yet. Start the conversation.</p>
        ) : (
          tree.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              replies={c._replies}
              depth={0}
              projectId={projectId}
              taskId={taskId}
              mentionableUsers={mentionableUsers}
              onReplyPosted={(reply) => setComments((prev) => [...prev, reply])}
              onDeleted={(id) =>
                setComments((prev) => prev.filter((c) => c.id !== id && c.parentCommentId !== id))
              }
              onEdited={(updated) =>
                setComments((prev) => {
                  if (updated._replaces) {
                    // Swap a pending temp comment for the real one returned by the server.
                    const { _replaces, ...real } = updated;
                    return prev.map((c) => (c.id === _replaces ? real : c));
                  }
                  return prev.map((c) => (c.id === updated.id ? updated : c));
                })
              }
            />
          ))
        )}
      </div>

      <div className="space-y-2 pt-2 border-t border-white/5">
        <MentionInput
          value={newText}
          onChange={setNewText}
          onSubmit={submit}
          users={mentionableUsers}
          placeholder="Add a comment… use @ to mention. Enter to send, Shift+Enter for newline"
        />
        <div className="flex justify-end">
          <button
            onClick={submit}
            disabled={!newText.trim()}
            className="px-3 py-1.5 text-sm rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" /> Comment
          </button>
        </div>
      </div>
    </div>
  );
}
