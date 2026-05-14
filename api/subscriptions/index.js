import 'dotenv/config';
import connectToDatabase from '../_db.js';
import { requireAuth } from '../_auth.js';
import Subscription from '../models/Subscription.js';
import { encrypt, decrypt } from '../utils/encryption.js';

const ALLOWED_CURRENCIES = ['USD', 'EUR', 'AED'];
const normalizeCurrency = (input, fallback = 'USD') =>
  ALLOWED_CURRENCIES.includes(input) ? input : (ALLOWED_CURRENCIES.includes(fallback) ? fallback : 'USD');

function normalizeAndSortPayments(payments = []) {
  return (payments || [])
    .filter((p) => p && p.amount !== undefined)
    .map((payment) => ({
      ...payment,
      paidAt: payment.paidAt ? new Date(payment.paidAt) : new Date(0),
    }))
    .sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));
}

function withComputedFields(doc) {
  const json = doc.toJSON();
  // Favour the newer `payments` array; fall back to the legacy `recurringPayments`.
  const sourcePayments =
    Array.isArray(json.payments) && json.payments.length
      ? json.payments
      : Array.isArray(json.recurringPayments)
        ? json.recurringPayments
        : [];
  const payments = normalizeAndSortPayments(sourcePayments);
  const totalPaid = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);

  let decryptedPassword = '';
  let decryptedProviderAccount = '';
  try { if (json.password) decryptedPassword = decrypt(json.password); } catch { /* ignore */ }
  try { if (json.providerAccount) decryptedProviderAccount = decrypt(json.providerAccount); } catch { /* ignore */ }

  return {
    ...json,
    password: decryptedPassword,
    providerAccount: decryptedProviderAccount,
    payments,
    totalPaid,
    paymentCount: payments.length,
    nextPaymentDate: json.nextPaymentDate ? new Date(json.nextPaymentDate) : null,
    recurrenceEndDate: json.recurrenceEndDate ? new Date(json.recurrenceEndDate) : null,
  };
}

