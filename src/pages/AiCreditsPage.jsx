import React, { useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  AlertTriangle,
  X,
  TrendingDown,
  Wallet,
  Clock,
  ExternalLink,
  Mail,
  StickyNote,
} from 'lucide-react';
import aiAccountService from '../services/aiAccountService';
import SuggestInput from '../components/SuggestInput';

// `autoSync: true` providers expose an admin cost API we poll for live spend.
// The rest are tracked manually — balance = starting balance + top-ups.
const PROVIDERS = [
  {
    value: 'openai',
    label: 'OpenAI',
    color: 'from-emerald-500 to-teal-600',
    accent: 'text-emerald-300',
    consoleUrl: 'https://platform.openai.com/settings/organization/admin-keys',
    keyHint: 'sk-admin-...',
    autoSync: true,
    mode: 'cost',
  },
  {
    value: 'anthropic',
    label: 'Anthropic (Claude)',
    color: 'from-orange-500 to-amber-600',
    accent: 'text-orange-300',
    consoleUrl: 'https://console.anthropic.com/settings/admin-keys',
    keyHint: 'sk-ant-admin01-...',
    autoSync: true,
    mode: 'cost',
  },
  {
    value: 'google',
    label: 'Google AI',
    color: 'from-blue-500 to-indigo-600',
    accent: 'text-blue-300',
    consoleUrl: 'https://aistudio.google.com/app/apikey',
    keyHint: 'AIza...',
    autoSync: false,
  },
  {
    value: 'fal',
    label: 'fal.ai',
    color: 'from-pink-500 to-rose-600',
    accent: 'text-pink-300',
    consoleUrl: 'https://fal.ai/dashboard/keys',
    keyHint: 'fal_...',
    autoSync: true,
    mode: 'balance',
  },
  {
    value: 'fish',
    label: 'fish.audio',
    color: 'from-sky-500 to-cyan-600',
    accent: 'text-sky-300',
    consoleUrl: 'https://fish.audio/go-api/api-keys/',
    keyHint: 'API key',
    autoSync: true,
    mode: 'balance',
  },
  {
    value: 'ollama',
    label: 'Ollama',
    color: 'from-slate-500 to-slate-700',
    accent: 'text-slate-300',
    consoleUrl: 'https://ollama.com',
    keyHint: 'self-hosted (no key needed)',
    autoSync: false,
  },
  {
    value: 'openrouter',
    label: 'OpenRouter',
    color: 'from-violet-500 to-purple-600',
    accent: 'text-violet-300',
    consoleUrl: 'https://openrouter.ai/settings/keys',
    keyHint: 'sk-or-...',
    autoSync: false,
  },
  {
    value: 'replicate',
    label: 'Replicate',
    color: 'from-fuchsia-500 to-pink-600',
    accent: 'text-fuchsia-300',
    consoleUrl: 'https://replicate.com/account/api-tokens',
    keyHint: 'r8_...',
    autoSync: false,
  },
  {
    value: 'groq',
    label: 'Groq',
    color: 'from-red-500 to-orange-600',
    accent: 'text-red-300',
    consoleUrl: 'https://console.groq.com/keys',
    keyHint: 'gsk_...',
    autoSync: false,
  },
  {
    value: 'mistral',
    label: 'Mistral',
    color: 'from-amber-500 to-yellow-600',
    accent: 'text-amber-300',
    consoleUrl: 'https://console.mistral.ai/api-keys/',
    keyHint: 'API key',
    autoSync: false,
  },
  {
    value: 'together',
    label: 'Together AI',
    color: 'from-teal-500 to-emerald-600',
    accent: 'text-teal-300',
    consoleUrl: 'https://api.together.ai/settings/api-keys',
    keyHint: 'API key',
    autoSync: false,
  },
  {
    value: 'custom',
    label: 'Other / Custom',
    color: 'from-gray-500 to-gray-700',
    accent: 'text-gray-300',
    consoleUrl: '',
    keyHint: 'API key (optional)',
    autoSync: false,
  },
];

const providerConfig = (value) => PROVIDERS.find((p) => p.value === value) || PROVIDERS[0];

