import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CreditCard, Plus, Pencil, Trash2, CheckCircle, Eye, EyeOff,
  AlertTriangle, CalendarCheck, Copy, Check, X, Search,
} from 'lucide-react';
import subscriptionService from '../services/subscriptionService';
import { expandDueDates, findPaymentForMonth } from '../components/PaymentCalendar';
import Highlight from '../components/Highlight';
import SuggestInput from '../components/SuggestInput';
import useTabRefresh from '../hooks/useTabRefresh';
import { getDisplayPaymentDate, formatPaymentDate } from '../utils/billingDate';

const emptySubscriptionForm = {
  name: '',
  username: '',
  password: '',
  authType: 'password',
  url: '',
  status: 'Active',
  monthlyCost: '',
  currency: 'USD',
  billingCycle: 'Monthly',
  nextPaymentDate: '',
  recurrenceEndDate: '',
  notes: '',
};

const GoogleGlyph = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

const formatCurrency = (value, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(value) || 0);

const sanitizeCost = (value) => {
  const cleaned = (value || '').replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
};

const defaultRecurrenceEndDate = () => {
  const y = new Date().getFullYear();
  return `${y}-12-31`;
};

const getCurrentMonthDueDate = (sub) => {
  if (!sub?.nextPaymentDate) return null;
  const anchor = new Date(sub.nextPaymentDate);
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const step = { Monthly: 1, Quarterly: 3, Annual: 12 }[sub.billingCycle];
  if (!step) return null;
  const diff = (year * 12 + month) - (anchor.getFullYear() * 12 + anchor.getMonth());
  if (diff < 0 || diff % step !== 0) return null;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const day = Math.min(anchor.getDate(), daysInMonth);
  return new Date(year, month, day);
};

const isMonthPaid = (sub, date) => {
  if (!date || !Array.isArray(sub?.payments)) return false;
  return sub.payments.some((p) => {
    if (!p?.paidAt) return false;
    const d = new Date(p.paidAt);
    return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth();
  });
};

