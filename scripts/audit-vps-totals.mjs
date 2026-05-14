import 'dotenv/config';
import mongoose from 'mongoose';
import Vps from '../api/models/Vps.js';

const CYCLE_STEP_MONTHS = { Monthly: 1, Quarterly: 3, Annual: 12 };

const expandDueDates = (vps, calendarYear) => {
  if (!vps?.nextPaymentDate) return [];
  const step = CYCLE_STEP_MONTHS[vps.billingCycle];
  if (!step) return [new Date(vps.nextPaymentDate)];
  const anchor = new Date(vps.nextPaymentDate);
  const anchorDay = anchor.getDate();
  const end = vps.recurrenceEndDate
    ? new Date(vps.recurrenceEndDate)
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
};

const findPaymentForMonth = (vps, dueDate) => {
  if (!Array.isArray(vps?.payments)) return null;
  return vps.payments.find((p) => {
    if (!p?.paidAt) return false;
    const d = new Date(p.paidAt);
    return d.getFullYear() === dueDate.getFullYear() && d.getMonth() === dueDate.getMonth();
  }) || null;
};

await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB || undefined });

const all = await Vps.find({}).lean();
const now = new Date();
const year = now.getFullYear();
const month = now.getMonth();

const monthName = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
console.log(`\n=== Audit for ${monthName} (year=${year}, monthIdx=${month}) ===`);
console.log(`Total VPS records: ${all.length}\n`);

let dueCount = 0;
let costSum = 0;
let paidSum = 0;
let dueAmtSum = 0;
const noDue = [];
const rows = [];

for (const item of all) {
  const dueDates = expandDueDates(item, year);
  const dueThisMonth = dueDates.find((d) => d.getFullYear() === year && d.getMonth() === month);
  if (!dueThisMonth) {
    noDue.push(item);
    continue;
  }
  dueCount += 1;
  const cost = Number(item.monthlyCost) || 0;
  costSum += cost;
  const payment = findPaymentForMonth(item, dueThisMonth);
  let paidAmt = 0;
  if (payment) {
    paidAmt = Number(payment.amount ?? cost) || 0;
    paidSum += paidAmt;
  } else {
    dueAmtSum += cost;
  }
  rows.push({
    name: item.name,
    ip: item.ipAddress,
    cycle: item.billingCycle,
    cost,
    paid: payment ? paidAmt : null,
    due: dueThisMonth.toISOString().slice(0, 10),
    recurrenceEnd: item.recurrenceEndDate ? new Date(item.recurrenceEndDate).toISOString().slice(0, 10) : null,
  });
}

rows.sort((a, b) => a.due.localeCompare(b.due) || a.name.localeCompare(b.name));
console.log(`Items with a due date this month: ${dueCount}`);
console.log(`Items with NO due date this month: ${noDue.length}\n`);

console.log('Per-item contributions to "Cost This Month":');
console.log('  due-date  | cost   | paid amt        | name (ip) [cycle]');
for (const r of rows) {
  const paidStr = r.paid == null ? 'unpaid' : `paid $${r.paid.toFixed(2)}`;
  const mismatch = r.paid != null && Math.abs(r.paid - r.cost) > 0.001 ? '  <-- paid != cost' : '';
  console.log(`  ${r.due} | $${r.cost.toFixed(2).padStart(6)} | ${paidStr.padEnd(15)} | ${r.name} (${r.ip}) [${r.cycle}]${mismatch}`);
}

console.log('\nTotals:');
console.log(`  Sum of monthlyCost (Cost This Month): $${costSum.toFixed(2)}`);
console.log(`  Sum of paid (using payment.amount):   $${paidSum.toFixed(2)}`);
console.log(`  Sum of unpaid dues (using cost):      $${dueAmtSum.toFixed(2)}`);
console.log(`  Paid + Due check:                     $${(paidSum + dueAmtSum).toFixed(2)}`);

if (noDue.length) {
  console.log('\nItems EXCLUDED from "Cost This Month" (no recurrence hit in April 2026):');
  for (const item of noDue) {
    const reason = !item.nextPaymentDate
      ? 'no nextPaymentDate'
      : item.recurrenceEndDate && new Date(item.recurrenceEndDate) < new Date(year, month, 1)
        ? `recurrenceEnd ${new Date(item.recurrenceEndDate).toISOString().slice(0,10)} is before this month`
        : `cycle=${item.billingCycle}, anchor=${new Date(item.nextPaymentDate).toISOString().slice(0,10)} doesn't land in this month`;
    console.log(`  - ${item.name} (${item.ipAddress}) cost=$${(item.monthlyCost||0).toFixed(2)} | ${reason}`);
  }
}

await mongoose.disconnect();
