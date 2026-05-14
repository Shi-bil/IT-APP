import 'dotenv/config';
import connectToDatabase from '../_db.js';
import { requireAuth } from '../_auth.js';
import AiAccount from '../models/AiAccount.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import {
  fetchProviderCost,
  fetchProviderBalance,
  getProviderMode,
  providerSupportsAutoSync,
  SUPPORTED_PROVIDERS,
} from '../utils/aiProviders.js';

const STALE_AFTER_MS = 60 * 1000; // refresh on GET if older than 60s

const maskKey = (encryptedKey) => {
  if (!encryptedKey) return '';
  try {
    const plain = decrypt(encryptedKey);
    if (!plain) return '';
    if (plain.length <= 8) return '••••';
    return `${plain.slice(0, 7)}••••${plain.slice(-4)}`;
  } catch {
    return '';
  }
};

const sumTopups = (topups = []) =>
  topups.reduce((sum, t) => sum + (Number(t?.amount) || 0), 0);

function toClientShape(doc) {
  const json = doc.toJSON();
  const mode = getProviderMode(json.provider);
  const startingBalance = Number(json.startingBalance) || 0;
  const topupsTotal = sumTopups(json.topups);

  let spentUsd;
  let remainingUsd;
  if (mode === 'balance' && json.cachedBalanceUsd != null) {
    // Provider reports remaining balance directly — that's the source of
    // truth. Spent is derived against startingBalance + topups for context.
    remainingUsd = Math.max(0, Number(json.cachedBalanceUsd) || 0);
    const totalCredit = startingBalance + topupsTotal;
    spentUsd = totalCredit > 0 ? Math.max(0, totalCredit - remainingUsd) : 0;
  } else {
    spentUsd = Number(json.cachedCostUsd) || 0;
    remainingUsd = Math.max(0, startingBalance + topupsTotal - spentUsd);
  }

  return {
    id: json.id,
    provider: json.provider,
    label: json.label,
    accountEmail: json.accountEmail || '',
    notes: json.notes || '',
    keyMask: maskKey(json.adminKey),
    hasKey: Boolean(json.adminKey),
    startingBalance,
    startingBalanceDate: json.startingBalanceDate || null,
    topups: (json.topups || []).map((t) => ({
      id: String(t._id || t.id || ''),
      amount: Number(t.amount) || 0,
      date: t.date || null,
      note: t.note || '',
    })),
    topupsTotal,
    spentUsd,
    remainingUsd,
    lastSyncedAt: json.lastSyncedAt || null,
    lastError: json.lastError || '',
    createdAt: json.createdAt || null,
    updatedAt: json.updatedAt || null,
  };
}

async function refreshAccount(account, { force = false } = {}) {
  // Manual providers have no cost API — nothing to fetch.
  if (!providerSupportsAutoSync(account.provider)) return account;
  if (!account.adminKey) return account;
  const lastSync = account.lastSyncedAt ? new Date(account.lastSyncedAt).getTime() : 0;
  if (!force && lastSync && Date.now() - lastSync < STALE_AFTER_MS) {
    return account;
  }
  try {
    const apiKey = decrypt(account.adminKey);
    if (!apiKey) throw new Error('Stored API key could not be decrypted');
    const mode = getProviderMode(account.provider);
    if (mode === 'balance') {
      const { balanceUsd } = await fetchProviderBalance(account.provider, apiKey);
      account.cachedBalanceUsd = balanceUsd;
    } else {
      const startDate = account.startingBalanceDate || account.createdAt || new Date(0);
      const { totalUsd } = await fetchProviderCost(account.provider, apiKey, startDate);
      account.cachedCostUsd = totalUsd;
    }
    account.lastSyncedAt = new Date();
    account.lastError = '';
  } catch (err) {
    account.lastError = err.message || String(err);
    account.lastSyncedAt = new Date();
  }
  await account.save();
  return account;
}