const formatUsd = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    Number(value) || 0
  );

const timeAgo = (date) => {
  if (!date) return 'never';
  const ms = Date.now() - new Date(date).getTime();
  if (ms < 60_000) return 'just now';
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const emptyForm = {
  provider: 'openai',
  label: '',
  accountEmail: '',
  notes: '',
  adminKey: '',
  startingBalance: '',
  startingBalanceDate: new Date().toISOString().slice(0, 10),
};

const AiCreditsPage = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [topupOpenId, setTopupOpenId] = useState(null);
  const [topupForm, setTopupForm] = useState({ amount: '', note: '', date: '' });
  const [perCardBusy, setPerCardBusy] = useState({});

  const suggestions = useMemo(() => ({
    label: accounts.map((a) => a.label),
    accountEmail: accounts.map((a) => a.accountEmail),
  }), [accounts]);

  const loadAccounts = async ({ refresh = false } = {}) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    const res = await aiAccountService.getAll({ force: true, refresh });
    if (res.success) {
      setAccounts(res.accounts);
    } else {
      setError(res.error || 'Failed to load accounts');
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadAccounts();
    // Poll every 5 minutes — the backend caches and only re-fetches from
    // providers when the cache is stale, so this is cheap.
    const id = setInterval(() => loadAccounts({ refresh: false }), 300_000);
    return () => clearInterval(id);
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (account) => {
    setEditingId(account.id);
    setForm({
      provider: account.provider,
      label: account.label,
      accountEmail: account.accountEmail || '',
      notes: account.notes || '',
      adminKey: '',
      startingBalance: String(account.startingBalance ?? ''),
      startingBalanceDate: account.startingBalanceDate
        ? new Date(account.startingBalanceDate).toISOString().slice(0, 10)
        : '',
    });
    setFormError('');
    setShowModal(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setShowModal(false);
    setForm(emptyForm);
    setEditingId(null);
    setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.label.trim()) return setFormError('Label is required');
    const cfg = providerConfig(form.provider);
    if (!editingId && cfg.autoSync && !form.adminKey.trim()) {
      return setFormError('Admin API key is required for this provider');
    }
    const sb = Number(form.startingBalance);
    if (!Number.isFinite(sb) || sb < 0) {
      return setFormError('Starting balance must be a non-negative number');
    }

    setSubmitting(true);
    const payload = {
      label: form.label.trim(),
      accountEmail: form.accountEmail.trim(),
      notes: form.notes,
      startingBalance: sb,
      startingBalanceDate: form.startingBalanceDate || undefined,
    };
    if (form.adminKey.trim()) payload.adminKey = form.adminKey.trim();

    let res;
    if (editingId) {
      res = await aiAccountService.update(editingId, payload);
    } else {
      res = await aiAccountService.create({
        ...payload,
        provider: form.provider,
      });
    }

    setSubmitting(false);
    if (!res.success) {
      setFormError(res.error || 'Save failed');
      return;
    }
    setShowModal(false);
    setForm(emptyForm);
    setEditingId(null);
    loadAccounts({ refresh: false });
  };

  const handleRefreshOne = async (id) => {
    setPerCardBusy((s) => ({ ...s, [id]: 'refresh' }));
    const res = await aiAccountService.refreshOne(id);
    if (res.success && res.account) {
      setAccounts((list) => list.map((a) => (a.id === id ? res.account : a)));
    } else {
      setError(res.error || 'Refresh failed');
    }
    setPerCardBusy((s) => ({ ...s, [id]: null }));
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const id = deletingId;
    setDeletingId(null);
    setPerCardBusy((s) => ({ ...s, [id]: 'delete' }));
    const res = await aiAccountService.remove(id);
    if (res.success) {
      setAccounts((list) => list.filter((a) => a.id !== id));
    } else {
      setError(res.error || 'Delete failed');
    }
    setPerCardBusy((s) => ({ ...s, [id]: null }));
  };

  const handleAddTopup = async (id) => {
    const amount = Number(topupForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setPerCardBusy((s) => ({ ...s, [id]: 'topup' }));
    const res = await aiAccountService.addTopup(id, {
      amount,
      note: topupForm.note,
      date: topupForm.date || undefined,
    });
    if (res.success && res.account) {
      setAccounts((list) => list.map((a) => (a.id === id ? res.account : a)));
      setTopupOpenId(null);
      setTopupForm({ amount: '', note: '', date: '' });
    } else {
      setError(res.error || 'Failed to add top-up');
    }
    setPerCardBusy((s) => ({ ...s, [id]: null }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-purple-500 to-pink-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Live Credits</h1>
            <p className="text-sm text-slate-400">
              Live balance estimates for OpenAI, Anthropic, and other AI accounts
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => loadAccounts({ refresh: true })}
            disabled={refreshing || loading}
            className="btn-secondary flex items-center space-x-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh all</span>
          </button>
          <button
            onClick={openCreate}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-semibold px-4 py-2.5 rounded-lg flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add account</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="glass-morphism border border-red-500/30 bg-red-500/10 text-red-200 p-4 rounded-lg flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm">{error}</p>
          </div>
          <button onClick={() => setError('')} className="text-red-200 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="relative w-14 h-14">
            <div className="absolute inset-0 rounded-full border-2 border-slate-700/50" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-400 border-r-cyan-400 animate-spin" />
            <Sparkles className="absolute inset-0 m-auto w-5 h-5 text-cyan-300 animate-pulse" />
          </div>
          <p className="mt-5 text-sm text-slate-300 font-medium">Loading credit accounts…</p>
          <p className="mt-1 text-xs text-slate-500">Fetching latest balances from your providers</p>
        </div>
      ) : accounts.length === 0 ? (
        <div className="glass-morphism p-12 rounded-xl text-center">
          <Wallet className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No live credit accounts yet</h3>
          <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
            Add an admin API key from each provider's console. Your starting balance
            will tick down as the provider reports usage costs.
          </p>
          <button
            onClick={openCreate}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-semibold px-4 py-2.5 rounded-lg inline-flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add your first account</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {accounts.map((account) => {
            const cfg = providerConfig(account.provider);
            const busy = perCardBusy[account.id];
            const totalCredit = (account.startingBalance || 0) + (account.topupsTotal || 0);
            const pctUsed = totalCredit > 0
              ? Math.min(100, (account.spentUsd / totalCredit) * 100)
              : 0;
            const isLow = totalCredit > 0 && account.remainingUsd / totalCredit < 0.15;
            const pctLeft = totalCredit > 0
              ? Math.max(0, 100 - pctUsed)
              : 0;
            return (
              <div
                key={account.id}
                className="group relative glass-morphism rounded-xl overflow-hidden ring-1 ring-white/5 hover:ring-cyan-400/30 transition-all flex flex-col"
              >
                <div className={`h-0.5 w-full bg-gradient-to-r ${cfg.color}`} />

                <div className="p-4 flex flex-col flex-1">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-lg bg-gradient-to-br ${cfg.color} flex items-center justify-center flex-shrink-0`}
                      >
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-white truncate leading-tight">{account.label}</h3>
                        <p className={`text-[11px] font-medium ${cfg.accent} leading-tight`}>{cfg.label}</p>
                      </div>
                    </div>
                    <div className="flex items-center -mr-1 opacity-70 group-hover:opacity-100 transition flex-shrink-0">
                      <button
                        title="Refresh"
                        onClick={() => handleRefreshOne(account.id)}
                        disabled={busy === 'refresh'}
                        className="p-1 rounded text-slate-400 hover:text-cyan-300 transition disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${busy === 'refresh' ? 'animate-spin' : ''}`} />
                      </button>
                      <button
                        title="Edit"
                        onClick={() => openEdit(account)}
                        className="p-1 rounded text-slate-400 hover:text-cyan-300 transition"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        title="Delete"
                        onClick={() => setDeletingId(account.id)}
                        className="p-1 rounded text-slate-400 hover:text-red-300 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 text-xs mb-3 min-w-0">
                    <Mail className="w-3 h-3 flex-shrink-0 text-slate-500" />
                    {account.accountEmail ? (
                      <span className="text-slate-300 truncate">{account.accountEmail}</span>
                    ) : (
                      <button
                        onClick={() => openEdit(account)}
                        className="italic text-slate-500 hover:text-cyan-300 transition"
                      >
                        Add account
                      </button>
                    )}
                  </div>

                  <div className="flex items-end justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Balance</p>
                      <p className={`text-2xl font-extrabold tracking-tight leading-none ${isLow ? 'text-red-300' : 'text-white'}`}>
                        {formatUsd(account.remainingUsd)}
                      </p>
                    </div>
                    {totalCredit > 0 && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                          isLow ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/15 text-emerald-300'
                        }`}
                      >
                        {pctLeft.toFixed(0)}% left
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 mb-3">
                    <div className="flex-1 bg-slate-900/60 rounded-full h-1 overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${
                          isLow ? 'from-red-500 to-orange-500' : cfg.color
                        }`}
                        style={{ width: `${pctUsed}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 whitespace-nowrap">
                      of {formatUsd(totalCredit)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] py-1.5 px-3 rounded-lg bg-slate-900/40 border border-white/5 mb-2">
                    <div className="flex items-center space-x-1.5">
                      <TrendingDown className="w-3 h-3 text-slate-400" />
                      <span className="text-slate-400">Spent</span>
                      <span className="font-bold text-white">{formatUsd(account.spentUsd)}</span>
                    </div>
                    <div className="w-px h-3 bg-white/10" />
                    <div className="flex items-center space-x-1.5">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span className="text-slate-400">Synced</span>
                      <span className="font-bold text-white">{timeAgo(account.lastSyncedAt)}</span>
                    </div>
                  </div>

                  {account.lastError && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-200 text-[11px] rounded-lg px-2 py-1.5 mb-2">
                      <span className="font-semibold">Sync error: </span>
                      <span className="opacity-90">{account.lastError}</span>
                    </div>
                  )}

                  <div className="flex items-start space-x-1.5 text-xs mb-3 min-w-0">
                    <StickyNote className="w-3 h-3 flex-shrink-0 mt-0.5 text-amber-400/70" />
                    {account.notes ? (
                      <p className="text-slate-300 line-clamp-2 break-words leading-snug">{account.notes}</p>
                    ) : (
                      <button
                        onClick={() => openEdit(account)}
                        className="italic text-slate-500 hover:text-amber-300 transition"
                      >
                        Add notes
                      </button>
                    )}
                  </div>

                  <div className="mt-auto pt-2 border-t border-white/5">
                    {topupOpenId === account.id ? (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-slate-300">Add top-up</span>
                          <button
                            onClick={() => {
                              setTopupOpenId(null);
                              setTopupForm({ amount: '', note: '', date: '' });
                            }}
                            className="text-slate-400 hover:text-white"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Amount (USD)"
                          value={topupForm.amount}
                          onChange={(e) => setTopupForm((f) => ({ ...f, amount: e.target.value }))}
                          className="input-field w-full text-xs py-1.5"
                        />
                        <input
                          type="date"
                          value={topupForm.date}
                          onChange={(e) => setTopupForm((f) => ({ ...f, date: e.target.value }))}
                          className="input-field w-full text-xs py-1.5"
                        />
                        <input
                          type="text"
                          placeholder="Note (optional)"
                          value={topupForm.note}
                          onChange={(e) => setTopupForm((f) => ({ ...f, note: e.target.value }))}
                          className="input-field w-full text-xs py-1.5"
                        />
                        <button
                          onClick={() => handleAddTopup(account.id)}
                          disabled={busy === 'topup' || !topupForm.amount}
                          className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50 text-white text-xs font-medium py-1.5 rounded-lg"
                        >
                          {busy === 'topup' ? 'Adding…' : 'Add'}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setTopupOpenId(account.id)}
                        className="w-full inline-flex items-center justify-center space-x-1 text-[11px] font-semibold text-slate-400 hover:text-cyan-300 transition py-1.5 rounded"
                      >
                        <Plus className="w-3 h-3" />
                        <span>
                          Add top-up{account.topups?.length ? ` · ${account.topups.length}` : ''}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-morphism rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">
                {editingId ? 'Edit live credit account' : 'Add live credit account'}
              </h2>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-white"
                disabled={submitting}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Provider
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PROVIDERS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      disabled={!!editingId}
                      onClick={() => setForm((f) => ({ ...f, provider: p.value }))}
                      className={`px-2 py-2.5 rounded-lg border transition text-xs font-medium ${
                        form.provider === p.value
                          ? `bg-gradient-to-r ${p.color} text-white border-transparent`
                          : 'glass-morphism text-slate-300 border-white/10 hover:border-cyan-500/30'
                      } ${editingId ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                {!providerConfig(form.provider).autoSync && (
                  <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">
                    Live cost-sync isn't available for this provider — balance is
                    tracked manually via starting balance and top-ups.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Label
                </label>
                <SuggestInput
                  suggestions={suggestions.label}
                  type="text"
                  placeholder="e.g. Personal OpenAI, Work Claude"
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  className="input-field w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Account (email or username)
                </label>
                <SuggestInput
                  suggestions={suggestions.accountEmail}
                  type="text"
                  placeholder="e.g. user@example.com"
                  value={form.accountEmail}
                  onChange={(e) => setForm((f) => ({ ...f, accountEmail: e.target.value }))}
                  className="input-field w-full"
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {providerConfig(form.provider).mode === 'cost' ? 'Admin API key' : 'API key'}{' '}
                  {editingId ? (
                    <span className="text-slate-500 font-normal">(leave blank to keep)</span>
                  ) : !providerConfig(form.provider).autoSync ? (
                    <span className="text-slate-500 font-normal">(optional)</span>
                  ) : null}
                </label>
                <input
                  type="password"
                  placeholder={providerConfig(form.provider).keyHint}
                  value={form.adminKey}
                  onChange={(e) => setForm((f) => ({ ...f, adminKey: e.target.value }))}
                  className="input-field w-full font-mono text-sm"
                  autoComplete="off"
                />
                {providerConfig(form.provider).consoleUrl && (
                  <a
                    href={providerConfig(form.provider).consoleUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-cyan-400 hover:text-cyan-300 inline-flex items-center space-x-1 mt-1.5"
                  >
                    <span>
                      {providerConfig(form.provider).mode === 'cost'
                        ? 'Create an admin key'
                        : providerConfig(form.provider).autoSync
                        ? 'Create an API key'
                        : 'Open provider console'}
                    </span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Starting balance (USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="95.02"
                    value={form.startingBalance}
                    onChange={(e) => setForm((f) => ({ ...f, startingBalance: e.target.value }))}
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    As of date
                  </label>
                  <input
                    type="date"
                    value={form.startingBalanceDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, startingBalanceDate: e.target.value }))
                    }
                    className="input-field w-full"
                  />
                </div>
              </div>

              <p className="text-xs text-slate-500">
                {providerConfig(form.provider).mode === 'cost'
                  ? "Spend is fetched from the provider's cost report starting on this date. Pick the date you last checked the dashboard balance."
                  : providerConfig(form.provider).mode === 'balance'
                  ? 'Live balance is pulled directly from the provider. Starting balance is just used to compute the spent percentage shown on the card.'
                  : 'Use this date as the moment your starting balance was accurate. Add top-ups as you reload credit.'}
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Optional notes — owner, project, billing details, etc."
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="input-field w-full resize-y"
                />
              </div>

              {formError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-200 text-sm rounded-lg p-3">
                  {formError}
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="btn-secondary disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50 text-white font-semibold px-4 py-2.5 rounded-lg"
                >
                  {submitting ? 'Saving…' : editingId ? 'Save changes' : 'Add account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-morphism rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <h2 className="text-lg font-bold text-white">Delete this account?</h2>
            </div>
            <p className="text-sm text-slate-400 mb-6">
              This removes the stored admin key and balance history. The actual provider
              account is unaffected.
            </p>
            <div className="flex items-center justify-end space-x-2">
              <button onClick={() => setDeletingId(null)} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold px-4 py-2.5 rounded-lg"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AiCreditsPage;