const SubscriptionsPage = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [createForm, setCreateForm] = useState(emptySubscriptionForm);

  const [editingSub, setEditingSub] = useState(null);
  const [editingForm, setEditingForm] = useState(null);
  const [showEditPassword, setShowEditPassword] = useState(false);

  const [showPasswords, setShowPasswords] = useState({});
  const [copiedField, setCopiedField] = useState(null);
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '');
  const [dueDateFilter, setDueDateFilter] = useState(() => searchParams.get('dueDate') || '');
  const [focusId, setFocusId] = useState(() => searchParams.get('focus') || '');

  useEffect(() => {
    const urlSearch = searchParams.get('search');
    if (urlSearch !== null) setSearchQuery(urlSearch);
    setDueDateFilter(searchParams.get('dueDate') || '');
    setFocusId(searchParams.get('focus') || '');
  }, [searchParams]);

  const [deletingSub, setDeletingSub] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [bulkPayContext, setBulkPayContext] = useState(null);
  const [isBulkPaying, setIsBulkPaying] = useState(false);

  const viewedMonth = useMemo(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  }, []);

  const suggestions = useMemo(() => ({
    name: subscriptions.map((s) => s.name),
    username: subscriptions.map((s) => s.username),
    url: subscriptions.map((s) => s.url),
  }), [subscriptions]);

  const filteredSubscriptions = useMemo(() => {
    if (focusId) return subscriptions.filter((s) => s.id === focusId);
    const q = searchQuery.trim().toLowerCase();
    let target = null;
    if (dueDateFilter) {
      const parts = dueDateFilter.split('-').map(Number);
      if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
        target = new Date(parts[0], parts[1] - 1, parts[2]);
      }
    }
    return subscriptions.filter((s) => {
      if (q) {
        const haystack = [
          s.name, s.provider, s.username, s.url, s.status, s.billingCycle,
          s.currency, s.notes, s.providerAccount,
          s.monthlyCost != null ? String(s.monthlyCost) : '',
          s.nextPaymentDate ? new Date(s.nextPaymentDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (target) {
        const dues = expandDueDates(s, target.getFullYear());
        const matches = dues.some((d) =>
          d.getFullYear() === target.getFullYear()
          && d.getMonth() === target.getMonth()
          && d.getDate() === target.getDate()
        );
        if (!matches) return false;
      }
      return true;
    });
  }, [subscriptions, searchQuery, dueDateFilter, focusId]);

  const totalsByCurrency = useMemo(() => {
    const { year, month } = viewedMonth;
    const map = new Map();
    for (const item of subscriptions) {
      const dueDates = expandDueDates(item, year);
      const billsThisMonth = dueDates.some((d) => d.getFullYear() === year && d.getMonth() === month);
      if (!billsThisMonth) continue;
      const cur = item.currency || 'USD';
      map.set(cur, (map.get(cur) || 0) + (Number(item.monthlyCost) || 0));
    }
    return Array.from(map.entries()).map(([currency, amount]) => ({ currency, amount }));
  }, [subscriptions, viewedMonth]);

  const viewedMonthTotals = useMemo(() => {
    const { year, month } = viewedMonth;
    const paid = new Map();
    const due = new Map();
    let count = 0;
    for (const item of subscriptions) {
      const dueDates = expandDueDates(item, year);
      const dueThisMonth = dueDates.find((d) => d.getFullYear() === year && d.getMonth() === month);
      if (!dueThisMonth) continue;
      count += 1;
      const cur = item.currency || 'USD';
      const amount = Number(item.monthlyCost) || 0;
      const payment = findPaymentForMonth(item, dueThisMonth);
      if (payment) paid.set(cur, (paid.get(cur) || 0) + (Number(payment.amount ?? amount) || 0));
      else due.set(cur, (due.get(cur) || 0) + amount);
    }
    return {
      count,
      paid: Array.from(paid.entries()).map(([currency, amount]) => ({ currency, amount })),
      due: Array.from(due.entries()).map(([currency, amount]) => ({ currency, amount })),
    };
  }, [subscriptions, viewedMonth]);

  const copyToClipboard = (text, id, field) => {
    if (!text) return;
    const key = `${id}:${field}`;
    const done = () => {
      setCopiedField(key);
      setTimeout(() => setCopiedField((prev) => (prev === key ? null : prev)), 1500);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => {});
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch { /* ignore */ }
      document.body.removeChild(ta);
    }
  };

  const loadSubscriptions = async ({ force = false, silent = false } = {}) => {
    if (!silent) setLoading(true);
    const result = await subscriptionService.getAllSubscriptions({ force });
    if (result.success) {
      setSubscriptions(result.subscriptions);
      setError('');
    } else {
      setError(result.error || 'Failed to load subscriptions');
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    loadSubscriptions();
  }, []);

  useTabRefresh(() => loadSubscriptions({ force: true, silent: true }));

  const handleCreate = async (e) => {
    e.preventDefault();
    const payload = {
      ...createForm,
      monthlyCost: Number(createForm.monthlyCost) || 0,
      nextPaymentDate: createForm.nextPaymentDate || null,
      recurrenceEndDate: createForm.recurrenceEndDate || null,
    };
    const result = await subscriptionService.createSubscription(payload);
    if (!result.success) {
      setError(result.error || 'Failed to create subscription');
      return;
    }
    setShowCreateModal(false);
    setCreateForm(emptySubscriptionForm);
    await loadSubscriptions();
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editingSub || !editingForm) return;
    const payload = {
      ...editingForm,
      monthlyCost: Number(editingForm.monthlyCost) || 0,
      nextPaymentDate: editingForm.nextPaymentDate || null,
      recurrenceEndDate: editingForm.recurrenceEndDate || null,
    };
    const result = await subscriptionService.updateSubscription(editingSub.id, payload);
    if (!result.success) {
      setError(result.error || 'Failed to update subscription');
      return;
    }
    setEditingSub(null);
    setEditingForm(null);
    await loadSubscriptions();
  };

  const updateSubInList = (id, updateFn) => {
    setSubscriptions((list) => list.map((it) => (it.id === id ? updateFn(it) : it)));
  };

  const handleMarkPaid = (sub, dueDate = null) => {
    if (!sub?.id) return;
    const paidAt = dueDate ? new Date(dueDate).toISOString() : new Date().toISOString();
    const paidOnLabel = new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    const optimisticPayment = {
      _optimistic: true,
      paidAt,
      amount: Number(sub.monthlyCost) || 0,
      currency: sub.currency || 'USD',
      note: `Paid on ${paidOnLabel}`,
    };
    const id = sub.id;
    const snapshot = sub;
    updateSubInList(id, (it) => ({
      ...it,
      payments: [...(it.payments || []), optimisticPayment],
    }));
    subscriptionService
      .markAsPaid(id, {
        amount: optimisticPayment.amount,
        currency: optimisticPayment.currency,
        paidAt,
        note: optimisticPayment.note,
      })
      .then((result) => {
        if (!result?.success) {
          updateSubInList(id, () => snapshot);
          setError(result?.error || 'Failed to mark as paid');
          return;
        }
        if (result.subscription) updateSubInList(id, () => result.subscription);
      })
      .catch((err) => {
        updateSubInList(id, () => snapshot);
        setError(err?.message || 'Failed to mark as paid');
      });
  };

  const handleUnmarkPaid = (sub, dueDate) => {
    if (!sub?.id || !dueDate) return;
    const id = sub.id;
    const snapshot = sub;
    const target = new Date(dueDate);
    const targetYear = target.getFullYear();
    const targetMonth = target.getMonth();
    updateSubInList(id, (it) => ({
      ...it,
      payments: (it.payments || []).filter((p) => {
        if (!p?.paidAt) return true;
        const d = new Date(p.paidAt);
        return !(d.getFullYear() === targetYear && d.getMonth() === targetMonth);
      }),
    }));
    subscriptionService
      .unmarkPaid(id, { dueDate: target.toISOString() })
      .then((result) => {
        if (!result?.success) {
          updateSubInList(id, () => snapshot);
          setError(result?.error || 'Failed to unmark payment');
          return;
        }
        if (result.subscription) updateSubInList(id, () => result.subscription);
      })
      .catch((err) => {
        updateSubInList(id, () => snapshot);
        setError(err?.message || 'Failed to unmark payment');
      });
  };

  const confirmBulkPay = () => {
    if (!bulkPayContext?.sub?.id || !bulkPayContext?.untilDate) return;
    const item = bulkPayContext.sub;
    const id = item.id;
    const snapshot = item;
    const cap = new Date(bulkPayContext.untilDate);
    const calendarYear = Math.max(
      item.recurrenceEndDate ? new Date(item.recurrenceEndDate).getFullYear() : 0,
      cap.getFullYear()
    );
    const allDues = expandDueDates(item, calendarYear);
    const unpaidDues = allDues.filter((d) => d <= cap && !findPaymentForMonth(item, d));
    const paidOnLabel = new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    const optimisticPayments = unpaidDues.map((d) => ({
      _optimistic: true,
      paidAt: d.toISOString(),
      amount: Number(item.monthlyCost) || 0,
      currency: item.currency || 'USD',
      note: `Paid on ${paidOnLabel}`,
    }));
    updateSubInList(id, (it) => ({
      ...it,
      payments: [...(it.payments || []), ...optimisticPayments],
    }));
    setBulkPayContext(null);
    setIsBulkPaying(true);
    subscriptionService
      .markPaidThrough(id, {
        untilDate: bulkPayContext.untilDate,
        currency: item.currency || 'USD',
      })
      .then((result) => {
        setIsBulkPaying(false);
        if (!result?.success) {
          updateSubInList(id, () => snapshot);
          setError(result?.error || 'Failed to mark payments');
          return;
        }
        if (result.subscription) updateSubInList(id, () => result.subscription);
      })
      .catch((err) => {
        setIsBulkPaying(false);
        updateSubInList(id, () => snapshot);
        setError(err?.message || 'Failed to mark payments');
      });
  };

  const confirmDelete = async () => {
    if (!deletingSub) return;
    setIsDeleting(true);
    const result = await subscriptionService.deleteSubscription(deletingSub.id);
    setIsDeleting(false);
    if (!result.success) {
      setError(result.error || 'Failed to delete');
      setDeletingSub(null);
      return;
    }
    setDeletingSub(null);
    await loadSubscriptions();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
            Subscriptions
          </h1>
          <p className="text-sm sm:text-base text-slate-400">Manage recurring subscriptions with credentials and payment tracking.</p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end sm:justify-start w-full sm:w-auto">
          <button
            className="btn-primary bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-sm sm:text-base whitespace-nowrap"
            onClick={() => {
              setCreateForm({ ...emptySubscriptionForm, recurrenceEndDate: defaultRecurrenceEndDate() });
              setShowCreateModal(true);
            }}
          >
            <Plus className="w-4 h-4 inline-block mr-1" /> Add Subscription
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4">
        <div className="glass-morphism rounded-lg sm:rounded-xl p-2 sm:p-3 md:p-4 border border-cyan-500/20 min-w-0">
          <p className="text-slate-400 text-[10px] sm:text-xs md:text-sm truncate">Total Subscriptions</p>
          <p className="text-base sm:text-xl md:text-2xl font-bold text-white mt-0.5 sm:mt-1">{subscriptions.length}</p>
        </div>
        <div className="glass-morphism rounded-lg sm:rounded-xl p-2 sm:p-3 md:p-4 border border-emerald-500/20 min-w-0">
          <p className="text-slate-400 text-[10px] sm:text-xs md:text-sm truncate">Cost This Month</p>
          {totalsByCurrency.length === 0 ? (
            <p className="text-base sm:text-xl md:text-2xl font-bold text-emerald-400 mt-0.5 sm:mt-1">—</p>
          ) : (
            <div className="mt-0.5 sm:mt-1 space-y-0.5">
              {totalsByCurrency.map(({ currency, amount }) => (
                <p key={currency} className="text-sm sm:text-lg md:text-2xl font-bold text-emerald-400 truncate leading-tight">
                  {formatCurrency(amount, currency)}
                </p>
              ))}
            </div>
          )}
        </div>
        <div className="glass-morphism rounded-lg sm:rounded-xl p-2 sm:p-3 md:p-4 border border-blue-500/20 min-w-0">
          <p className="text-slate-400 text-[10px] sm:text-xs md:text-sm truncate">This Month's Payments</p>
          <p className="text-base sm:text-xl md:text-2xl font-bold text-blue-400 mt-0.5 sm:mt-1">{viewedMonthTotals.count}</p>
          {(viewedMonthTotals.due.length > 0 || viewedMonthTotals.paid.length > 0) ? (
            <div className="mt-1 space-y-0.5 text-[10px] sm:text-xs md:text-sm">
              {viewedMonthTotals.due.map(({ currency, amount }) => (
                <p key={`due-${currency}`} className="text-rose-300 truncate">Due {formatCurrency(amount, currency)}</p>
              ))}
              {viewedMonthTotals.paid.map(({ currency, amount }) => (
                <p key={`paid-${currency}`} className="text-emerald-300 truncate">Paid {formatCurrency(amount, currency)}</p>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {error && (
        <div className="glass-morphism rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
          {error}
        </div>
      )}

      {!loading && subscriptions.length > 0 ? (
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, provider, username, URL, status, cost, notes…"
            className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl pl-9 pr-9 py-2 sm:py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 focus:bg-slate-900"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 rounded"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="glass-morphism rounded-xl p-4 sm:p-6 text-center text-slate-300">Loading subscriptions...</div>
      ) : subscriptions.length === 0 ? (
        <div className="glass-morphism rounded-2xl border border-slate-700/50 bg-slate-950/80 p-6 text-center text-slate-400">
          <h2 className="text-lg font-semibold text-white">No subscriptions yet</h2>
          <p className="text-sm mt-2">Add your first subscription to start tracking payments.</p>
        </div>
      ) : filteredSubscriptions.length === 0 ? (
        <div className="glass-morphism rounded-xl border border-slate-700/50 bg-slate-950/60 p-6 text-center text-slate-400 text-sm">
          No subscriptions match “{searchQuery}”.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filteredSubscriptions.map((sub) => (
            <div key={sub.id} className="glass-morphism rounded-xl sm:rounded-2xl border border-slate-700/40 overflow-hidden shadow-lg sm:shadow-xl shadow-slate-950/20">
              {/* Header */}
              <div className="bg-gradient-to-r from-slate-800/50 to-slate-900/50 border-b border-slate-700/30 px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="p-1.5 sm:p-2 rounded-lg bg-cyan-500/20 flex-shrink-0">
                    <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-white text-xs sm:text-sm md:text-base truncate"><Highlight text={sub.name} query={searchQuery} /></h3>
                    <p className="text-[10px] sm:text-xs text-slate-400 truncate"><Highlight text={sub.billingCycle || 'Monthly'} query={searchQuery} /> subscription</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-medium flex-shrink-0 ${
                  sub.status === 'Active' ? 'bg-emerald-500/20 text-emerald-300' :
                  sub.status === 'Paused' ? 'bg-yellow-500/20 text-yellow-300' :
                  sub.status === 'Cancelled' ? 'bg-red-500/20 text-red-300' :
                  'bg-slate-500/20 text-slate-300'
                }`}>
                  <Highlight text={sub.status || 'Active'} query={searchQuery} />
                </span>
                <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                  <button
                    onClick={() => {
                      setShowEditPassword(false);
                      setEditingSub(sub);
                      setEditingForm({
                        name: sub.name,
                        username: sub.username || '',
                        password: sub.password || '',
                        authType: sub.authType || 'password',
                        url: sub.url || '',
                        status: sub.status || 'Active',
                        monthlyCost: sub.monthlyCost || 0,
                        currency: sub.currency || 'USD',
                        billingCycle: sub.billingCycle || 'Monthly',
                        nextPaymentDate: sub.nextPaymentDate ? new Date(sub.nextPaymentDate).toISOString().slice(0, 10) : '',
                        recurrenceEndDate: sub.recurrenceEndDate ? new Date(sub.recurrenceEndDate).toISOString().slice(0, 10) : defaultRecurrenceEndDate(),
                        notes: sub.notes || '',
                      });
                    }}
                    className="p-1 sm:p-1.5 md:p-2 rounded-md sm:rounded-lg text-blue-400 hover:bg-blue-500/10 transition"
                    title="Edit subscription"
                  >
                    <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                  <button
                    onClick={() => setDeletingSub(sub)}
                    className="p-1 sm:p-1.5 md:p-2 rounded-md sm:rounded-lg text-red-400 hover:bg-red-500/10 transition"
                    title="Delete subscription"
                  >
                    <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-3 sm:p-4 space-y-2.5 sm:space-y-3">
                <div className="space-y-2 sm:space-y-2.5 text-xs sm:text-sm">
                  {sub.url ? (
                    <div>
                      <p className="text-slate-500 text-[10px] sm:text-xs uppercase tracking-wide mb-0.5">URL</p>
                      <a href={sub.url} target="_blank" rel="noopener noreferrer" className="text-cyan-300 hover:text-cyan-200 text-[10px] sm:text-xs truncate block">
                        <Highlight text={sub.url} query={searchQuery} />
                      </a>
                    </div>
                  ) : null}

                  <div>
                    <p className="text-slate-500 text-[10px] sm:text-xs uppercase tracking-wide mb-0.5">Username</p>
                    <div className="flex items-center gap-1">
                      <p className="flex-1 min-w-0 text-slate-200 text-[10px] sm:text-xs truncate">{sub.username ? <Highlight text={sub.username} query={searchQuery} /> : '—'}</p>
                      {sub.username ? (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(sub.username, sub.id, 'username')}
                          className={`p-1 rounded transition flex-shrink-0 ${copiedField === `${sub.id}:username` ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}
                          aria-label="Copy username"
                        >
                          {copiedField === `${sub.id}:username` ? <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> : <Copy className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div>
                    <p className="text-slate-500 text-[10px] sm:text-xs uppercase tracking-wide mb-1">
                      {sub.authType === 'google' ? 'Sign-in' : 'Password'}
                    </p>
                    {sub.authType === 'google' ? (
                      <div className="flex items-center gap-2 bg-slate-950/50 border border-slate-700/50 rounded p-1.5 sm:p-2">
                        <GoogleGlyph className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                        <span className="text-slate-200 text-[10px] sm:text-xs truncate">Continue with Google</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 sm:gap-2">
                        <input
                          type={showPasswords[sub.id] ? 'text' : 'password'}
                          value={sub.password || ''}
                          readOnly
                          className="flex-1 min-w-0 bg-slate-950/50 text-slate-200 font-mono text-[10px] sm:text-xs rounded p-1.5 sm:p-2 border border-slate-700/50 focus:outline-none truncate"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords((prev) => ({ ...prev, [sub.id]: !prev[sub.id] }))}
                          className="p-1 sm:p-1.5 rounded text-slate-400 hover:text-slate-200 transition flex-shrink-0"
                          aria-label="Toggle password visibility"
                        >
                          {showPasswords[sub.id] ? <EyeOff className="h-3 w-3 sm:h-4 sm:w-4" /> : <Eye className="h-3 w-3 sm:h-4 sm:w-4" />}
                        </button>
                        {sub.password ? (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(sub.password, sub.id, 'password')}
                            className={`p-1 sm:p-1.5 rounded transition flex-shrink-0 ${copiedField === `${sub.id}:password` ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}
                            aria-label="Copy password"
                          >
                            {copiedField === `${sub.id}:password` ? <Check className="h-3 w-3 sm:h-4 sm:w-4" /> : <Copy className="h-3 w-3 sm:h-4 sm:w-4" />}
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>

                  {sub.nextPaymentDate ? (
                    <div>
                      <p className="text-slate-500 text-[10px] sm:text-xs uppercase tracking-wide mb-0.5">Payments date on</p>
                      <p className="text-slate-200 text-[10px] sm:text-xs">{formatPaymentDate(getDisplayPaymentDate(sub.nextPaymentDate, sub.billingCycle, sub.payments))}</p>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <div>
                      <p className="text-slate-500 text-[10px] sm:text-xs uppercase tracking-wide mb-0.5">Cost</p>
                      <p className="text-slate-200 text-xs sm:text-sm font-semibold"><Highlight text={formatCurrency(sub.monthlyCost, sub.currency)} query={searchQuery} /></p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-[10px] sm:text-xs uppercase tracking-wide mb-0.5">Cycle</p>
                      <p className="text-slate-200 text-[10px] sm:text-xs"><Highlight text={sub.billingCycle || 'Monthly'} query={searchQuery} /></p>
                    </div>
                  </div>

                  {sub.notes ? (
                    <div>
                      <p className="text-slate-500 text-[10px] sm:text-xs uppercase tracking-wide mb-0.5">Notes</p>
                      <p className="text-slate-200 text-[10px] sm:text-xs leading-relaxed line-clamp-2"><Highlight text={sub.notes} query={searchQuery} /></p>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-slate-700/30 px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-950/30 space-y-1.5">
                {(() => {
                  const currentDue = getCurrentMonthDueDate(sub);
                  if (!currentDue) return <p className="text-[10px] sm:text-xs text-slate-400 text-center">No payment due this month</p>;
                  const monthLabel = currentDue.toLocaleDateString('en-US', { month: 'short' });
                  if (isMonthPaid(sub, currentDue)) {
                    return (
                      <button
                        onClick={() => handleUnmarkPaid(sub, currentDue)}
                        className="w-full py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-medium bg-emerald-500/10 text-emerald-300 hover:bg-rose-500/15 hover:text-rose-300 transition flex items-center justify-center gap-1.5 sm:gap-2 group"
                        title={`Click to unmark ${monthLabel} as paid`}
                      >
                        <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 group-hover:hidden" />
                        <X className="w-3 h-3 sm:w-4 sm:h-4 hidden group-hover:inline-block" />
                        <span className="group-hover:hidden">{monthLabel} paid</span>
                        <span className="hidden group-hover:inline">Unmark {monthLabel}</span>
                      </button>
                    );
                  }
                  return (
                    <button
                      onClick={() => handleMarkPaid(sub, currentDue)}
                      className="w-full py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-medium bg-lime-500/20 text-lime-300 hover:bg-lime-500/30 transition flex items-center justify-center gap-1.5 sm:gap-2"
                    >
                      <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span>Mark {monthLabel} paid</span>
                    </button>
                  );
                })()}
                {sub.nextPaymentDate && ['Monthly', 'Quarterly', 'Annual'].includes(sub.billingCycle) ? (
                  <button
                    onClick={() => setBulkPayContext({ sub, untilDate: '' })}
                    className="w-full py-1 sm:py-1.5 px-2 rounded-lg text-[11px] sm:text-xs font-medium bg-slate-800/60 text-slate-300 hover:bg-slate-700/60 transition flex items-center justify-center gap-1.5"
                  >
                    <CalendarCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    <span>Pay through…</span>
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-700/50 bg-slate-950 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 sm:px-6 py-3 sm:py-4">
              <div>
                <h2 className="text-base sm:text-xl font-semibold text-white">Add Subscription</h2>
                <p className="text-xs sm:text-sm text-slate-400 hidden sm:block">Store credentials, billing, and next payment info.</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white text-sm sm:text-base">Cancel</button>
            </div>
            <form onSubmit={handleCreate} className="grid gap-3 sm:gap-4 p-4 sm:p-6 md:grid-cols-2 overflow-y-auto">
              <SuggestInput suggestions={suggestions.name} className="input-field text-sm sm:text-base md:col-span-2" placeholder="Subscription name" required value={createForm.name} onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))} />
              <SuggestInput suggestions={suggestions.username} className="input-field text-sm sm:text-base" placeholder="Username" required value={createForm.username} onChange={(e) => setCreateForm((p) => ({ ...p, username: e.target.value }))} />
              <div className="flex flex-col gap-1.5">
                {createForm.authType === 'google' ? (
                  <button
                    type="button"
                    onClick={() => setCreateForm((p) => ({ ...p, authType: 'password' }))}
                    className="input-field text-sm sm:text-base flex items-center justify-between gap-2 hover:bg-slate-800/60 transition"
                    title="Switch to password"
                  >
                    <span className="flex items-center gap-2">
                      <GoogleGlyph className="h-4 w-4" />
                      <span className="text-slate-200">Continue with Google</span>
                    </span>
                    <span className="text-[10px] text-slate-500">Use password</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type={showCreatePassword ? 'text' : 'password'}
                      className="input-field text-sm sm:text-base flex-1"
                      placeholder="Password"
                      required
                      value={createForm.password}
                      onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
                    />
                    <button type="button" onClick={() => setShowCreatePassword((p) => !p)} className="p-2 rounded text-slate-400 hover:text-white transition flex-shrink-0">
                      {showCreatePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                )}
                {createForm.authType !== 'google' ? (
                  <button
                    type="button"
                    onClick={() => setCreateForm((p) => ({ ...p, authType: 'google', password: '' }))}
                    className="self-start inline-flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-400 hover:text-cyan-300 transition"
                  >
                    <GoogleGlyph className="h-3 w-3" />
                    Continue with Google instead
                  </button>
                ) : null}
              </div>
              <SuggestInput suggestions={suggestions.url} className="input-field text-sm sm:text-base md:col-span-2" placeholder="URL (optional)" value={createForm.url} onChange={(e) => setCreateForm((p) => ({ ...p, url: e.target.value }))} />
              <select className="input-field text-sm sm:text-base" value={createForm.status} onChange={(e) => setCreateForm((p) => ({ ...p, status: e.target.value }))}>
                {['Active', 'Paused', 'Cancelled', 'Pending'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9]+(\.[0-9]+)?"
                className="input-field text-sm sm:text-base"
                placeholder="Cost"
                required
                value={createForm.monthlyCost}
                onChange={(e) => setCreateForm((p) => ({ ...p, monthlyCost: sanitizeCost(e.target.value) }))}
              />
              <select className="input-field text-sm sm:text-base" value={createForm.currency} onChange={(e) => setCreateForm((p) => ({ ...p, currency: e.target.value }))}>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="AED">AED</option>
              </select>
              <select className="input-field text-sm sm:text-base" value={createForm.billingCycle} onChange={(e) => setCreateForm((p) => ({
                ...p,
                billingCycle: e.target.value,
                recurrenceEndDate: e.target.value === 'One-time' ? '' : (p.recurrenceEndDate || defaultRecurrenceEndDate()),
              }))}>
                {['Monthly', 'Quarterly', 'Annual', 'One-time'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <label className="flex flex-col gap-1 text-xs text-slate-400">
                {createForm.billingCycle === 'One-time' ? 'Payment date' : 'First payment date'}
                <input type="date" className="input-field text-sm sm:text-base" value={createForm.nextPaymentDate} onChange={(e) => setCreateForm((p) => ({ ...p, nextPaymentDate: e.target.value }))} />
              </label>
              {createForm.billingCycle !== 'One-time' ? (
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  Recurrence ends (optional — defaults to end of year)
                  <input type="date" className="input-field text-sm sm:text-base" value={createForm.recurrenceEndDate} onChange={(e) => setCreateForm((p) => ({ ...p, recurrenceEndDate: e.target.value }))} />
                </label>
              ) : null}
              <textarea className="input-field text-sm sm:text-base min-h-[100px] md:col-span-2" placeholder="Notes" value={createForm.notes} onChange={(e) => setCreateForm((p) => ({ ...p, notes: e.target.value }))} />
              <div className="md:col-span-2 flex flex-wrap gap-2 justify-end">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary text-sm px-3 py-2">Cancel</button>
                <button type="submit" className="btn-primary text-sm px-3 py-2">Save Subscription</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingSub && editingForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-700/50 bg-slate-950 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 sm:px-6 py-3 sm:py-4">
              <div>
                <h2 className="text-base sm:text-xl font-semibold text-white">Edit Subscription</h2>
                <p className="text-xs sm:text-sm text-slate-400 hidden sm:block">Update credentials, billing, and next due date.</p>
              </div>
              <button onClick={() => { setEditingSub(null); setEditingForm(null); }} className="text-slate-400 hover:text-white text-sm sm:text-base">Cancel</button>
            </div>
            <form onSubmit={handleEdit} className="grid gap-3 sm:gap-4 p-4 sm:p-6 md:grid-cols-2 overflow-y-auto">
              <SuggestInput suggestions={suggestions.name} className="input-field text-sm sm:text-base md:col-span-2" placeholder="Subscription name" required value={editingForm.name} onChange={(e) => setEditingForm((p) => ({ ...p, name: e.target.value }))} />
              <SuggestInput suggestions={suggestions.username} className="input-field text-sm sm:text-base" placeholder="Username" required value={editingForm.username} onChange={(e) => setEditingForm((p) => ({ ...p, username: e.target.value }))} />
              <div className="flex flex-col gap-1.5">
                {editingForm.authType === 'google' ? (
                  <button
                    type="button"
                    onClick={() => setEditingForm((p) => ({ ...p, authType: 'password' }))}
                    className="input-field text-sm sm:text-base flex items-center justify-between gap-2 hover:bg-slate-800/60 transition"
                    title="Switch to password"
                  >
                    <span className="flex items-center gap-2">
                      <GoogleGlyph className="h-4 w-4" />
                      <span className="text-slate-200">Continue with Google</span>
                    </span>
                    <span className="text-[10px] text-slate-500">Use password</span>
                  </button>
                ) : (
                <div className="flex items-center gap-2">
                <input
                  type={showEditPassword ? 'text' : 'password'}
                  className="input-field text-sm sm:text-base flex-1"
                  placeholder="Password"
                  required
                  value={editingForm.password || ''}
                  onChange={(e) => setEditingForm((p) => ({ ...p, password: e.target.value }))}
                />
                <button type="button" onClick={() => setShowEditPassword((p) => !p)} className="p-2 rounded text-slate-400 hover:text-white transition flex-shrink-0">
                  {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                </div>
                )}
                {editingForm.authType !== 'google' ? (
                  <button
                    type="button"
                    onClick={() => setEditingForm((p) => ({ ...p, authType: 'google', password: '' }))}
                    className="self-start inline-flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-400 hover:text-cyan-300 transition"
                  >
                    <GoogleGlyph className="h-3 w-3" />
                    Continue with Google instead
                  </button>
                ) : null}
              </div>
              <SuggestInput suggestions={suggestions.url} className="input-field text-sm sm:text-base md:col-span-2" placeholder="URL (optional)" value={editingForm.url} onChange={(e) => setEditingForm((p) => ({ ...p, url: e.target.value }))} />
              <select className="input-field text-sm sm:text-base" value={editingForm.status} onChange={(e) => setEditingForm((p) => ({ ...p, status: e.target.value }))}>
                {['Active', 'Paused', 'Cancelled', 'Pending'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9]+(\.[0-9]+)?"
                className="input-field text-sm sm:text-base"
                placeholder="Cost"
                required
                value={editingForm.monthlyCost}
                onChange={(e) => setEditingForm((p) => ({ ...p, monthlyCost: sanitizeCost(e.target.value) }))}
              />
              <select className="input-field text-sm sm:text-base" value={editingForm.currency} onChange={(e) => setEditingForm((p) => ({ ...p, currency: e.target.value }))}>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="AED">AED</option>
              </select>
              <select className="input-field text-sm sm:text-base" value={editingForm.billingCycle} onChange={(e) => setEditingForm((p) => ({
                ...p,
                billingCycle: e.target.value,
                recurrenceEndDate: e.target.value === 'One-time' ? '' : (p.recurrenceEndDate || defaultRecurrenceEndDate()),
              }))}>
                {['Monthly', 'Quarterly', 'Annual', 'One-time'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <label className="flex flex-col gap-1 text-xs text-slate-400">
                {editingForm.billingCycle === 'One-time' ? 'Payment date' : 'First payment date'}
                <input type="date" className="input-field text-sm sm:text-base" value={editingForm.nextPaymentDate} onChange={(e) => setEditingForm((p) => ({ ...p, nextPaymentDate: e.target.value }))} />
              </label>
              {editingForm.billingCycle !== 'One-time' ? (
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  Recurrence ends (optional — defaults to end of year)
                  <input type="date" className="input-field text-sm sm:text-base" value={editingForm.recurrenceEndDate} onChange={(e) => setEditingForm((p) => ({ ...p, recurrenceEndDate: e.target.value }))} />
                </label>
              ) : null}
              <textarea className="input-field text-sm sm:text-base min-h-[100px] md:col-span-2" placeholder="Notes" value={editingForm.notes} onChange={(e) => setEditingForm((p) => ({ ...p, notes: e.target.value }))} />
              <div className="md:col-span-2 flex flex-wrap gap-2 justify-end">
                <button type="button" onClick={() => { setEditingSub(null); setEditingForm(null); }} className="btn-secondary text-sm px-3 py-2">Cancel</button>
                <button type="submit" className="btn-primary text-sm px-3 py-2">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk pay modal */}
      {bulkPayContext && (() => {
        const { sub, untilDate } = bulkPayContext;
        const recurrenceEndYear = sub.recurrenceEndDate ? new Date(sub.recurrenceEndDate).getFullYear() : new Date().getFullYear();
        const allDues = expandDueDates(sub, Math.max(recurrenceEndYear, new Date().getFullYear()));
        const unpaidDues = allDues.filter((d) => !findPaymentForMonth(sub, d));
        const cap = untilDate ? new Date(untilDate) : null;
        const previewMonths = cap ? unpaidDues.filter((d) => d <= cap) : [];
        const total = previewMonths.length * (Number(sub.monthlyCost) || 0);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-4">
            <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950 shadow-2xl">
              <div className="px-5 py-4 border-b border-slate-800">
                <h3 className="text-base sm:text-lg font-semibold text-white">Pay through a date</h3>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Mark all unpaid {sub.billingCycle.toLowerCase()} dues for <span className="font-semibold text-white">{sub.name}</span> as paid, up to and including the chosen due date.
                </p>
              </div>
              <div className="px-5 py-4 space-y-3">
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  Pay through which due date?
                  <select
                    className="input-field text-sm"
                    value={untilDate}
                    onChange={(e) => setBulkPayContext((p) => ({ ...p, untilDate: e.target.value }))}
                    disabled={unpaidDues.length === 0}
                  >
                    <option value="">— select due date —</option>
                    {unpaidDues.map((d) => {
                      const iso = d.toISOString().slice(0, 10);
                      return (
                        <option key={iso} value={iso}>
                          {d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </option>
                      );
                    })}
                  </select>
                </label>
                {unpaidDues.length === 0 ? (
                  <p className="text-xs text-emerald-300">All scheduled dues are already paid.</p>
                ) : untilDate ? (
                  <div className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-3">
                    <p className="text-xs text-slate-400">
                      {previewMonths.length} payment{previewMonths.length === 1 ? '' : 's'} will be recorded:
                    </p>
                    <p className="mt-1 text-sm text-slate-200 leading-relaxed">
                      {previewMonths.map((d) => d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })).join(', ')}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-emerald-300">
                      Total: {formatCurrency(total, sub.currency || 'USD')}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Pick a due date to see what will be paid.</p>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-slate-800 bg-slate-900/60 px-5 py-3">
                <button type="button" onClick={() => setBulkPayContext(null)} disabled={isBulkPaying} className="btn-secondary text-xs sm:text-sm px-3 py-2 disabled:opacity-50">Cancel</button>
                <button type="button" onClick={confirmBulkPay} disabled={isBulkPaying || !untilDate || previewMonths.length === 0} className="inline-flex items-center gap-1.5 rounded-lg bg-lime-500/20 border border-lime-500/40 text-lime-200 hover:bg-lime-500/30 text-xs sm:text-sm font-semibold px-3 py-2 transition disabled:opacity-50">
                  <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {isBulkPaying ? 'Saving…' : 'Mark all paid'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete confirm */}
      {deletingSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-red-500/30 bg-slate-950 shadow-2xl">
            <div className="px-5 py-5 sm:px-6 sm:py-6">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="p-2 sm:p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-red-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base sm:text-lg font-semibold text-white">Delete Subscription</h3>
                  <p className="text-xs sm:text-sm text-slate-300 mt-1">
                    Are you sure you want to delete <span className="font-semibold text-white">{deletingSub.name}</span>?
                    This removes the subscription and its payment history.
                  </p>
                  <p className="text-[11px] sm:text-xs text-red-300 mt-2">This action cannot be undone.</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 sm:gap-3 border-t border-slate-800 bg-slate-900/60 px-5 py-3 sm:px-6 sm:py-4">
              <button type="button" onClick={() => setDeletingSub(null)} disabled={isDeleting} className="btn-secondary text-xs sm:text-sm px-3 sm:px-4 py-2 disabled:opacity-50">Cancel</button>
              <button type="button" onClick={confirmDelete} disabled={isDeleting} className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-200 hover:bg-red-500/30 text-xs sm:text-sm font-semibold px-3 sm:px-4 py-2 transition disabled:opacity-50">
                <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionsPage;