export default async function handler(req, res) {
  const auth = requireAuth(req, res, ['admin']);
  if (!auth) return;
  await connectToDatabase();

  if (req.method === 'GET') {
    try {
      const docs = await Subscription.find({}).sort({ createdAt: -1 });
      const subscriptions = docs.map(withComputedFields);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, subscriptions }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: error.message }));
    }
  }

  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      if (!body.name || !String(body.name).trim()) throw new Error('Subscription name is required');
      if (!body.username || !String(body.username).trim()) throw new Error('Username is required');
      const authType = body.authType === 'google' ? 'google' : 'password';
      if (authType === 'password' && (!body.password || !String(body.password).trim())) {
        throw new Error('Password is required');
      }

      const created = await Subscription.create({
        name: String(body.name).trim(),
        provider: body.provider || '',
        providerAccount: body.providerAccount ? encrypt(body.providerAccount) : '',
        category: body.category || 'General',
        username: body.username || '',
        password: authType === 'google' ? '' : (body.password ? encrypt(body.password) : ''),
        authType,
        url: body.url || '',
        status: ['Active', 'Paused', 'Cancelled', 'Pending'].includes(body.status) ? body.status : 'Active',
        monthlyCost: Number(body.monthlyCost) || 0,
        currency: normalizeCurrency(body.currency),
        billingCycle: ['Monthly', 'Quarterly', 'Annual', 'One-time'].includes(body.billingCycle)
          ? body.billingCycle
          : 'Monthly',
        nextPaymentDate: body.nextPaymentDate ? new Date(body.nextPaymentDate) : null,
        recurrenceEndDate: body.recurrenceEndDate ? new Date(body.recurrenceEndDate) : null,
        notes: body.notes || '',
        payments: [],
        ownerUserId: auth.sub,
      });

      res.writeHead(201, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, subscription: withComputedFields(created) }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: error.message }));
    }
  }

  if (req.method === 'PUT') {
    try {
      const body = req.body || {};
      if (!body.id) throw new Error('Subscription id is required');

      const sub = await Subscription.findById(body.id);
      if (!sub) throw new Error('Subscription not found');

      if (!Array.isArray(sub.payments)) {
        // Lazy-migrate legacy recurringPayments into the unified payments array.
        sub.payments = Array.isArray(sub.recurringPayments) ? sub.recurringPayments : [];
      }

      if (body.action === 'add-payment') {
        const amount = Number(body.amount);
        if (!Number.isFinite(amount) || amount < 0) throw new Error('Payment amount must be a valid positive number');
        sub.payments.push({
          amount,
          paidAt: body.paidAt ? new Date(body.paidAt) : new Date(),
          note: body.note || '',
          currency: normalizeCurrency(body.currency, sub.currency),
        });
      } else if (body.action === 'edit-payment') {
        if (!body.paymentId) throw new Error('paymentId is required');
        const payment = sub.payments.find((p) => String(p._id) === String(body.paymentId));
        if (!payment) throw new Error('Payment not found');
        if (body.amount !== undefined) {
          const amount = Number(body.amount);
          if (!Number.isFinite(amount) || amount < 0) throw new Error('Payment amount must be a valid positive number');
          payment.amount = amount;
        }
        if (body.paidAt !== undefined) payment.paidAt = body.paidAt ? new Date(body.paidAt) : new Date();
        if (body.note !== undefined) payment.note = body.note || '';
        if (body.currency !== undefined) payment.currency = normalizeCurrency(body.currency);
      } else if (body.action === 'mark-paid') {
        const amount = body.amount !== undefined ? Number(body.amount) : Number(sub.monthlyCost || 0);
        if (!Number.isFinite(amount) || amount < 0) throw new Error('Payment amount must be a valid positive number');
        sub.payments.push({
          amount,
          paidAt: body.paidAt ? new Date(body.paidAt) : new Date(),
          note: body.note || 'Marked as paid',
          currency: normalizeCurrency(body.currency, sub.currency),
        });
        if (body.clearNextPaymentDate) sub.nextPaymentDate = null;
      } else if (body.action === 'unmark-paid') {
        if (!body.dueDate && !body.paymentId) throw new Error('dueDate or paymentId is required');
        let idx = -1;
        if (body.paymentId) {
          idx = sub.payments.findIndex((p) => String(p._id) === String(body.paymentId));
        } else {
          const target = new Date(body.dueDate);
          idx = sub.payments.findIndex((p) => {
            if (!p?.paidAt) return false;
            const pd = new Date(p.paidAt);
            return pd.getFullYear() === target.getFullYear() && pd.getMonth() === target.getMonth();
          });
        }
        if (idx === -1) throw new Error('No matching payment to remove');
        sub.payments.splice(idx, 1);
      } else if (body.action === 'mark-paid-through') {
        if (!body.untilDate) throw new Error('untilDate is required');
        if (!sub.nextPaymentDate) throw new Error('Subscription has no payment schedule');
        const cycleStep = { Monthly: 1, Quarterly: 3, Annual: 12 }[sub.billingCycle];
        if (!cycleStep) throw new Error('Bulk pay only supports recurring cycles');
        const anchor = new Date(sub.nextPaymentDate);
        const anchorDay = anchor.getDate();
        const until = new Date(body.untilDate);
        const recurrenceEnd = sub.recurrenceEndDate
          ? new Date(sub.recurrenceEndDate)
          : new Date(until.getFullYear(), 11, 31);
        const cap = until < recurrenceEnd ? until : recurrenceEnd;
        const amount = Number(sub.monthlyCost) || 0;
        const currency = normalizeCurrency(body.currency, sub.currency);
        const note = body.note || `Paid on ${new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}`;
        let year = anchor.getFullYear();
        let month = anchor.getMonth();
        let added = 0;
        for (let i = 0; i < 240; i += 1) {
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          const day = Math.min(anchorDay, daysInMonth);
          const dueDate = new Date(year, month, day);
          if (dueDate > cap) break;
          const alreadyPaid = sub.payments.some((p) => {
            if (!p?.paidAt) return false;
            const d = new Date(p.paidAt);
            return d.getFullYear() === dueDate.getFullYear() && d.getMonth() === dueDate.getMonth();
          });
          if (!alreadyPaid) {
            sub.payments.push({ amount, paidAt: dueDate, note, currency });
            added += 1;
          }
          month += cycleStep;
          while (month > 11) { month -= 12; year += 1; }
        }
        if (added === 0) throw new Error('No unpaid months in that range');
      } else {
        const allowedFields = [
          'name',
          'provider',
          'providerAccount',
          'category',
          'username',
          'password',
          'authType',
          'url',
          'status',
          'monthlyCost',
          'currency',
          'billingCycle',
          'nextPaymentDate',
          'recurrenceEndDate',
          'notes',
        ];
        for (const field of allowedFields) {
          if (body[field] === undefined) continue;
          if (field === 'monthlyCost') {
            sub[field] = Number(body[field]) || 0;
          } else if (field === 'currency') {
            sub[field] = normalizeCurrency(body[field], sub.currency);
          } else if (field === 'nextPaymentDate' || field === 'recurrenceEndDate') {
            sub[field] = body[field] ? new Date(body[field]) : null;
          } else if (field === 'status') {
            sub[field] = ['Active', 'Paused', 'Cancelled', 'Pending'].includes(body[field]) ? body[field] : 'Active';
          } else if (field === 'billingCycle') {
            sub[field] = ['Monthly', 'Quarterly', 'Annual', 'One-time'].includes(body[field]) ? body[field] : 'Monthly';
          } else if (field === 'password' || field === 'providerAccount') {
            // Preserve existing value when blank submission — matches VPS / credentials behavior.
            // Exception: when switching to Google sign-in, clear the stored password.
            if (field === 'password' && body.authType === 'google') {
              sub[field] = '';
            } else if (body[field]) {
              sub[field] = encrypt(body[field]);
            }
          } else if (field === 'authType') {
            sub[field] = body[field] === 'google' ? 'google' : 'password';
          } else {
            sub[field] = body[field];
          }
        }
      }

      await sub.save();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, subscription: withComputedFields(sub) }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: error.message }));
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.body || {};
      if (!id) throw new Error('Subscription id is required');
      const deleted = await Subscription.findByIdAndDelete(id);
      if (!deleted) throw new Error('Subscription not found');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: error.message }));
    }
  }

  res.writeHead(405, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
}
