import 'dotenv/config';
import connectToDatabase from '../_db.js';
import { requireAuth } from '../_auth.js';
import ObjectStorage from '../models/ObjectStorage.js';

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
  const payments = normalizeAndSortPayments(json.payments || []);
  const totalPaid = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  return {
    ...json,
    payments,
    totalPaid,
    paymentCount: payments.length,
    nextPaymentDate: json.nextPaymentDate ? new Date(json.nextPaymentDate) : null,
    recurrenceEndDate: json.recurrenceEndDate ? new Date(json.recurrenceEndDate) : null,
  };
}

export default async function handler(req, res) {
  const auth = requireAuth(req, res, []);
  if (!auth) return;

  await connectToDatabase();

  if (req.method === 'GET') {
    try {
      const docs = await ObjectStorage.find({}).sort({ createdAt: -1 });
      const items = docs.map((doc) => withComputedFields(doc));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, items }));
    } catch (error) {
      console.error('ObjectStorage GET error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: error.message }));
    }
  }

  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      if (!body.name || !String(body.name).trim()) {
        throw new Error('Name is required');
      }

      const created = await ObjectStorage.create({
        name: String(body.name).trim(),
        provider: body.provider || '',
        providerAccount: body.providerAccount || '',
        size: body.size || '',
        location: body.location || '',
        status: ['Active', 'Paused', 'Terminated', 'Pending'].includes(body.status) ? body.status : 'Active',
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
      return res.end(JSON.stringify({ success: true, item: withComputedFields(created) }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: error.message }));
    }
  }

  if (req.method === 'PUT') {
    try {
      const body = req.body || {};
      if (!body.id) throw new Error('Object storage id is required');

      const item = await ObjectStorage.findById(body.id);
      if (!item) throw new Error('Object storage not found');

      if (body.action === 'add-payment') {
        const amount = Number(body.amount);
        if (!Number.isFinite(amount) || amount < 0) {
          throw new Error('Payment amount must be a valid positive number');
        }
        if (!Array.isArray(item.payments)) item.payments = [];
        item.payments.push({
          amount,
          paidAt: body.paidAt ? new Date(body.paidAt) : new Date(),
          note: body.note || '',
          currency: normalizeCurrency(body.currency, item.currency),
        });
        if (body.nextPaymentDate) {
          item.nextPaymentDate = new Date(body.nextPaymentDate);
        }
      } else if (body.action === 'edit-payment') {
        if (!body.paymentId) throw new Error('paymentId is required');
        if (!Array.isArray(item.payments)) item.payments = [];
        const payment = item.payments.find((p) => String(p._id) === String(body.paymentId));
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
        if (!body.dueDate && !body.paymentId) {
          throw new Error('dueDate or paymentId is required');
        }
        if (!Array.isArray(item.payments)) item.payments = [];
        let idx = -1;
        if (body.paymentId) {
          idx = item.payments.findIndex((p) => String(p._id) === String(body.paymentId));
        } else {
          const target = new Date(body.dueDate);
          idx = item.payments.findIndex((p) => {
            if (!p?.paidAt) return false;
            const pd = new Date(p.paidAt);
            return pd.getFullYear() === target.getFullYear() && pd.getMonth() === target.getMonth();
          });
        }
        if (idx === -1) throw new Error('No matching payment to remove');
        item.payments.splice(idx, 1);
      } else if (body.action === 'mark-paid-through') {
        if (!body.untilDate) throw new Error('untilDate is required');
        if (!item.nextPaymentDate) throw new Error('Item has no payment schedule');
        const cycleStep = { Monthly: 1, Quarterly: 3, Annual: 12 }[item.billingCycle];
        if (!cycleStep) throw new Error('Bulk pay only supports recurring cycles');
        const anchor = new Date(item.nextPaymentDate);
        const anchorDay = anchor.getDate();
        const until = new Date(body.untilDate);
        const recurrenceEnd = item.recurrenceEndDate
          ? new Date(item.recurrenceEndDate)
          : new Date(until.getFullYear(), 11, 31);
        const cap = until < recurrenceEnd ? until : recurrenceEnd;
        if (!Array.isArray(item.payments)) item.payments = [];
        const amount = Number(item.monthlyCost) || 0;
        const currency = normalizeCurrency(body.currency, item.currency);
        const note = body.note || `Paid on ${new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}`;
        let year = anchor.getFullYear();
        let month = anchor.getMonth();
        let added = 0;
        for (let i = 0; i < 240; i += 1) {
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          const day = Math.min(anchorDay, daysInMonth);
          const dueDate = new Date(year, month, day);
          if (dueDate > cap) break;
          const alreadyPaid = item.payments.some((p) => {
            if (!p?.paidAt) return false;
            const d = new Date(p.paidAt);
            return d.getFullYear() === dueDate.getFullYear() && d.getMonth() === dueDate.getMonth();
          });
          if (!alreadyPaid) {
            item.payments.push({ amount, paidAt: dueDate, note, currency });
            added += 1;
          }
          month += cycleStep;
          while (month > 11) { month -= 12; year += 1; }
        }
        if (added === 0) throw new Error('No unpaid months in that range');
      } else if (body.action === 'mark-paid') {
        const amount = body.amount !== undefined ? Number(body.amount) : Number(item.monthlyCost || 0);
        if (!Number.isFinite(amount) || amount < 0) {
          throw new Error('Payment amount must be a valid positive number');
        }
        if (!Array.isArray(item.payments)) item.payments = [];
        const paidAt = body.paidAt ? new Date(body.paidAt) : new Date();
        item.payments.push({
          amount,
          paidAt,
          note: body.note || 'Marked as paid',
          currency: normalizeCurrency(body.currency, item.currency),
        });
        if (body.clearNextPaymentDate) {
          item.nextPaymentDate = null;
        }
      } else {
        const allowedFields = [
          'name',
          'provider',
          'providerAccount',
          'size',
          'location',
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
              item[field] = Number(body[field]) || 0;
            } else if (field === 'currency') {
              item[field] = normalizeCurrency(body[field], item.currency);
            } else if (field === 'nextPaymentDate' || field === 'recurrenceEndDate') {
              item[field] = body[field] ? new Date(body[field]) : null;
            } else if (field === 'status') {
              item[field] = ['Active', 'Paused', 'Terminated', 'Pending'].includes(body[field])
                ? body[field]
                : 'Active';
            } else if (field === 'billingCycle') {
              item[field] = ['Monthly', 'Quarterly', 'Annual', 'One-time'].includes(body[field])
                ? body[field]
                : 'Monthly';
            } else {
              item[field] = body[field];
            }
          }
        }
      }

      await item.save();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, item: withComputedFields(item) }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: error.message }));
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.body || {};
      if (!id) throw new Error('Object storage id is required');
      const deleted = await ObjectStorage.findByIdAndDelete(id);
      if (!deleted) throw new Error('Object storage not found');
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
