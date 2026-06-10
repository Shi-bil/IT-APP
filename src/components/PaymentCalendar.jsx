import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

const ROUTE_BY_KIND = {
  vps: '/vps',
  subscription: '/subscriptions',
  storage: '/object-storage',
};

const toIsoDay = (d) => {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const linkForItem = (item, dueDate) => {
  const base = ROUTE_BY_KIND[item?.kind] || '/vps';
  const params = new URLSearchParams();
  if (item?.id) params.set('focus', item.id);
  else if (item?.name) params.set('search', item.name);
  if (dueDate) params.set('dueDate', toIsoDay(dueDate));
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
};

const formatCurrency = (value, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(value) || 0);

const CYCLE_STEP_MONTHS = {
  Monthly: 1,
  Quarterly: 3,
  Annual: 12,
};

// Generate every recurring due date between nextPaymentDate and either
// recurrenceEndDate or end-of-current-year (user's stated default).
export const expandDueDates = (vps, calendarYear) => {
  if (!vps?.nextPaymentDate) return [];
  const step = CYCLE_STEP_MONTHS[vps.billingCycle];
  if (!step) return [new Date(vps.nextPaymentDate)]; // one-time
  const anchor = new Date(vps.nextPaymentDate);
  const anchorDay = anchor.getDate();
  const end = vps.recurrenceEndDate
    ? new Date(vps.recurrenceEndDate)
    : new Date(calendarYear, 11, 31);
  const dates = [];
  let year = anchor.getFullYear();
  let month = anchor.getMonth();
  // Cap iterations as a safety net against pathological inputs.
  for (let i = 0; i < 240; i += 1) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const day = Math.min(anchorDay, daysInMonth);
    const candidate = new Date(year, month, day);
    if (candidate > end) break;
    dates.push(candidate);
    month += step;
    while (month > 11) { month -= 12; year += 1; }
  }
  return dates;
};

// A due date counts as paid when the vps has any payment whose paidAt
// falls in the same year+month as the due date.
export const findPaymentForMonth = (vps, dueDate) => {
  if (!Array.isArray(vps?.payments)) return null;
  return vps.payments.find((p) => {
    if (!p?.paidAt) return false;
    const d = new Date(p.paidAt);
    return d.getFullYear() === dueDate.getFullYear() && d.getMonth() === dueDate.getMonth();
  }) || null;
};

const calendarDayClass = ({ hasDue, hasPaid, isToday, isSelected }) => {
  if (isSelected) return 'bg-slate-700 border border-slate-500 text-white';
  if (isToday) return 'bg-cyan-500/15 border border-cyan-400/40 text-cyan-100';
  if (hasDue && hasPaid) return 'bg-amber-500/15 border border-amber-500/30 text-amber-100';
  if (hasDue) return 'bg-rose-500/15 border border-rose-500/30 text-rose-100';
  if (hasPaid) return 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-100';
  return 'bg-slate-900/40 border border-slate-700/50 text-slate-300';
};

