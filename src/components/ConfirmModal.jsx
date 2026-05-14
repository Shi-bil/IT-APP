import { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

// Themed confirmation popup. Drop-in replacement for native window.confirm().
// Usage:
//   const [confirming, setConfirming] = useState(false);
//   <ConfirmModal open={confirming} title="..." message="..." onConfirm={...}
//                  onCancel={() => setConfirming(false)} />
export default function ConfirmModal({
  open,
  title = 'Are you sure?',
  message = '',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel?.();
      if (e.key === 'Enter') onConfirm?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onConfirm, onCancel]);

  if (!open) return null;

  const confirmStyles = variant === 'danger'
    ? 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white shadow-[0_0_18px_-3px_rgba(244,63,94,0.6)]'
    : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white';

  const accent = variant === 'danger' ? 'text-rose-400' : 'text-cyan-400';

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close"
          className="absolute top-3 right-3 p-1.5 rounded-lg bg-slate-800/80 border border-white/10 text-slate-300 hover:text-white hover:bg-slate-700/80 transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-5 pb-3">
          <div className="flex items-start gap-3">
            <div className={`flex-shrink-0 w-10 h-10 rounded-full bg-slate-800/60 border border-white/10 flex items-center justify-center ${accent}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1 pt-0.5 pr-6">
              <h3 className="text-base font-semibold text-white">{title}</h3>
              {message && <p className="mt-1 text-sm text-slate-400 leading-relaxed">{message}</p>}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-white/5 bg-slate-950/40 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm rounded-lg bg-slate-800/60 border border-white/10 text-slate-300 hover:bg-slate-700/60 hover:text-white transition"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition ${confirmStyles}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
