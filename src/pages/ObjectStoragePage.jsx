import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { HardDrive, Plus, Pencil, Trash2, CheckCircle, AlertTriangle, CalendarCheck, Copy, Check, X, Search } from 'lucide-react';
import objectStorageService from '../services/objectStorageService';
import { expandDueDates, findPaymentForMonth } from '../components/PaymentCalendar';
import Highlight from '../components/Highlight';
import SuggestInput from '../components/SuggestInput';
import useTabRefresh from '../hooks/useTabRefresh';
import { getDisplayPaymentDate, formatPaymentDate } from '../utils/billingDate';

const emptyForm = {
  name: '',
  provider: '',
  providerAccount: '',
  size: '',
  location: '',
  status: 'Active',
  monthlyCost: '',
  currency: 'USD',
  billingCycle: 'Monthly',
  nextPaymentDate: '',
  recurrenceEndDate: '',
  notes: '',
};

const formatCurrency = (value, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(value) || 0);

// Sizes are entered as plain numbers (GB). Append "GB" on display unless the
// user already wrote their own unit (TB, MB, etc.).
const formatSize = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  return /[a-zA-Z]/.test(raw) ? raw : `${raw} GB`;
};

const defaultRecurrenceEndDate = () => {
  const y = new Date().getFullYear();
  return `${y}-12-31`;
};

const sanitizeCost = (value) => {
  const cleaned = (value || '').replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
};

const getCurrentMonthDueDate = (item) => {
  if (!item?.nextPaymentDate) return null;
  const anchor = new Date(item.nextPaymentDate);
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const step = { Monthly: 1, Quarterly: 3, Annual: 12 }[item.billingCycle];
  if (!step) return null;
  const anchorMonths = anchor.getFullYear() * 12 + anchor.getMonth();
  const currentMonths = year * 12 + month;
  const diff = currentMonths - anchorMonths;
  if (diff < 0 || diff % step !== 0) return null;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const day = Math.min(anchor.getDate(), daysInMonth);
  return new Date(year, month, day);
};

const isMonthPaid = (item, date) => {
  if (!date || !Array.isArray(item?.payments)) return false;
  return item.payments.some((p) => {
    if (!p?.paidAt) return false;
    const d = new Date(p.paidAt);
    return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth();
  });
};

