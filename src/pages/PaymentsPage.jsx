import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Server, CreditCard, HardDrive } from 'lucide-react';
import vpsService from '../services/vpsService';
import subscriptionService from '../services/subscriptionService';
import objectStorageService from '../services/objectStorageService';
import PaymentCalendar, { expandDueDates, findPaymentForMonth } from '../components/PaymentCalendar';
import useTabRefresh from '../hooks/useTabRefresh';

const formatCurrency = (value, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(value) || 0);

const KIND_META = {
  subscription: { label: 'Sub', Icon: CreditCard, classes: 'bg-violet-500/15 text-violet-200' },
  storage: { label: 'Storage', Icon: HardDrive, classes: 'bg-amber-500/15 text-amber-200' },
  vps: { label: 'VPS', Icon: Server, classes: 'bg-cyan-500/15 text-cyan-200' },
};

const KindBadge = ({ kind }) => {
  const meta = KIND_META[kind] || KIND_META.vps;
  const { label, Icon, classes } = meta;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wide flex-shrink-0 ${classes}`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
};

const BreakdownColumn = ({ label, accent, events, emptyMessage, onMarkPaid, onUnmarkPaid, onPayThrough }) => {
  const tone =
    accent === 'rose'
      ? { dot: 'bg-rose-400', text: 'text-rose-300', row: 'border-rose-500/20 bg-rose-500/5' }
      : { dot: 'bg-emerald-400', text: 'text-emerald-300', row: 'border-emerald-500/20 bg-emerald-500/5' };
  return (
    <div className="rounded-lg sm:rounded-xl border border-slate-700/40 bg-slate-950/60 p-2 sm:p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
        <p className={`text-[10px] sm:text-xs font-semibold uppercase tracking-wide ${tone.text}`}>
          {label} · {events.length}
        </p>
      </div>
      {events.length === 0 ? (
        <p className="text-[11px] sm:text-xs text-slate-500">{emptyMessage}</p>
      ) : (
        <ul className="space-y-1.5 max-h-64 sm:max-h-72 overflow-y-auto pr-1">
          {events.map((ev) => {
            const { item, dueDate, payment, amount } = ev;
            return (
              <li
                key={`${item.kind}-${item.id}-${dueDate.toISOString()}`}
                className={`rounded-md sm:rounded-lg border ${tone.row} p-2`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <KindBadge kind={item.kind} />
                      <p className="text-[11px] sm:text-xs font-semibold text-white truncate">{item.name}</p>
                    </div>
                    <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">
                      {item.provider || 'No provider'} · {item.billingCycle || 'Monthly'}
                    </p>
                    {item.providerAccount ? (
                      <p className="text-[10px] text-slate-500 mt-0.5 truncate">{item.providerAccount}</p>
                    ) : null}
                    {payment?.note ? (
                      <p className="text-[10px] text-emerald-300/80 mt-0.5 truncate">{payment.note}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <p className={`text-[10px] sm:text-[11px] font-semibold ${tone.text}`}>
                      {dueDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                    </p>
                    <p className="text-[11px] sm:text-xs font-bold text-white">
                      {formatCurrency(amount, item.currency || 'USD')}
                    </p>
                  </div>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {onMarkPaid ? (
                    <button
                      type="button"
                      onClick={() => onMarkPaid(item, dueDate)}
                      className="rounded-md bg-lime-500/20 text-lime-300 hover:bg-lime-500/30 text-[10px] sm:text-[11px] font-medium px-2 py-0.5 transition"
                    >
                      Mark paid
                    </button>
                  ) : null}
                  {onPayThrough && ['Monthly', 'Quarterly', 'Annual'].includes(item.billingCycle) ? (
                    <button
                      type="button"
                      onClick={() => onPayThrough(item, dueDate)}
                      className="rounded-md bg-slate-800/70 text-slate-300 hover:bg-slate-700/70 text-[10px] sm:text-[11px] font-medium px-2 py-0.5 transition"
                      title="Pay all unpaid months up through this date"
                    >
                      Pay through
                    </button>
                  ) : null}
                  {onUnmarkPaid ? (
                    <button
                      type="button"
                      onClick={() => onUnmarkPaid(item, dueDate)}
                      className="rounded-md bg-slate-800/70 text-slate-300 hover:bg-rose-500/15 hover:text-rose-300 text-[10px] sm:text-[11px] font-medium px-2 py-0.5 transition"
                      title="Revert this payment back to unpaid"
                    >
                      Unmark
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

const PaymentsPage = () => {
  const [vpsList, setVpsList] = useState([]);
  const [subscriptionsList, setSubscriptionsList] = useState([]);
  const [storageList, setStorageList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bulkPayContext, setBulkPayContext] = useState(null);
  const [isBulkPaying, setIsBulkPaying] = useState(false);
  const [viewedMonth, setViewedMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [calendarSelection, setCalendarSelection] = useState(null);

  const loadAll = async ({ force = false, silent = false } = {}) => {
    if (!silent) setLoading(true);
    const [vpsRes, subRes, storageRes] = await Promise.all([
      vpsService.getAllVps({ force }),
      subscriptionService.getAllSubscriptions({ force }),
      objectStorageService.getAll({ force }),
    ]);
    if (vpsRes.success) setVpsList(vpsRes.vps);
    else setError(vpsRes.error || 'Failed to load VPS items');
    if (subRes.success) setSubscriptionsList(subRes.subscriptions || []);
    if (storageRes.success) setStorageList(storageRes.items || []);
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  useTabRefresh(() => loadAll({ force: true, silent: true }));

  const serviceForItem = (item) => {
    if (item?.kind === 'subscription') return subscriptionService;
    if (item?.kind === 'storage') return objectStorageService;
    return vpsService;
  };

  const setListForKind = (kind, updater) => {
    if (kind === 'subscription') setSubscriptionsList(updater);
    else if (kind === 'storage') setStorageList(updater);
    else setVpsList(updater);
  };

  // Replace one item by id in whichever list owns it. updateFn receives the
  // current item and returns the next version (or `null` to keep unchanged).
  const updateItemInList = (kind, id, updateFn) => {
    setListForKind(kind, (list) => list.map((it) => (it.id === id ? updateFn(it) : it)));
  };

  // Server returns the updated row under a kind-specific key.
  const extractServerItem = (kind, result) => {
    if (kind === 'subscription') return result?.subscription || null;
    if (kind === 'storage') return result?.item || null;
    return result?.vps || null;
  };

  const combinedItems = useMemo(
    () => [
      ...vpsList.map((v) => ({ ...v, kind: 'vps' })),
      ...subscriptionsList.map((s) => ({ ...s, kind: 'subscription' })),
      ...storageList.map((o) => ({ ...o, kind: 'storage' })),
    ],
    [vpsList, subscriptionsList, storageList]
  );

  const viewedMonthTotals = useMemo(() => {
    const { year, month } = viewedMonth;
    // key = `${kind}::${currency}` so we can split totals by VPS vs subscription.
    const paid = new Map();
    const due = new Map();
    const unpaidEvents = [];
    const paidEvents = [];
    const currencies = new Set();
    for (const item of combinedItems) {
      const dueDates = expandDueDates(item, year);
      const dueThisMonth = dueDates.find((d) => d.getFullYear() === year && d.getMonth() === month);
      if (!dueThisMonth) continue;
      const cur = item.currency || 'USD';
      currencies.add(cur);
      const key = `${item.kind}::${cur}`;
      const amount = Number(item.monthlyCost) || 0;
      const payment = findPaymentForMonth(item, dueThisMonth);
      if (payment) {
        const paidAmount = Number(payment.amount ?? amount) || 0;
        paid.set(key, (paid.get(key) || 0) + paidAmount);
        paidEvents.push({ item, dueDate: dueThisMonth, payment, amount: paidAmount });
      } else {
        due.set(key, (due.get(key) || 0) + amount);
        unpaidEvents.push({ item, dueDate: dueThisMonth, payment: null, amount });
      }
    }
    unpaidEvents.sort((a, b) => a.dueDate - b.dueDate);
    paidEvents.sort((a, b) => a.dueDate - b.dueDate);
    // Ensure every (kind, currency) row always appears — zero-fill the gaps so
    // the user sees all four lines (Due/Paid × VPS/Subs) regardless of data.
    if (currencies.size === 0) currencies.add('USD');
    const zeroFill = (map) => {
      const rows = [];
      for (const kind of ['vps', 'subscription', 'storage']) {
        for (const currency of currencies) {
          const key = `${kind}::${currency}`;
          rows.push({ kind, currency, amount: map.get(key) || 0 });
        }
      }
      return rows;
    };
    return {
      count: unpaidEvents.length + paidEvents.length,
      paid: zeroFill(paid),
      due: zeroFill(due),
      unpaidEvents,
      paidEvents,
    };
  }, [combinedItems, viewedMonth]);

  const totalsForDate = (items, target) => {
    const y = target.getFullYear();
    const m = target.getMonth();
    const d = target.getDate();
    const paid = new Map();
    const due = new Map();
    let dueCount = 0;
    let paidCount = 0;
    for (const item of items) {
      const dueDates = expandDueDates(item, y);
      const hit = dueDates.find((dd) => dd.getFullYear() === y && dd.getMonth() === m && dd.getDate() === d);
      if (!hit) continue;
      const cur = item.currency || 'USD';
      const key = `${item.kind}::${cur}`;
      const baseAmount = Number(item.monthlyCost) || 0;
      const payment = findPaymentForMonth(item, hit);
      if (payment) {
        const paidAmount = Number(payment.amount ?? baseAmount) || 0;
        paid.set(key, (paid.get(key) || 0) + paidAmount);
        paidCount += 1;
      } else {
        due.set(key, (due.get(key) || 0) + baseAmount);
        dueCount += 1;
      }
    }
    const rowsFrom = (map) => Array.from(map.entries())
      .map(([key, amount]) => {
        const [kind, currency] = key.split('::');
        return { kind, currency, amount };
      })
      .sort((a, b) => b.amount - a.amount);
    return {
      count: dueCount + paidCount,
      dueCount,
      paidCount,
      paid: rowsFrom(paid),
      due: rowsFrom(due),
    };
  };

  const todayTotals = useMemo(() => totalsForDate(combinedItems, new Date()), [combinedItems]);

  const selectedDateTotals = useMemo(() => {
    if (!calendarSelection) return null;
    const { year, month, day } = calendarSelection;
    return totalsForDate(combinedItems, new Date(year, month, day));
  }, [combinedItems, calendarSelection]);

  const selectedDateObj = useMemo(() => {
    if (!calendarSelection) return null;
    const { year, month, day } = calendarSelection;
    return new Date(year, month, day);
  }, [calendarSelection]);

  const isSelectionToday = useMemo(() => {
    if (!selectedDateObj) return false;
    const t = new Date();
    return selectedDateObj.getFullYear() === t.getFullYear()
      && selectedDateObj.getMonth() === t.getMonth()
      && selectedDateObj.getDate() === t.getDate();
  }, [selectedDateObj]);

  const todayLabel = useMemo(
    () => new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    []
  );

  const viewedMonthLabel = useMemo(
    () => new Date(viewedMonth.year, viewedMonth.month, 1).toLocaleString('default', { month: 'long', year: 'numeric' }),
    [viewedMonth]
  );

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
    const kind = item.kind;
    const id = item.id;
    const snapshot = item;
    updateItemInList(kind, id, (it) => ({
      ...it,
      payments: [...(it.payments || []), optimisticPayment],
    }));
    serviceForItem(item)
      .markAsPaid(id, {
        amount: optimisticPayment.amount,
        currency: optimisticPayment.currency,
        paidAt,
        note: optimisticPayment.note,
      })
      .then((result) => {
        if (!result?.success) {
          updateItemInList(kind, id, () => snapshot);
          setError(result?.error || 'Failed to mark payment as paid');
          return;
        }
        const serverItem = extractServerItem(kind, result);
        if (serverItem) updateItemInList(kind, id, () => serverItem);
      })
      .catch((err) => {
        updateItemInList(kind, id, () => snapshot);
        setError(err?.message || 'Failed to mark payment as paid');
      });
  };

  const handleUnmarkPaid = (item, dueDate) => {
    if (!item?.id || !dueDate) return;
    const kind = item.kind;
    const id = item.id;
    const snapshot = item;
    const target = new Date(dueDate);
    const targetYear = target.getFullYear();
    const targetMonth = target.getMonth();
    updateItemInList(kind, id, (it) => ({
      ...it,
      payments: (it.payments || []).filter((p) => {
        if (!p?.paidAt) return true;
        const d = new Date(p.paidAt);
        return !(d.getFullYear() === targetYear && d.getMonth() === targetMonth);
      }),
    }));
    serviceForItem(item)
      .unmarkPaid(id, { dueDate: target.toISOString() })
      .then((result) => {
        if (!result?.success) {
          updateItemInList(kind, id, () => snapshot);
          setError(result?.error || 'Failed to unmark payment');
          return;
        }
        const serverItem = extractServerItem(kind, result);
        if (serverItem) updateItemInList(kind, id, () => serverItem);
      })
      .catch((err) => {
        updateItemInList(kind, id, () => snapshot);
        setError(err?.message || 'Failed to unmark payment');
      });
  };

  const handleMarkAllPaidForMonth = (events) => {
    if (!Array.isArray(events) || events.length === 0) return;
    // Calendar passes events as { vps, dueDate } regardless of actual kind.
    for (const event of events) {
      const { vps: item, dueDate } = event;
      if (!item?.id || !dueDate) continue;
      handleMarkPaid(item, dueDate);
    }
  };

  const confirmBulkPay = () => {
    if (!bulkPayContext?.vps?.id || !bulkPayContext?.untilDate) return;
    const item = bulkPayContext.vps;
    const kind = item.kind;
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
    updateItemInList(kind, id, (it) => ({
      ...it,
      payments: [...(it.payments || []), ...optimisticPayments],
    }));
    setBulkPayContext(null);
    setIsBulkPaying(true);
    serviceForItem(item)
      .markPaidThrough(id, {
        untilDate: bulkPayContext.untilDate,
        currency: item.currency || 'USD',
      })
      .then((result) => {
        setIsBulkPaying(false);
        if (!result?.success) {
          updateItemInList(kind, id, () => snapshot);
          setError(result?.error || 'Failed to mark payments');
          return;
        }
        const serverItem = extractServerItem(kind, result);
        if (serverItem) updateItemInList(kind, id, () => serverItem);
      })
      .catch((err) => {
        setIsBulkPaying(false);
        updateItemInList(kind, id, () => snapshot);
        setError(err?.message || 'Failed to mark payments');
      });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
          Payment Calendar
        </h1>
        <p className="text-sm sm:text-base text-slate-400">
          All VPS and subscription dues in one place. Click any day to see what's due, mark payments as paid, or bulk-pay ahead.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
        <div className="glass-morphism rounded-lg sm:rounded-xl p-2 sm:p-3 md:p-4 border border-cyan-500/20 min-w-0">
          <p className="text-slate-400 text-[10px] sm:text-xs md:text-sm truncate">Tracked Items</p>
          <p className="text-base sm:text-xl md:text-2xl font-bold text-white mt-0.5 sm:mt-1">{combinedItems.length}</p>
          <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 truncate">
            {vpsList.length} VPS · {subscriptionsList.length} subs · {storageList.length} storage
          </p>
        </div>
        {(() => {
          const showingSelection = Boolean(selectedDateTotals) && !isSelectionToday;
          const totals = showingSelection ? selectedDateTotals : todayTotals;
          const label = showingSelection
            ? selectedDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : todayLabel;
          const heading = showingSelection ? 'Selected' : 'Today';
          const emptyText = showingSelection
            ? 'Nothing scheduled this day.'
            : 'Nothing scheduled today.';
          return (
            <div className="glass-morphism rounded-lg sm:rounded-xl p-2 sm:p-3 md:p-4 border border-cyan-400/30 min-w-0">
              <p className="text-slate-400 text-[10px] sm:text-xs md:text-sm truncate">{heading} · {label}</p>
              <p className="text-base sm:text-xl md:text-2xl font-bold text-cyan-300 mt-0.5 sm:mt-1">
                {totals.count}
                <span className="ml-1 text-[10px] sm:text-xs font-medium text-slate-400">
                  {totals.count === 1 ? 'item' : 'items'}
                </span>
              </p>
              {totals.count === 0 ? (
                <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 truncate">{emptyText}</p>
              ) : (
                <div className="mt-1 sm:mt-1.5 space-y-0.5 text-[10px] sm:text-xs md:text-sm">
                  {totals.due.map(({ kind, currency, amount }) => (
                    <p key={`sel-due-${kind}-${currency}`} className="truncate text-rose-300">
                      Due {(KIND_META[kind]?.label || 'VPS')} {formatCurrency(amount, currency)}
                    </p>
                  ))}
                  {totals.paid.map(({ kind, currency, amount }) => (
                    <p key={`sel-paid-${kind}-${currency}`} className="truncate text-emerald-300">
                      Paid {(KIND_META[kind]?.label || 'VPS')} {formatCurrency(amount, currency)}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
        <div className="glass-morphism rounded-lg sm:rounded-xl p-2 sm:p-3 md:p-4 border border-rose-500/20 min-w-0">
          <p className="text-slate-400 text-[10px] sm:text-xs md:text-sm truncate">Due in {viewedMonthLabel}</p>
          <div className="mt-0.5 sm:mt-1 space-y-0.5">
            {viewedMonthTotals.due.map(({ kind, currency, amount }) => (
              <p
                key={`${kind}-${currency}`}
                className={`text-xs sm:text-sm md:text-base font-bold truncate leading-tight ${amount > 0 ? 'text-rose-300' : 'text-rose-300/40'}`}
              >
                <span className="text-[9px] sm:text-[10px] md:text-xs font-semibold uppercase tracking-wide text-rose-200/80 mr-1">
                  {(KIND_META[kind]?.label || 'VPS')}
                </span>
                {formatCurrency(amount, currency)}
              </p>
            ))}
          </div>
        </div>
        <div className="glass-morphism rounded-lg sm:rounded-xl p-2 sm:p-3 md:p-4 border border-blue-500/20 min-w-0 col-span-2 lg:col-span-1">
          <p className="text-slate-400 text-[10px] sm:text-xs md:text-sm truncate">Payments in {viewedMonthLabel}</p>
          <p className="text-base sm:text-xl md:text-2xl font-bold text-blue-400 mt-0.5 sm:mt-1">{viewedMonthTotals.count}</p>
          <div className="mt-1 sm:mt-1.5 grid grid-cols-2 gap-x-2 sm:gap-x-3 text-[10px] sm:text-xs md:text-sm">
            <div className="min-w-0 space-y-0.5">
              {viewedMonthTotals.paid.map(({ kind, currency, amount }) => (
                <p key={`paid-${kind}-${currency}`} className={`truncate ${amount > 0 ? 'text-emerald-300' : 'text-emerald-300/40'}`}>
                  Paid {(KIND_META[kind]?.label || 'VPS')} {formatCurrency(amount, currency)}
                </p>
              ))}
            </div>
            <div className="min-w-0 space-y-0.5 text-right">
              {viewedMonthTotals.due.map(({ kind, currency, amount }) => (
                <p key={`due-${kind}-${currency}`} className={`truncate ${amount > 0 ? 'text-rose-300' : 'text-rose-300/40'}`}>
                  Due {(KIND_META[kind]?.label || 'VPS')} {formatCurrency(amount, currency)}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="glass-morphism rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">{error}</div>
      )}

      {loading ? (
        <div className="glass-morphism rounded-xl p-6 text-center text-slate-300">Loading payments…</div>
      ) : combinedItems.length === 0 ? (
        <div className="glass-morphism rounded-2xl border border-slate-700/50 bg-slate-950/80 p-8 text-center text-slate-400">
          <h2 className="text-lg font-semibold text-white">Nothing to track yet</h2>
          <p className="text-sm text-slate-400 mt-2">
            Add a VPS or subscription with a payment date and it will appear here.
          </p>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto w-full">
          <PaymentCalendar
            vpsItems={combinedItems}
            onMarkPaid={handleMarkPaid}
            onUnmarkPaid={handleUnmarkPaid}
            onMarkAllPaidForMonth={handleMarkAllPaidForMonth}
            onPayThrough={(item, dueDate) =>
              setBulkPayContext({ vps: item, untilDate: new Date(dueDate).toISOString().slice(0, 10) })
            }
            onMonthChange={setViewedMonth}
            onSelectionChange={setCalendarSelection}
            titleAccent="blue"
          />
        </div>
      )}

      {bulkPayContext && (() => {
        const { vps, untilDate } = bulkPayContext;
        const recurrenceEndYear = vps.recurrenceEndDate
          ? new Date(vps.recurrenceEndDate).getFullYear()
          : new Date().getFullYear();
        const allDues = expandDueDates(vps, Math.max(recurrenceEndYear, new Date().getFullYear()));
        const unpaidDues = allDues.filter((d) => !findPaymentForMonth(vps, d));
        const cap = untilDate ? new Date(untilDate) : null;
        const previewMonths = cap ? unpaidDues.filter((d) => d <= cap) : [];
        const total = previewMonths.length * (Number(vps.monthlyCost) || 0);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-4">
            <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950 shadow-2xl">
              <div className="px-5 py-4 border-b border-slate-800">
                <h3 className="text-base sm:text-lg font-semibold text-white">Pay through a date</h3>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Mark all unpaid {vps.billingCycle?.toLowerCase()} dues for{' '}
                  <span className="font-semibold text-white">{vps.name}</span> as paid, up to and including the chosen due date.
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
                      Total: {formatCurrency(total, vps.currency || 'USD')}
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
    </div>
  );
};

export default PaymentsPage;