export default async function handler(req, res) {
  const auth = requireAuth(req, res, ['admin']);
  if (!auth) return;

  await connectToDatabase();

  if (req.method === 'GET') {
    try {
      const force = String(req.query?.refresh || '') === '1';
      const docs = await AiAccount.find({}).sort({ createdAt: -1 });
      // Refresh in parallel; per-account errors are captured into lastError
      // by refreshAccount itself, so Promise.all won't reject as a whole.
      await Promise.all(docs.map((doc) => refreshAccount(doc, { force })));
      const accounts = docs.map(toClientShape);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, accounts }));
    } catch (error) {
      console.error('AI accounts GET error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: error.message }));
    }
  }

  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      if (!SUPPORTED_PROVIDERS.includes(body.provider)) {
        throw new Error(`Provider must be one of: ${SUPPORTED_PROVIDERS.join(', ')}`);
      }
      if (!body.label || !String(body.label).trim()) {
        throw new Error('Label is required');
      }
      // Admin key is only required for providers we can auto-sync from.
      if (
        providerSupportsAutoSync(body.provider) &&
        (!body.adminKey || !String(body.adminKey).trim())
      ) {
        throw new Error('Admin API key is required');
      }
      const startingBalance = Number(body.startingBalance);
      if (!Number.isFinite(startingBalance) || startingBalance < 0) {
        throw new Error('Starting balance must be a non-negative number');
      }

      const created = await AiAccount.create({
        provider: body.provider,
        label: String(body.label).trim(),
        accountEmail: body.accountEmail ? String(body.accountEmail).trim() : '',
        notes: body.notes ? String(body.notes) : '',
        adminKey: body.adminKey
          ? encrypt(String(body.adminKey).trim())
          : '',
        startingBalance,
        startingBalanceDate: body.startingBalanceDate
          ? new Date(body.startingBalanceDate)
          : new Date(),
        topups: [],
        ownerUserId: auth.sub,
      });

      // Kick off an immediate sync so the card shows real numbers right away.
      await refreshAccount(created, { force: true });

      res.writeHead(201, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, account: toClientShape(created) }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: error.message }));
    }
  }

  if (req.method === 'PUT') {
    try {
      const body = req.body || {};
      if (!body.id) throw new Error('Account id is required');
      const account = await AiAccount.findById(body.id);
      if (!account) throw new Error('Account not found');

      if (body.action === 'refresh') {
        await refreshAccount(account, { force: true });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, account: toClientShape(account) }));
      }

      if (body.action === 'add-topup') {
        const amount = Number(body.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
          throw new Error('Top-up amount must be a positive number');
        }
        if (!Array.isArray(account.topups)) account.topups = [];
        account.topups.push({
          amount,
          date: body.date ? new Date(body.date) : new Date(),
          note: body.note || '',
        });
        await account.save();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, account: toClientShape(account) }));
      }

      if (body.action === 'remove-topup') {
        if (!body.topupId) throw new Error('topupId is required');
        if (!Array.isArray(account.topups)) account.topups = [];
        const idx = account.topups.findIndex((t) => String(t._id) === String(body.topupId));
        if (idx === -1) throw new Error('Top-up not found');
        account.topups.splice(idx, 1);
        await account.save();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, account: toClientShape(account) }));
      }

      // Plain field update (label, starting balance, key, etc.)
      if (body.label !== undefined) account.label = String(body.label).trim();
      if (body.accountEmail !== undefined) {
        account.accountEmail = String(body.accountEmail).trim();
      }
      if (body.notes !== undefined) account.notes = String(body.notes);
      if (body.startingBalance !== undefined) {
        const sb = Number(body.startingBalance);
        if (!Number.isFinite(sb) || sb < 0) throw new Error('Starting balance must be non-negative');
        account.startingBalance = sb;
      }
      if (body.startingBalanceDate !== undefined) {
        account.startingBalanceDate = body.startingBalanceDate
          ? new Date(body.startingBalanceDate)
          : new Date();
      }
      if (body.adminKey) {
        // Match credentials/vps behavior: only update when a non-empty value
        // is submitted, otherwise preserve the stored key.
        account.adminKey = encrypt(String(body.adminKey).trim());
      }

      await account.save();
      // Re-sync after a meaningful change (key or starting date).
      if (body.adminKey || body.startingBalanceDate !== undefined) {
        await refreshAccount(account, { force: true });
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, account: toClientShape(account) }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: error.message }));
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.body || {};
      if (!id) throw new Error('Account id is required');
      const deleted = await AiAccount.findByIdAndDelete(id);
      if (!deleted) throw new Error('Account not found');
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