const ObjectStoragePage = () => {
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [editingForm, setEditingForm] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [bulkPayContext, setBulkPayContext] = useState(null);
  const [isBulkPaying, setIsBulkPaying] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '');
  const [dueDateFilter, setDueDateFilter] = useState(() => searchParams.get('dueDate') || '');
  const [focusId, setFocusId] = useState(() => searchParams.get('focus') || '');

  useEffect(() => {
    const urlSearch = searchParams.get('search');
    if (urlSearch !== null) setSearchQuery(urlSearch);
    setDueDateFilter(searchParams.get('dueDate') || '');
    setFocusId(searchParams.get('focus') || '');
  }, [searchParams]);

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

  const suggestions = useMemo(() => ({
    name: items.map((i) => i.name),
    provider: items.map((i) => i.provider),
    providerAccount: items.map((i) => i.providerAccount),
    size: items.map((i) => i.size),
    location: items.map((i) => i.location),
  }), [items]);

  const filtered = useMemo(() => {
    if (focusId) return items.filter((v) => v.id === focusId);
    const q = searchQuery.trim().toLowerCase();
    let target = null;
    if (dueDateFilter) {
      const parts = dueDateFilter.split('-').map(Number);
      if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
        target = new Date(parts[0], parts[1] - 1, parts[2]);
      }
    }
    return items.filter((v) => {
      if (q) {
        const haystack = [
          v.name, v.provider, v.providerAccount, v.size, v.location,
          v.status, v.billingCycle, v.currency, v.notes,
          v.monthlyCost != null ? String(v.monthlyCost) : '',
          v.nextPaymentDate ? new Date(v.nextPaymentDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (target) {
        const dues = expandDueDates(v, target.getFullYear());
        const matches = dues.some((d) =>
          d.getFullYear() === target.getFullYear()
          && d.getMonth() === target.getMonth()
          && d.getDate() === target.getDate()
        );
        if (!matches) return false;
      }
      return true;
    });
  }, [items, searchQuery, dueDateFilter, focusId]);

  const currentMonthTotals = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const costMap = new Map();
    const paid = new Map();
    const due = new Map();
    let count = 0;
    for (const item of items) {
      const dueDates = expandDueDates(item, year);
      const dueThisMonth = dueDates.find((d) => d.getFullYear() === year && d.getMonth() === month);
      if (!dueThisMonth) continue;
      count += 1;
      const cur = item.currency || 'USD';
      const amount = Number(item.monthlyCost) || 0;
      costMap.set(cur, (costMap.get(cur) || 0) + amount);
      const payment = findPaymentForMonth(item, dueThisMonth);
      if (payment) {
        const paidAmount = Number(payment.amount ?? amount) || 0;
        paid.set(cur, (paid.get(cur) || 0) + paidAmount);
      } else {
        due.set(cur, (due.get(cur) || 0) + amount);
      }
    }
    return {
      count,
      totals: Array.from(costMap.entries()).map(([currency, amount]) => ({ currency, amount })),
      paid: Array.from(paid.entries()).map(([currency, amount]) => ({ currency, amount })),
      due: Array.from(due.entries()).map(([currency, amount]) => ({ currency, amount })),
    };
  }, [items]);

  const load = async ({ force = false, silent = false } = {}) => {
    if (!silent) setLoading(true);
    const result = await objectStorageService.getAll({ force });
    if (result.success) {
      setItems(result.items);
      setError('');
    } else {
      setError(result.error || 'Failed to load object storage items');
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useTabRefresh(() => load({ force: true, silent: true }));

  const handleCreate = async (e) => {
    e.preventDefault();
    const payload = {
      ...createForm,
      monthlyCost: Number(createForm.monthlyCost) || 0,
      nextPaymentDate: createForm.nextPaymentDate || null,
      recurrenceEndDate: createForm.recurrenceEndDate || null,
    };
    const result = await objectStorageService.create(payload);
    if (!result.success) {
      setError(result.error || 'Failed to create object storage');
      return;
    }
    setShowCreateModal(false);
    setCreateForm(emptyForm);
    await load();
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editing || !editingForm) return;
    const payload = {
      ...editingForm,
      monthlyCost: Number(editingForm.monthlyCost) || 0,
      nextPaymentDate: editingForm.nextPaymentDate || null,
      recurrenceEndDate: editingForm.recurrenceEndDate || null,
    };
    const result = await objectStorageService.update(editing.id, payload);
    if (!result.success) {
      setError(result.error || 'Failed to update object storage');
      return;
    }
    setEditing(null);
    setEditingForm(null);
    await load();
  };

  const updateItemInList = (id, updateFn) => {
    setItems((list) => list.map((it) => (it.id === id ? updateFn(it) : it)));
  };

  const confirmBulkPay = () => {
    if (!bulkPayContext?.item?.id || !bulkPayContext?.untilDate) return;
    const item = bulkPayContext.item;
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
    updateItemInList(id, (it) => ({
      ...it,
      payments: [...(it.payments || []), ...optimisticPayments],
    }));
    setBulkPayContext(null);
    setIsBulkPaying(true);
    objectStorageService
      .markPaidThrough(id, {
        untilDate: bulkPayContext.untilDate,
        currency: item.currency || 'USD',
      })
      .then((result) => {
        setIsBulkPaying(false);
        if (!result?.success) {
          updateItemInList(id, () => snapshot);
          setError(result?.error || 'Failed to mark payments');
          return;
        }
        if (result.item) updateItemInList(id, () => result.item);
      })
      .catch((err) => {
        setIsBulkPaying(false);
        updateItemInList(id, () => snapshot);
        setError(err?.message || 'Failed to mark payments');
      });
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setIsDeleting(true);
    const result = await objectStorageService.delete(deleting.id);
    setIsDeleting(false);
    if (!result.success) {
      setError(result.error || 'Failed to delete object storage');
      setDeleting(null);
      return;
    }
    setDeleting(null);
    await load();
  };

  const handleUnmarkPaid = (item, dueDate) => {
    if (!item?.id || !dueDate) return;
    const id = item.id;
    const snapshot = item;
    const target = new Date(dueDate);
    const targetYear = target.getFullYear();
    const targetMonth = target.getMonth();
    updateItemInList(id, (it) => ({
      ...it,
      payments: (it.payments || []).filter((p) => {
        if (!p?.paidAt) return true;
        const d = new Date(p.paidAt);
        return !(d.getFullYear() === targetYear && d.getMonth() === targetMonth);
      }),
    }));
    objectStorageService
      .unmarkPaid(id, { dueDate: target.toISOString() })
      .then((result) => {
        if (!result?.success) {
          updateItemInList(id, () => snapshot);
          setError(result?.error || 'Failed to unmark payment');
          return;
        }
        if (result.item) updateItemInList(id, () => result.item);
      })
      .catch((err) => {
        updateItemInList(id, () => snapshot);
        setError(err?.message || 'Failed to unmark payment');
      });
  };

  const handleMarkPaid = (item, dueDate = null) => {
    if (!item?.id) return;
    const paidAt = dueDate ? new Date(dueDate).toISOString() : new Date().toISOString();
    const paidOnLabel = new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    const optimisticPayment = {
      _optimistic: true,
      paidAt,
      amount: Number(item.monthlyCost) || 0,
      currency: item.currency || 'USD',
      note: `Paid on ${paidOnLabel}`,
    };
    const id = item.id;
    const snapshot = item;
    updateItemInList(id, (it) => ({
      ...it,
      payments: [...(it.payments || []), optimisticPayment],
    }));
    objectStorageService
      .markAsPaid(id, {
        amount: optimisticPayment.amount,
        currency: optimisticPayment.currency,
        paidAt,
        note: optimisticPayment.note,
      })
      .then((result) => {
        if (!result?.success) {
          updateItemInList(id, () => snapshot);
          setError(result?.error || 'Failed to mark payment as paid');
          return;
        }
        if (result.item) updateItemInList(id, () => result.item);
      })
      .catch((err) => {
        updateItemInList(id, () => snapshot);
        setError(err?.message || 'Failed to mark payment as paid');
      });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
            Object Storage
          </h1>
          <p className="text-sm sm:text-base text-slate-400">Track buckets, capacity, location, payments and due dates.</p>
        </div>
        <button
          className="btn-primary bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-sm sm:text-base"
          onClick={() => {
            setCreateForm({ ...emptyForm, recurrenceEndDate: defaultRecurrenceEndDate() });
            setShowCreateModal(true);
          }}
        >
          <Plus className="w-4 h-4 inline-block mr-1" /> Add Storage
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4">
        <div className="glass-morphism rounded-lg sm:rounded-xl p-2 sm:p-3 md:p-4 border border-cyan-500/20 min-w-0">
          <p className="text-slate-400 text-[10px] sm:text-xs md:text-sm truncate">Total Buckets</p>
          <p className="text-base sm:text-xl md:text-2xl font-bold text-white mt-0.5 sm:mt-1">{items.length}</p>
        </div>
        <div className="glass-morphism rounded-lg sm:rounded-xl p-2 sm:p-3 md:p-4 border border-emerald-500/20 min-w-0">
          <p className="text-slate-400 text-[10px] sm:text-xs md:text-sm truncate">Cost This Month</p>
          {currentMonthTotals.totals.length === 0 ? (
            <p className="text-base sm:text-xl md:text-2xl font-bold text-emerald-400 mt-0.5 sm:mt-1 truncate">—</p>
          ) : (
            <div className="mt-0.5 sm:mt-1 space-y-0.5">
              {currentMonthTotals.totals.map(({ currency, amount }) => (
                <p key={currency} className="text-sm sm:text-lg md:text-2xl font-bold text-emerald-400 truncate leading-tight">
                  {formatCurrency(amount, currency)}
                </p>
              ))}
            </div>
          )}
        </div>
        <div className="glass-morphism rounded-lg sm:rounded-xl p-2 sm:p-3 md:p-4 border border-blue-500/20 min-w-0">
          <p className="text-slate-400 text-[10px] sm:text-xs md:text-sm truncate">This Month's Payments</p>
          <p className="text-base sm:text-xl md:text-2xl font-bold text-blue-400 mt-0.5 sm:mt-1">{currentMonthTotals.count}</p>
          {(currentMonthTotals.due.length > 0 || currentMonthTotals.paid.length > 0) ? (
            <div className="mt-1 sm:mt-1.5 space-y-0.5 text-[10px] sm:text-xs md:text-sm">
              {currentMonthTotals.due.map(({ currency, amount }) => (
                <p key={`due-${currency}`} className="text-rose-300 truncate">
                  Due {formatCurrency(amount, currency)}
                </p>
              ))}
              {currentMonthTotals.paid.map(({ currency, amount }) => (
                <p key={`paid-${currency}`} className="text-emerald-300 truncate">
                  Paid {formatCurrency(amount, currency)}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-[10px] sm:text-xs md:text-sm text-slate-400 mt-0.5 sm:mt-1 truncate">No dues this month</p>
          )}
        </div>
      </div>

      {error && (
        <div className="glass-morphism rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
          {error}
        </div>
      )}

      <div>
        <div className="space-y-4">
          {!loading && items.length > 0 ? (
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, provider, size, location, status, cost, notes…"
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
            <div className="glass-morphism rounded-xl p-4 sm:p-6 md:p-8 text-center text-slate-300 text-sm sm:text-base">Loading object storage…</div>
          ) : items.length === 0 ? (
            <div className="glass-morphism rounded-2xl sm:rounded-3xl border border-slate-700/50 bg-slate-950/80 p-4 sm:p-6 md:p-8 text-center text-slate-400">
              <div className="max-w-xl mx-auto">
                <p className="text-xs sm:text-sm uppercase tracking-[0.15em] sm:tracking-[0.25em] text-cyan-300 mb-2 sm:mb-3">Object storage tracker</p>
                <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-white">No buckets yet</h2>
                <p className="text-xs sm:text-sm md:text-base text-slate-400 mt-2 sm:mt-3">Add your first bucket to track size, location, and recurring payments.</p>
                <button
                  type="button"
                  onClick={() => {
                    setCreateForm({ ...emptyForm, recurrenceEndDate: defaultRecurrenceEndDate() });
                    setShowCreateModal(true);
                  }}
                  className="mt-4 sm:mt-6 inline-flex items-center justify-center rounded-xl sm:rounded-2xl bg-cyan-500 px-4 sm:px-5 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-white transition hover:bg-cyan-400"
                >
                  <Plus className="w-4 h-4 mr-1 sm:mr-2" /> Add your first bucket
                </button>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="glass-morphism rounded-xl border border-slate-700/50 bg-slate-950/60 p-6 text-center text-slate-400 text-sm">
              No buckets match “{searchQuery}”.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {filtered.map((item) => (
                <div key={item.id} className="glass-morphism rounded-xl sm:rounded-2xl border border-slate-700/40 overflow-hidden shadow-lg sm:shadow-xl shadow-slate-950/20">
                  <div className="bg-gradient-to-r from-slate-800/50 to-slate-900/50 border-b border-slate-700/30 px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <div className="p-1.5 sm:p-2 rounded-lg bg-cyan-500/20 flex-shrink-0">
                        <HardDrive className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-300" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-white text-xs sm:text-sm md:text-base truncate"><Highlight text={item.name} query={searchQuery} /></h3>
                        <p className="text-[10px] sm:text-xs text-slate-400 truncate">{item.provider ? <Highlight text={item.provider} query={searchQuery} /> : 'No provider'}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-medium flex-shrink-0 ${
                      item.status === 'Active' ? 'bg-emerald-500/20 text-emerald-300' :
                      item.status === 'Paused' ? 'bg-yellow-500/20 text-yellow-300' :
                      item.status === 'Terminated' ? 'bg-red-500/20 text-red-300' :
                      'bg-slate-500/20 text-slate-300'
                    }`}>
                      <Highlight text={item.status} query={searchQuery} />
                    </span>
                    <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                      <button
                        onClick={() => {
                          setEditing(item);
                          setEditingForm({
                            name: item.name,
                            provider: item.provider || '',
                            providerAccount: item.providerAccount || '',
                            size: item.size || '',
                            location: item.location || '',
                            status: item.status || 'Active',
                            monthlyCost: item.monthlyCost || 0,
                            currency: item.currency || 'USD',
                            billingCycle: item.billingCycle || 'Monthly',
                            nextPaymentDate: item.nextPaymentDate ? new Date(item.nextPaymentDate).toISOString().slice(0, 10) : '',
                            recurrenceEndDate: item.recurrenceEndDate ? new Date(item.recurrenceEndDate).toISOString().slice(0, 10) : defaultRecurrenceEndDate(),
                            notes: item.notes || '',
                          });
                        }}
                        className="p-1 sm:p-1.5 md:p-2 rounded-md sm:rounded-lg text-blue-400 hover:bg-blue-500/10 transition"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                      <button
                        onClick={() => setDeleting(item)}
                        className="p-1 sm:p-1.5 md:p-2 rounded-md sm:rounded-lg text-red-400 hover:bg-red-500/10 transition"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="p-3 sm:p-4 space-y-2.5 sm:space-y-3">
                    <div className="space-y-2 sm:space-y-2.5 text-xs sm:text-sm">
                      <div className="grid grid-cols-2 gap-2 sm:gap-3">
                        <div className="min-w-0">
                          <p className="text-slate-500 text-[10px] sm:text-xs uppercase tracking-wide mb-0.5 sm:mb-1">Size</p>
                          <div className="flex items-center gap-1">
                            <p className="flex-1 min-w-0 text-slate-200 text-[10px] sm:text-xs truncate">{item.size ? <Highlight text={formatSize(item.size)} query={searchQuery} /> : '—'}</p>
                            {item.size ? (
                              <button
                                type="button"
                                onClick={() => copyToClipboard(formatSize(item.size), item.id, 'size')}
                                className={`p-1 rounded transition flex-shrink-0 ${copiedField === `${item.id}:size` ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}
                                aria-label="Copy size"
                              >
                                {copiedField === `${item.id}:size` ? <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> : <Copy className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <p className="text-slate-500 text-[10px] sm:text-xs uppercase tracking-wide mb-0.5 sm:mb-1">Location</p>
                          <div className="flex items-center gap-1">
                            <p className="flex-1 min-w-0 text-slate-200 text-[10px] sm:text-xs truncate">{item.location ? <Highlight text={item.location} query={searchQuery} /> : '—'}</p>
                            {item.location ? (
                              <button
                                type="button"
                                onClick={() => copyToClipboard(item.location, item.id, 'location')}
                                className={`p-1 rounded transition flex-shrink-0 ${copiedField === `${item.id}:location` ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}
                                aria-label="Copy location"
                              >
                                {copiedField === `${item.id}:location` ? <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> : <Copy className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {item.providerAccount && (
                        <div>
                          <p className="text-slate-500 text-[10px] sm:text-xs uppercase tracking-wide mb-0.5 sm:mb-1">Provider Account</p>
                          <p className="text-slate-200 text-[10px] sm:text-xs break-all"><Highlight text={item.providerAccount} query={searchQuery} /></p>
                        </div>
                      )}

                      {item.nextPaymentDate && (
                        <div>
                          <p className="text-slate-500 text-[10px] sm:text-xs uppercase tracking-wide mb-0.5 sm:mb-1">Payments date on</p>
                          <p className="text-slate-200 text-[10px] sm:text-xs">{formatPaymentDate(getDisplayPaymentDate(item.nextPaymentDate, item.billingCycle, item.payments))}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 sm:gap-3">
                        <div>
                          <p className="text-slate-500 text-[10px] sm:text-xs uppercase tracking-wide mb-0.5 sm:mb-1">Cost</p>
                          <p className="text-slate-200 text-xs sm:text-sm font-semibold"><Highlight text={formatCurrency(item.monthlyCost, item.currency)} query={searchQuery} /></p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-[10px] sm:text-xs uppercase tracking-wide mb-0.5 sm:mb-1">Cycle</p>
                          <p className="text-slate-200 text-[10px] sm:text-xs"><Highlight text={item.billingCycle || 'Monthly'} query={searchQuery} /></p>
                        </div>
                      </div>

                      {item.notes && (
                        <div>
                          <p className="text-slate-500 text-[10px] sm:text-xs uppercase tracking-wide mb-0.5 sm:mb-1">Notes</p>
                          <p className="text-slate-200 text-[10px] sm:text-xs leading-relaxed line-clamp-2"><Highlight text={item.notes} query={searchQuery} /></p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-slate-700/30 px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-950/30 space-y-1.5">
                    {(() => {
                      const currentDue = getCurrentMonthDueDate(item);
                      if (!currentDue) {
                        return <p className="text-[10px] sm:text-xs text-slate-400 text-center">No payment due this month</p>;
                      }
                      const monthLabel = currentDue.toLocaleDateString('en-US', { month: 'short' });
                      if (isMonthPaid(item, currentDue)) {
                        return (
                          <button
                            onClick={() => handleUnmarkPaid(item, currentDue)}
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
                          onClick={() => handleMarkPaid(item, currentDue)}
                          className="w-full py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-medium bg-lime-500/20 text-lime-300 hover:bg-lime-500/30 transition flex items-center justify-center gap-1.5 sm:gap-2"
                          title={`Mark ${monthLabel} paid`}
                        >
                          <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span>Mark {monthLabel} paid</span>
                        </button>
                      );
                    })()}
                    {item.nextPaymentDate && ['Monthly', 'Quarterly', 'Annual'].includes(item.billingCycle) ? (
                      <button
                        onClick={() => setBulkPayContext({ item, untilDate: '' })}
                        className="w-full py-1 sm:py-1.5 px-2 rounded-lg text-[11px] sm:text-xs font-medium bg-slate-800/60 text-slate-300 hover:bg-slate-700/60 transition flex items-center justify-center gap-1.5"
                        title="Mark multiple months as paid up to a chosen date"
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
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-700/50 bg-slate-950 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0">
              <div className="min-w-0 flex-1 pr-2">
                <h2 className="text-base sm:text-xl font-semibold text-white truncate">Add Object Storage</h2>
                <p className="text-xs sm:text-sm text-slate-400 hidden sm:block">Store bucket details, billing, and next payment information.</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white text-sm sm:text-base flex-shrink-0">Cancel</button>
            </div>
            <form onSubmit={handleCreate} className="grid gap-3 sm:gap-4 p-4 sm:p-6 md:grid-cols-2 overflow-y-auto">
              <SuggestInput suggestions={suggestions.name} className="input-field text-sm sm:text-base" placeholder="Bucket / storage name" required value={createForm.name} onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))} />
              <SuggestInput suggestions={suggestions.provider} className="input-field text-sm sm:text-base" placeholder="Provider (e.g. AWS S3, Backblaze)" value={createForm.provider} onChange={(e) => setCreateForm((prev) => ({ ...prev, provider: e.target.value }))} />
              <SuggestInput
                suggestions={suggestions.providerAccount}
                type="email"
                className="input-field text-sm sm:text-base"
                placeholder="Provider Account (email)"
                value={createForm.providerAccount}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, providerAccount: e.target.value }))}
              />
              <SuggestInput suggestions={suggestions.size} className="input-field text-sm sm:text-base" placeholder="Size in GB (e.g. 250)" value={createForm.size} onChange={(e) => setCreateForm((prev) => ({ ...prev, size: e.target.value }))} />
              <SuggestInput suggestions={suggestions.location} className="input-field text-sm sm:text-base" placeholder="Location / Region (e.g. us-east-1)" value={createForm.location} onChange={(e) => setCreateForm((prev) => ({ ...prev, location: e.target.value }))} />
              <select className="input-field text-sm sm:text-base" value={createForm.status} onChange={(e) => setCreateForm((prev) => ({ ...prev, status: e.target.value }))}>
                {['Active', 'Paused', 'Terminated', 'Pending'].map((s) => (
                  <option value={s} key={s}>{s}</option>
                ))}
              </select>
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9]+(\.[0-9]+)?"
                className="input-field text-sm sm:text-base"
                placeholder="Cost"
                required
                value={createForm.monthlyCost}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, monthlyCost: sanitizeCost(e.target.value) }))}
              />
              <select className="input-field text-sm sm:text-base" value={createForm.currency} onChange={(e) => setCreateForm((prev) => ({ ...prev, currency: e.target.value }))}>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="AED">AED</option>
              </select>
              <select className="input-field text-sm sm:text-base" value={createForm.billingCycle} onChange={(e) => setCreateForm((prev) => ({
                ...prev,
                billingCycle: e.target.value,
                recurrenceEndDate: e.target.value === 'One-time' ? '' : (prev.recurrenceEndDate || defaultRecurrenceEndDate()),
              }))}>
                {['Monthly', 'Quarterly', 'Annual', 'One-time'].map((c) => (
                  <option value={c} key={c}>{c}</option>
                ))}
              </select>
              <label className="flex flex-col gap-1 text-xs text-slate-400">
                {createForm.billingCycle === 'One-time' ? 'Payment date' : 'First payment date'}
                <input type="date" className="input-field text-sm sm:text-base" value={createForm.nextPaymentDate} onChange={(e) => setCreateForm((prev) => ({ ...prev, nextPaymentDate: e.target.value }))} />
              </label>
              {createForm.billingCycle !== 'One-time' ? (
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  Recurrence ends (optional — defaults to end of year)
                  <input type="date" className="input-field text-sm sm:text-base" value={createForm.recurrenceEndDate} onChange={(e) => setCreateForm((prev) => ({ ...prev, recurrenceEndDate: e.target.value }))} />
                </label>
              ) : null}
              <textarea className="input-field text-sm sm:text-base min-h-[100px] sm:min-h-[120px] md:col-span-2" placeholder="Notes" value={createForm.notes} onChange={(e) => setCreateForm((prev) => ({ ...prev, notes: e.target.value }))} />
              <div className="md:col-span-2 flex flex-wrap gap-2 sm:gap-3 justify-end">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary text-sm sm:text-base px-3 sm:px-4 py-2">Cancel</button>
                <button type="submit" className="btn-primary text-sm sm:text-base px-3 sm:px-4 py-2">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editing && editingForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-700/50 bg-slate-950 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0">
              <div className="min-w-0 flex-1 pr-2">
                <h2 className="text-base sm:text-xl font-semibold text-white truncate">Edit Object Storage</h2>
                <p className="text-xs sm:text-sm text-slate-400 hidden sm:block">Update bucket metadata, billing, and next due date.</p>
              </div>
              <button onClick={() => { setEditing(null); setEditingForm(null); }} className="text-slate-400 hover:text-white text-sm sm:text-base flex-shrink-0">Cancel</button>
            </div>
            <form onSubmit={handleEdit} className="grid gap-3 sm:gap-4 p-4 sm:p-6 md:grid-cols-2 overflow-y-auto">
              <SuggestInput suggestions={suggestions.name} className="input-field text-sm sm:text-base" placeholder="Bucket / storage name" required value={editingForm.name} onChange={(e) => setEditingForm((prev) => ({ ...prev, name: e.target.value }))} />
              <SuggestInput suggestions={suggestions.provider} className="input-field text-sm sm:text-base" placeholder="Provider" value={editingForm.provider} onChange={(e) => setEditingForm((prev) => ({ ...prev, provider: e.target.value }))} />
              <SuggestInput
                suggestions={suggestions.providerAccount}
                type="email"
                className="input-field text-sm sm:text-base"
                placeholder="Provider Account (email)"
                value={editingForm.providerAccount}
                onChange={(e) => setEditingForm((prev) => ({ ...prev, providerAccount: e.target.value }))}
              />
              <SuggestInput suggestions={suggestions.size} className="input-field text-sm sm:text-base" placeholder="Size in GB (e.g. 250)" value={editingForm.size} onChange={(e) => setEditingForm((prev) => ({ ...prev, size: e.target.value }))} />
              <SuggestInput suggestions={suggestions.location} className="input-field text-sm sm:text-base" placeholder="Location / Region" value={editingForm.location} onChange={(e) => setEditingForm((prev) => ({ ...prev, location: e.target.value }))} />
              <select className="input-field text-sm sm:text-base" value={editingForm.status} onChange={(e) => setEditingForm((prev) => ({ ...prev, status: e.target.value }))}>
                {['Active', 'Paused', 'Terminated', 'Pending'].map((s) => (
                  <option value={s} key={s}>{s}</option>
                ))}
              </select>
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9]+(\.[0-9]+)?"
                className="input-field text-sm sm:text-base"
                placeholder="Cost"
                required
                value={editingForm.monthlyCost}
                onChange={(e) => setEditingForm((prev) => ({ ...prev, monthlyCost: sanitizeCost(e.target.value) }))}
              />
              <select className="input-field text-sm sm:text-base" value={editingForm.currency} onChange={(e) => setEditingForm((prev) => ({ ...prev, currency: e.target.value }))}>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="AED">AED</option>
              </select>
              <select className="input-field text-sm sm:text-base" value={editingForm.billingCycle} onChange={(e) => setEditingForm((prev) => ({
                ...prev,
                billingCycle: e.target.value,
                recurrenceEndDate: e.target.value === 'One-time' ? '' : (prev.recurrenceEndDate || defaultRecurrenceEndDate()),
              }))}>
                {['Monthly', 'Quarterly', 'Annual', 'One-time'].map((c) => (
                  <option value={c} key={c}>{c}</option>
                ))}
              </select>
              <label className="flex flex-col gap-1 text-xs text-slate-400">
                {editingForm.billingCycle === 'One-time' ? 'Payment date' : 'First payment date'}
                <input type="date" className="input-field text-sm sm:text-base" value={editingForm.nextPaymentDate} onChange={(e) => setEditingForm((prev) => ({ ...prev, nextPaymentDate: e.target.value }))} />
              </label>
              {editingForm.billingCycle !== 'One-time' ? (
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  Recurrence ends (optional — defaults to end of year)
                  <input type="date" className="input-field text-sm sm:text-base" value={editingForm.recurrenceEndDate} onChange={(e) => setEditingForm((prev) => ({ ...prev, recurrenceEndDate: e.target.value }))} />
                </label>
              ) : null}
              <textarea className="input-field text-sm sm:text-base min-h-[100px] sm:min-h-[120px] md:col-span-2" placeholder="Notes" value={editingForm.notes} onChange={(e) => setEditingForm((prev) => ({ ...prev, notes: e.target.value }))} />
              <div className="md:col-span-2 flex flex-wrap gap-2 sm:gap-3 justify-end">
                <button type="button" onClick={() => { setEditing(null); setEditingForm(null); }} className="btn-secondary text-sm sm:text-base px-3 sm:px-4 py-2">Cancel</button>
                <button type="submit" className="btn-primary text-sm sm:text-base px-3 sm:px-4 py-2">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {bulkPayContext && (() => {
        const { item, untilDate } = bulkPayContext;
        const recurrenceEndYear = item.recurrenceEndDate
          ? new Date(item.recurrenceEndDate).getFullYear()
          : new Date().getFullYear();
        const allDues = expandDueDates(item, Math.max(recurrenceEndYear, new Date().getFullYear()));
        const unpaidDues = allDues.filter((d) => !findPaymentForMonth(item, d));
        const cap = untilDate ? new Date(untilDate) : null;
        const previewMonths = cap ? unpaidDues.filter((d) => d <= cap) : [];
        const total = previewMonths.length * (Number(item.monthlyCost) || 0);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-4">
            <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950 shadow-2xl">
              <div className="px-5 py-4 border-b border-slate-800">
                <h3 className="text-base sm:text-lg font-semibold text-white">Pay through a date</h3>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Mark all unpaid {item.billingCycle.toLowerCase()} dues for <span className="font-semibold text-white">{item.name}</span> as paid, up to and including the chosen due date.
                </p>
              </div>
              <div className="px-5 py-4 space-y-3">
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  Pay through which due date?
                  <select
                    className="input-field text-sm"
                    value={untilDate}
                    onChange={(e) => setBulkPayContext((prev) => ({ ...prev, untilDate: e.target.value }))}
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
                      Total: {formatCurrency(total, item.currency || 'USD')}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Pick a due date to see what will be paid.</p>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-slate-800 bg-slate-900/60 px-5 py-3">
                <button
                  type="button"
                  onClick={() => setBulkPayContext(null)}
                  disabled={isBulkPaying}
                  className="btn-secondary text-xs sm:text-sm px-3 py-2 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmBulkPay}
                  disabled={isBulkPaying || !untilDate || previewMonths.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-lime-500/20 border border-lime-500/40 text-lime-200 hover:bg-lime-500/30 text-xs sm:text-sm font-semibold px-3 py-2 transition disabled:opacity-50"
                >
                  <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {isBulkPaying ? 'Saving…' : 'Mark all paid'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-red-500/30 bg-slate-950 shadow-2xl">
            <div className="px-5 py-5 sm:px-6 sm:py-6">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="p-2 sm:p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-red-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base sm:text-lg font-semibold text-white">Delete object storage</h3>
                  <p className="text-xs sm:text-sm text-slate-300 mt-1">
                    Are you sure you want to delete <span className="font-semibold text-white">{deleting.name}</span>?
                    This removes the bucket details and all its payment history.
                  </p>
                  <p className="text-[11px] sm:text-xs text-red-300 mt-2">
                    This action cannot be undone.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 sm:gap-3 border-t border-slate-800 bg-slate-900/60 px-5 py-3 sm:px-6 sm:py-4">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                disabled={isDeleting}
                className="btn-secondary text-xs sm:text-sm px-3 sm:px-4 py-2 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-200 hover:bg-red-500/30 text-xs sm:text-sm font-semibold px-3 sm:px-4 py-2 transition disabled:opacity-50"
              >
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

export default ObjectStoragePage;