const PaymentCalendar = ({ vpsItems, onMarkPaid, onUnmarkPaid, onMarkAllPaidForMonth, onPayThrough, onMonthChange, onSelectionChange, titleAccent }) => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  const yearDropdownRef = useRef(null);

  useEffect(() => {
    if (!yearDropdownOpen) return undefined;
    const handleClickOutside = (e) => {
      if (yearDropdownRef.current && !yearDropdownRef.current.contains(e.target)) {
        setYearDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    // Scroll the active year into view so the user sees their current selection
    // centered inside the visible 5-row window.
    const activeOption = yearDropdownRef.current?.querySelector('[aria-selected="true"]');
    if (activeOption) activeOption.scrollIntoView({ block: 'center' });
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [yearDropdownOpen]);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthLabel = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  useEffect(() => {
    if (onMonthChange) onMonthChange({ year, month });
  }, [year, month, onMonthChange]);

  useEffect(() => {
    if (!onSelectionChange) return;
    onSelectionChange(selectedDate ? { year, month, day: selectedDate } : null);
  }, [selectedDate, year, month, onSelectionChange]);

  // Build a map: dayNumber -> { items: [{vps, dueDate, paid, payment}], dueCount, paidCount, total }
  const eventsByDate = useMemo(() => {
    const map = new Map();
    vpsItems.forEach((vps) => {
      const dueDates = expandDueDates(vps, year);
      dueDates.forEach((dueDate) => {
        if (dueDate.getFullYear() !== year || dueDate.getMonth() !== month) return;
        const payment = findPaymentForMonth(vps, dueDate);
        const key = dueDate.getDate();
        const existing = map.get(key) || { items: [], dueCount: 0, paidCount: 0, total: 0 };
        existing.items.push({ vps, dueDate, paid: Boolean(payment), payment });
        if (payment) existing.paidCount += 1; else existing.dueCount += 1;
        existing.total += Number(vps.monthlyCost || 0);
        map.set(key, existing);
      });
    });
    return map;
  }, [vpsItems, month, year]);

  const monthEvents = useMemo(() => {
    const all = [];
    eventsByDate.forEach((entry) => { all.push(...entry.items); });
    return all.sort((a, b) => a.dueDate - b.dueDate);
  }, [eventsByDate]);

  const summary = useMemo(() => {
    let dueTotal = 0;
    let paidTotal = 0;
    monthEvents.forEach((e) => {
      const amount = Number(e.vps.monthlyCost || 0);
      if (e.paid) paidTotal += Number(e.payment?.amount ?? amount);
      else dueTotal += amount;
    });
    return { dueTotal, paidTotal };
  }, [monthEvents]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return (
    <div className="glass-morphism rounded-xl sm:rounded-2xl border border-slate-700/40 p-2 sm:p-3 md:p-4 w-full">
      <div className="flex items-start justify-between gap-1.5 sm:gap-2 mb-2 sm:mb-3 md:mb-4">
        <div className="min-w-0">
          <p className={`text-[9px] sm:text-[10px] md:text-xs uppercase tracking-[0.12em] ${titleAccent === 'blue' ? 'text-cyan-300/80' : 'text-slate-500'}`}>Payment Calendar</p>
          <h2
            className={`text-sm sm:text-base md:text-lg lg:text-xl font-semibold mt-0.5 truncate ${
              titleAccent === 'blue'
                ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600'
                : 'text-white'
            }`}
          >
            {monthLabel}
          </h2>
          <p className="text-[9px] sm:text-[10px] md:text-xs text-slate-400 mt-0.5">
            Due <span className="text-rose-300 font-semibold">{formatCurrency(summary.dueTotal)}</span>
            {' · '}
            Paid <span className="text-emerald-300 font-semibold">{formatCurrency(summary.paidTotal)}</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
            className="rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-lg sm:text-xl font-semibold text-slate-200 transition"
            aria-label="Previous month"
          >
            ‹
          </button>
          {(() => {
            const now = new Date();
            const isOnCurrentMonth = year === now.getFullYear() && month === now.getMonth();
            return (
              <button
                type="button"
                onClick={() => {
                  const today = new Date();
                  setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
                  setSelectedDate(today.getDate());
                }}
                disabled={isOnCurrentMonth}
                className={`rounded-lg h-9 sm:h-10 px-2.5 sm:px-3 text-xs sm:text-sm font-semibold transition ${isOnCurrentMonth ? 'bg-emerald-500/10 text-emerald-400/60 cursor-default' : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 active:bg-emerald-500/40'}`}
                title="Jump to today"
              >
                Today
              </button>
            );
          })()}
          <button
            type="button"
            onClick={() => setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
            className="rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-lg sm:text-xl font-semibold text-slate-200 transition"
            aria-label="Next month"
          >
            ›
          </button>
          <div className="relative" ref={yearDropdownRef}>
            <button
              type="button"
              onClick={() => setYearDropdownOpen((open) => !open)}
              className="rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-sm sm:text-base font-medium text-white px-2.5 sm:px-3 h-9 sm:h-10 cursor-pointer transition inline-flex items-center gap-1"
              aria-haspopup="listbox"
              aria-expanded={yearDropdownOpen}
            >
              {year}
              <span className="text-xs text-slate-400">▾</span>
            </button>
            {yearDropdownOpen ? (
              <ul
                role="listbox"
                className="absolute right-0 top-full mt-1 z-40 w-24 rounded-lg border border-slate-700 bg-slate-900 shadow-2xl overflow-y-auto"
                // 5 visible rows: each item is ~36px tall (py-1.5 + text-sm)
                style={{ maxHeight: '180px' }}
              >
                {Array.from({ length: 15 }, (_, index) => {
                  const optionYear = new Date().getFullYear() - 5 + index;
                  const isActive = optionYear === year;
                  return (
                    <li key={optionYear}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onClick={() => {
                          setViewDate((prev) => new Date(optionYear, prev.getMonth(), 1));
                          setYearDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-sm transition ${
                          isActive ? 'bg-cyan-500/20 text-cyan-200 font-semibold' : 'text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        {optionYear}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-2 sm:space-y-3 md:space-y-4">
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1 md:gap-1.5">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
            <div key={i} className="text-[9px] sm:text-[10px] md:text-xs font-semibold uppercase text-slate-500 text-center py-0.5 sm:py-1">
              {day}
            </div>
          ))}
          {Array.from({ length: new Date(year, month, 1).getDay() }, (_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, index) => {
            const dayNumber = index + 1;
            const event = eventsByDate.get(dayNumber);
            const today = new Date();
            const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === dayNumber;
            const isSelected = selectedDate === dayNumber;
            const hasDue = event?.dueCount > 0;
            const hasPaid = event?.paidCount > 0;
            const showPopover = Boolean(event);
            // Columns 0-3 anchor popover to left edge of cell; cols 4-6 anchor
            // to right edge so it doesn't clip past the calendar's right side.
            const col = (new Date(year, month, 1).getDay() + index) % 7;
            const anchorRight = col >= 4;
            return (
              <div key={dayNumber} className="relative group">
                <button
                  type="button"
                  onClick={() => setSelectedDate(dayNumber === selectedDate ? null : dayNumber)}
                  className={`w-full relative flex flex-col items-center justify-center rounded-md sm:rounded-lg transition h-9 sm:h-10 md:h-12 ${calendarDayClass({ hasDue, hasPaid, isToday, isSelected })}`}
                >
                  {isToday ? (
                    <span className="absolute top-0.5 text-[7px] sm:text-[8px] md:text-[9px] font-semibold uppercase tracking-wide text-cyan-300 leading-none">
                      Today
                    </span>
                  ) : null}
                  <div className={`text-[10px] sm:text-xs md:text-sm font-semibold leading-none ${isToday ? 'mt-2' : ''}`}>{dayNumber}</div>
                  {event ? (
                    <div className="mt-0.5 flex items-center gap-0.5">
                      {event.dueCount > 0 ? <span className="h-1 w-1 md:h-1.5 md:w-1.5 rounded-full bg-rose-400" /> : null}
                      {event.paidCount > 0 ? <span className="h-1 w-1 md:h-1.5 md:w-1.5 rounded-full bg-emerald-400" /> : null}
                    </div>
                  ) : null}
                </button>
                {showPopover ? (
                  <div
                    className={`absolute top-full mt-1 z-30 w-52 sm:w-60 rounded-xl border border-slate-700/70 bg-slate-950/95 backdrop-blur shadow-2xl p-2.5 transition-opacity duration-150 ${anchorRight ? 'right-0' : 'left-0'} opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto`}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                      {new Date(year, month, dayNumber).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    <ul className="space-y-1.5 max-h-44 overflow-y-auto">
                      {event.items.map((item, idx) => (
                        <li key={`${item.vps.id}-${idx}`} className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-white truncate">{item.vps.name}</p>
                            <p className="text-[10px] text-slate-400 truncate">{item.vps.provider || 'No provider'}</p>
                          </div>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${item.paid ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                            {item.paid ? 'Paid' : 'Due'}
                          </span>
                          <Link
                            to={linkForItem(item.vps, item.dueDate)}
                            className="flex-shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-md text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition"
                            title={`Open ${(item.vps.kind || 'vps')} page`}
                            aria-label="Open item details"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {selectedDate ? (
          <div className="rounded-2xl sm:rounded-3xl border border-cyan-500/20 bg-slate-950/80 p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-cyan-200">Payments on {selectedDate} {monthLabel}</p>
            {eventsByDate.get(selectedDate) ? (
              <div className="mt-2 sm:mt-3 space-y-2">
                {eventsByDate.get(selectedDate).items.map((event, index) => (
                  <div key={`${event.vps.id}-${index}`} className="rounded-xl sm:rounded-2xl border border-slate-700/50 bg-slate-900/80 p-2.5 sm:p-3">
                    <div className="flex items-start justify-between gap-2 sm:gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="text-sm sm:text-base font-medium text-slate-100 truncate">{event.vps.name}</p>
                          <Link
                            to={linkForItem(event.vps, event.dueDate)}
                            className="flex-shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-md text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition"
                            title={`Open ${(event.vps.kind || 'vps')} page`}
                            aria-label="Open item details"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                        <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 truncate">
                          {event.vps.provider || 'No provider'} · {event.vps.billingCycle}
                          {event.vps.providerAccount ? <span className="text-slate-300"> · {event.vps.providerAccount}</span> : null}
                        </p>
                        <p className={`text-xs sm:text-sm mt-1.5 ${event.paid ? 'text-emerald-300' : 'text-rose-300'}`}>
                          {formatCurrency(event.paid ? (event.payment?.amount ?? event.vps.monthlyCost) : event.vps.monthlyCost, event.vps.currency)}
                        </p>
                        {event.paid ? (
                          <p className="text-[10px] sm:text-[11px] text-emerald-300 mt-1">{event.payment?.note || 'Payment recorded'}</p>
                        ) : null}
                      </div>
                      {!event.paid ? (
                        <div className="flex flex-col gap-1.5 self-center flex-shrink-0">
                          {onMarkPaid ? (
                            <button
                              type="button"
                              onClick={() => onMarkPaid(event.vps, event.dueDate)}
                              className="rounded-lg bg-lime-500/20 text-lime-300 hover:bg-lime-500/30 text-xs sm:text-sm font-medium px-2.5 sm:px-3 py-1.5 transition"
                            >
                              Mark paid
                            </button>
                          ) : null}
                          {onPayThrough && ['Monthly', 'Quarterly', 'Annual'].includes(event.vps.billingCycle) ? (
                            <button
                              type="button"
                              onClick={() => onPayThrough(event.vps, event.dueDate)}
                              className="rounded-lg bg-slate-800/60 text-slate-300 hover:bg-slate-700/60 text-[11px] sm:text-xs font-medium px-2.5 sm:px-3 py-1.5 transition"
                              title="Pay all unpaid months up through this date"
                            >
                              Pay through
                            </button>
                          ) : null}
                        </div>
                      ) : onUnmarkPaid ? (
                        <button
                          type="button"
                          onClick={() => onUnmarkPaid(event.vps, event.dueDate)}
                          className="rounded-lg bg-slate-800/60 text-slate-300 hover:bg-rose-500/15 hover:text-rose-300 text-xs sm:text-sm font-medium px-2.5 sm:px-3 py-1.5 self-center flex-shrink-0 transition"
                          title="Revert this month back to unpaid"
                        >
                          Unmark
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs sm:text-sm text-slate-500 mt-2 sm:mt-3">No payments scheduled on this day.</p>
            )}
          </div>
        ) : null}

        <div className="space-y-2 sm:space-y-3">
          <div className="rounded-xl sm:rounded-2xl border border-slate-700/40 bg-slate-900/70 p-2 sm:p-3 md:p-4">
            <div className="flex items-center justify-between gap-2 mb-1.5 sm:mb-2 md:mb-3">
              <p className="text-[11px] sm:text-xs md:text-sm text-slate-400">This month</p>
              {(() => {
                const unpaid = monthEvents.filter((e) => !e.paid);
                if (unpaid.length < 2 || !onMarkAllPaidForMonth) return null;
                return (
                  <button
                    type="button"
                    onClick={() => onMarkAllPaidForMonth(unpaid)}
                    className="text-[10px] sm:text-xs font-medium bg-lime-500/15 text-lime-300 hover:bg-lime-500/25 transition rounded-lg px-2 py-1"
                    title={`Mark all ${unpaid.length} unpaid items in ${monthLabel} as paid`}
                  >
                    Mark all paid ({unpaid.length})
                  </button>
                );
              })()}
            </div>
            <div className="space-y-1.5 sm:space-y-2 max-h-[240px] sm:max-h-[300px] md:max-h-[360px] overflow-y-auto">
              {monthEvents.length ? (
                monthEvents.map((event) => (
                  <div key={`${event.vps.id}-${event.dueDate.toISOString()}`} className="rounded-lg sm:rounded-xl border border-slate-700/50 bg-slate-950/70 p-2 sm:p-2.5 md:p-3">
                    <div className="flex items-start justify-between gap-2 sm:gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="text-xs sm:text-sm text-slate-300 font-medium truncate">{event.vps.name}</p>
                          <Link
                            to={linkForItem(event.vps, event.dueDate)}
                            className="flex-shrink-0 inline-flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-md text-slate-500 hover:text-cyan-300 hover:bg-cyan-500/10 transition"
                            title={`Open ${(event.vps.kind || 'vps')} page`}
                            aria-label="Open item details"
                          >
                            <ArrowUpRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          </Link>
                        </div>
                        <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 truncate">
                          {event.vps.provider || 'No provider'} · {event.vps.billingCycle}
                          {event.vps.providerAccount ? <span className="text-slate-300"> · {event.vps.providerAccount}</span> : null}
                        </p>
                      </div>
                      <p className={`text-xs sm:text-sm font-semibold flex-shrink-0 ${event.paid ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {event.dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] sm:text-xs">
                      <span className={event.paid ? 'text-emerald-300' : 'text-rose-300'}>
                        {event.paid ? `Paid${event.payment?.note ? ` · ${event.payment.note}` : ''}` : 'Due'}
                      </span>
                      <span className="ml-2 flex-shrink-0 text-slate-400">
                        {formatCurrency(event.paid ? (event.payment?.amount ?? event.vps.monthlyCost) : event.vps.monthlyCost, event.vps.currency || 'USD')}
                      </span>
                    </div>
                    {!event.paid && onMarkPaid ? (
                      <button
                        type="button"
                        onClick={() => onMarkPaid(event.vps, event.dueDate)}
                        className="mt-2 w-full py-1.5 rounded-lg text-[11px] sm:text-xs font-medium bg-lime-500/15 text-lime-300 hover:bg-lime-500/25 transition"
                      >
                        Mark {event.dueDate.toLocaleDateString('en-US', { month: 'short' })} paid
                      </button>
                    ) : null}
                    {event.paid && onUnmarkPaid ? (
                      <button
                        type="button"
                        onClick={() => onUnmarkPaid(event.vps, event.dueDate)}
                        className="mt-2 w-full py-1.5 rounded-lg text-[11px] sm:text-xs font-medium bg-slate-800/60 text-slate-400 hover:bg-rose-500/15 hover:text-rose-300 transition"
                        title={`Revert ${event.dueDate.toLocaleDateString('en-US', { month: 'short' })} back to unpaid`}
                      >
                        Unmark {event.dueDate.toLocaleDateString('en-US', { month: 'short' })}
                      </button>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="text-xs sm:text-sm text-slate-500">No payments scheduled in {monthLabel}.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentCalendar;
