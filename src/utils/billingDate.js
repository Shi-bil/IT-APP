// Compute the payment date for the current cycle, derived from the stored
// anchor (`nextPaymentDate` — the first/seed payment date) and the billing
// cycle. For Monthly the result is always in the current calendar month;
// for Quarterly/Annual the result is the most recent due date on/before
// today (i.e. the current open billing period).
//
// If the anchor is in the future, the anchor itself is returned (the
// subscription hasn't started yet, so showing a back-dated value would be
// misleading).
//
// `getDisplayPaymentDate` additionally accepts the item's `payments` list
// and advances by one cycle if the current cycle is already marked paid.
const CYCLE_STEP_MONTHS = { Monthly: 1, Quarterly: 3, Annual: 12 };

function advanceCycle(date, billingCycle = 'Monthly') {
  const step = CYCLE_STEP_MONTHS[billingCycle] || 1;
  const targetMonthAbs = date.getMonth() + step;
  const targetYear = date.getFullYear() + Math.floor(targetMonthAbs / 12);
  const targetMonth = ((targetMonthAbs % 12) + 12) % 12;
  const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const day = Math.min(date.getDate(), daysInMonth);
  return new Date(targetYear, targetMonth, day);
}

export function isCyclePaid(payments, cycleDate) {
  if (!Array.isArray(payments) || !cycleDate) return false;
  return payments.some((p) => {
    if (!p?.paidAt) return false;
    const d = new Date(p.paidAt);
    return d.getFullYear() === cycleDate.getFullYear() && d.getMonth() === cycleDate.getMonth();
  });
}

export function getCurrentCyclePaymentDate(anchor, billingCycle = 'Monthly') {
  if (!anchor) return null;
  const start = anchor instanceof Date ? anchor : new Date(anchor);
  if (Number.isNaN(start.getTime())) return null;

  const step = CYCLE_STEP_MONTHS[billingCycle] || 1;
  const today = new Date();

  // Future-dated anchor → show the anchor as-is.
  if (start > today) return start;

  const monthsDiff = (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth());
  const cyclesPassed = Math.max(0, Math.floor(monthsDiff / step));
  const targetMonthAbs = start.getMonth() + cyclesPassed * step;
  const targetYear = start.getFullYear() + Math.floor(targetMonthAbs / 12);
  const targetMonth = ((targetMonthAbs % 12) + 12) % 12;
  const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const day = Math.min(start.getDate(), daysInMonth);
  return new Date(targetYear, targetMonth, day);
}

// Returns the date to display in the "Payments date on" field. If the
// current cycle is already paid (per the `payments` array), the next
// cycle's date is returned instead.
export function getDisplayPaymentDate(anchor, billingCycle = 'Monthly', payments = []) {
  let date = getCurrentCyclePaymentDate(anchor, billingCycle);
  if (!date) return null;
  // Walk forward across any already-paid cycles (e.g. user paid through
  // several months in advance via "Pay through…").
  while (isCyclePaid(payments, date)) {
    date = advanceCycle(date, billingCycle);
  }
  return date;
}

export function formatPaymentDate(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: '2-digit' });
}
