// Server-side mirror of the pure helpers in src/components/PaymentCalendar.jsx.
// Kept separate so backend code doesn't import a .jsx file.

const CYCLE_STEP_MONTHS = {
  Monthly: 1,
  Quarterly: 3,
  Annual: 12,
};

export function expandDueDates(item, calendarYear) {
  if (!item?.nextPaymentDate) return [];
  const step = CYCLE_STEP_MONTHS[item.billingCycle];
  if (!step) return [new Date(item.nextPaymentDate)];
  const anchor = new Date(item.nextPaymentDate);
  const anchorDay = anchor.getDate();
  const end = item.recurrenceEndDate
    ? new Date(item.recurrenceEndDate)
    : new Date(calendarYear, 11, 31);
  const dates = [];
  let year = anchor.getFullYear();
  let month = anchor.getMonth();
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
}

export function findPaymentForMonth(item, dueDate) {
  if (!Array.isArray(item?.payments)) return null;
  return item.payments.find((p) => {
    if (!p?.paidAt) return false;
    const d = new Date(p.paidAt);
    return d.getFullYear() === dueDate.getFullYear() && d.getMonth() === dueDate.getMonth();
  }) || null;
}

// Returns the Y/M/D in Asia/Dubai (UTC+4, no DST) for a given Date.
export function dubaiYMD(date) {
  const dubaiMs = date.getTime() + 4 * 60 * 60 * 1000;
  const d = new Date(dubaiMs);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    day: d.getUTCDate(),
  };
}
