import 'dotenv/config';
import connectToDatabase from '../_db.js';
import { requireAuth } from '../_auth.js';
import Vps from '../models/Vps.js';
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

function withComputedFields(vpsDoc) {
  const json = vpsDoc.toJSON();
  const payments = normalizeAndSortPayments(json.payments || []);
  const totalPaid = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);

  // Decrypt sensitive fields
  let decryptedPassword = '';
  let decryptedProviderAccount = '';
  
  try {
    if (json.password) {
      decryptedPassword = decrypt(json.password);
    }
  } catch (err) {
    console.error('Error decrypting password:', err);
  }
  
  try {
    if (json.providerAccount) {
      decryptedProviderAccount = decrypt(json.providerAccount);
    }
  } catch (err) {
    console.error('Error decrypting providerAccount:', err);
  }

  const decrypted = {
    ...json,
    password: decryptedPassword,
    providerAccount: decryptedProviderAccount,
  };

  return {
    ...decrypted,
    payments,
    totalPaid,
    paymentCount: payments.length,
    nextPaymentDate: json.nextPaymentDate ? new Date(json.nextPaymentDate) : null,
    recurrenceEndDate: json.recurrenceEndDate ? new Date(json.recurrenceEndDate) : null,
  };
}

export default async function handler(req, res) {
  const auth = requireAuth(req, res, []); // allow any authenticated user
  if (!auth) return;

  await connectToDatabase();

  if (req.method === 'GET') {
    try {
      const docs = await Vps.find({}).sort({ createdAt: -1 });
      const items = docs.map((doc) => withComputedFields(doc));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, vps: items }));
    } catch (error) {
      console.error('VPS GET error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: error.message }));
    }
  }

  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      if (!body.name || !String(body.name).trim()) {
        throw new Error('VPS name is required');
      }

      const created = await Vps.create({
        name: String(body.name).trim(),
        provider: body.provider || '',
        providerAccount: body.providerAccount ? encrypt(body.providerAccount) : '',
        hostname: body.hostname || '',
        ipAddress: body.ipAddress || '',
        password: body.password ? encrypt(body.password) : '',
        region: body.region || '',
        os: body.os || '',
        plan: body.plan || '',
        status: ['Active', 'Paused', 'Terminated', 'Pending'].includes(body.status) ? body.status : 'Active',
        monthlyCost: Number(body.monthlyCost) || 0,
        currency: normalizeCurrency(body.currency),
        billingCycle: ['Monthly', 'Quarterly', 'Annual', 'One-time'].includes(body.billingCycle)
          ? body.billingCycle
          : 'Monthly',
        nextPaymentDate: body.nextPaymentDate ? new Date(body.nextPaymentDate) : null,
        recurrenceEndDate: body.recurrenceEndDate ? new Date(body.recurrenceEndDate) : null,
        notes: body.notes || '',
        payments:
          body.initialPaymentAmount !== undefined && body.initialPaymentAmount !== ''
            ? [
                {
                  amount: Number(body.initialPaymentAmount) || 0,
                  paidAt: body.initialPaymentDate ? new Date(body.initialPaymentDate) : new Date(),
                  note: body.initialPaymentNote || 'Initial payment',
                  currency: normalizeCurrency(body.currency),
                },
              ]
            : [],
        ownerUserId: auth.sub,
      });

      res.writeHead(201, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, vps: withComputedFields(created) }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: error.message }));
    }
  }

  if (req.method === 'PUT') {
    try {
      const body = req.body || {};
      if (!body.id) throw new Error('VPS id is required');

      const vps = await Vps.findById(body.id);
      if (!vps) throw new Error('VPS not found');

      if (body.action === 'add-payment') {
        const amount = Number(body.amount);
        if (!Number.isFinite(amount) || amount < 0) {
          throw new Error('Payment amount must be a valid positive number');
        }
        if (!Array.isArray(vps.payments)) vps.payments = [];
        vps.payments.push({
          amount,
          paidAt: body.paidAt ? new Date(body.paidAt) : new Date(),
          note: body.note || '',
          currency: normalizeCurrency(body.currency, vps.currency),
        });
        if (body.nextPaymentDate) {
          vps.nextPaymentDate = new Date(body.nextPaymentDate);
        }
      } else if (body.action === 'edit-payment') {
        if (!body.paymentId) throw new Error('paymentId is required');
        if (!Array.isArray(vps.payments)) vps.payments = [];
        const payment = vps.payments.find((p) => String(p._id) === String(body.paymentId));
        if (!payment) throw new Error('Payment not found');
        if (body.amount !== undefined) {
          const amount = Number(body.amount);
          if (!Number.isFinite(amount) || amount < 0) {
            throw new Error('Payment amount must be a valid positive number');
          }
          payment.amount = amount;
        }
        if (body.paidAt !== undefined) payment.paidAt = body.paidAt ? new Date(body.paidAt) : new Date();
        if (body.note !== undefined) payment.note = body.note || '';
        if (body.currency !== undefined) payment.currency = normalizeCurrency(body.currency);
      } else if (body.action === 'unmark-paid') {
        // Remove a single payment entry, identified either by its _id or by the
        // due-date month it settled. Does not touch nextPaymentDate — the
        // recurring schedule stays intact, so the month just flips back to due.
        if (!body.dueDate && !body.paymentId) {
          throw new Error('dueDate or paymentId is required');
        }
        if (!Array.isArray(vps.payments)) vps.payments = [];
        let idx = -1;
        if (body.paymentId) {
          idx = vps.payments.findIndex((p) => String(p._id) === String(body.paymentId));
        } else {
          const target = new Date(body.dueDate);
          idx = vps.payments.findIndex((p) => {
            if (!p?.paidAt) return false;
            const pd = new Date(p.paidAt);
            return pd.getFullYear() === target.getFullYear() && pd.getMonth() === target.getMonth();
          });
        }
        if (idx === -1) throw new Error('No matching payment to remove');
        vps.payments.splice(idx, 1);
      } else if (body.action === 'mark-paid-through') {
        // Bulk-pay every unpaid due month from the recurrence anchor up through
        // the supplied untilDate (capped at recurrenceEndDate / end of year).
        if (!body.untilDate) throw new Error('untilDate is required');
        if (!vps.nextPaymentDate) throw new Error('VPS has no payment schedule');
        const cycleStep = { Monthly: 1, Quarterly: 3, Annual: 12 }[vps.billingCycle];
        if (!cycleStep) throw new Error('Bulk pay only supports recurring cycles');
        const anchor = new Date(vps.nextPaymentDate);
        const anchorDay = anchor.getDate();
        const until = new Date(body.untilDate);
        const recurrenceEnd = vps.recurrenceEndDate
          ? new Date(vps.recurrenceEndDate)
          : new Date(until.getFullYear(), 11, 31);
        const cap = until < recurrenceEnd ? until : recurrenceEnd;
        if (!Array.isArray(vps.payments)) vps.payments = [];
        const amount = Number(vps.monthlyCost) || 0;
        const currency = normalizeCurrency(body.currency, vps.currency);
        const note = body.note || `Paid on ${new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}`;
        let year = anchor.getFullYear();
        let month = anchor.getMonth();
        let added = 0;
        for (let i = 0; i < 240; i += 1) {
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          const day = Math.min(anchorDay, daysInMonth);
          const dueDate = new Date(year, month, day);
          if (dueDate > cap) break;
          const alreadyPaid = vps.payments.some((p) => {
            if (!p?.paidAt) return false;
            const d = new Date(p.paidAt);
            return d.getFullYear() === dueDate.getFullYear() && d.getMonth() === dueDate.getMonth();
          });
          if (!alreadyPaid) {
            vps.payments.push({ amount, paidAt: dueDate, note, currency });
            added += 1;
          }
          month += cycleStep;
          while (month > 11) { month -= 12; year += 1; }
        }
        if (added === 0) throw new Error('No unpaid months in that range');
      } else if (body.action === 'mark-paid') {
        const amount = body.amount !== undefined ? Number(body.amount) : Number(vps.monthlyCost || 0);
        if (!Number.isFinite(amount) || amount < 0) {
          throw new Error('Payment amount must be a valid positive number');
        }
        if (!Array.isArray(vps.payments)) vps.payments = [];
        // paidAt carries the identity of which billing month is being settled —
        // the PaymentCalendar checks month+year of paidAt against recurring dues.
        const paidAt = body.paidAt ? new Date(body.paidAt) : new Date();
        vps.payments.push({
          amount,
          paidAt,
          note: body.note || 'Marked as paid',
          currency: normalizeCurrency(body.currency, vps.currency),
        });
        // Keep nextPaymentDate as the recurrence anchor so future months still
        // show as due. Only clear if explicitly requested.
        if (body.clearNextPaymentDate) {
          vps.nextPaymentDate = null;
        }
      } else {
        const allowedFields = [
          'name',
          'provider',
          'providerAccount',
          'hostname',
          'ipAddress',
          'password',
          'region',
          'os',
          'plan',
          'status',
          'monthlyCost',
          'currency',
          'billingCycle',
          'nextPaymentDate',
          'recurrenceEndDate',
          'notes',
        ];
        for (const field of allowedFields) {
          if (body[field] !== undefined) {
            if (field === 'monthlyCost') {
              vps[field] = Number(body[field]) || 0;
            } else if (field === 'currency') {
              vps[field] = normalizeCurrency(body[field], vps.currency);
            } else if (field === 'nextPaymentDate' || field === 'recurrenceEndDate') {
              vps[field] = body[field] ? new Date(body[field]) : null;
            } else if (field === 'status') {
              vps[field] = ['Active', 'Paused', 'Terminated', 'Pending'].includes(body[field])
                ? body[field]
                : 'Active';
            } else if (field === 'billingCycle') {
              vps[field] = ['Monthly', 'Quarterly', 'Annual', 'One-time'].includes(body[field])
                ? body[field]
                : 'Monthly';
            } else if (field === 'password' || field === 'providerAccount') {
              // Match credentials behavior: only update when a non-empty value is
              // submitted, otherwise preserve what's already stored. Prevents
              // accidental wiping when the edit form's password input is left blank.
              if (body[field]) {
                vps[field] = encrypt(body[field]);
              }
            } else {
              vps[field] = body[field];
            }
          }
        }
      }

      await vps.save();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, vps: withComputedFields(vps) }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: error.message }));
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.body || {};
      if (!id) throw new Error('VPS id is required');
      const deleted = await Vps.findByIdAndDelete(id);
      if (!deleted) throw new Error('VPS not found');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: error.message }));
    }
  }

  res.writeHead(405, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ success: false, error: 'Method Not Allowed' }));
}
