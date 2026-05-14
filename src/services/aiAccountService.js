import axios from 'axios';

const authHeader = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
});

const TTL_MS = 30_000;
let _cache = null;
let _cachedAt = 0;

const invalidate = () => {
  _cache = null;
  _cachedAt = 0;
};

export const aiAccountService = {
  invalidateCache: invalidate,

  async getAll({ force = false, refresh = false } = {}) {
    const now = Date.now();
    if (!force && !refresh && _cache && now - _cachedAt < TTL_MS) {
      return _cache;
    }
    try {
      const url = refresh ? '/api/ai-accounts?refresh=1' : '/api/ai-accounts';
      const res = await axios.get(url, authHeader());
      const result = { success: true, accounts: res.data.accounts || [] };
      _cache = result;
      _cachedAt = now;
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
        accounts: [],
      };
    }
  },

  async create(payload) {
    try {
      const res = await axios.post('/api/ai-accounts', payload, authHeader());
      invalidate();
      return { success: true, account: res.data.account };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  async update(id, payload) {
    try {
      const res = await axios.put('/api/ai-accounts', { id, ...payload }, authHeader());
      invalidate();
      return { success: true, account: res.data.account };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  async refreshOne(id) {
    return this.update(id, { action: 'refresh' });
  },

  async addTopup(id, payload) {
    return this.update(id, { action: 'add-topup', ...payload });
  },

  async removeTopup(id, topupId) {
    return this.update(id, { action: 'remove-topup', topupId });
  },

  async remove(id) {
    try {
      await axios.delete('/api/ai-accounts', { data: { id }, ...authHeader() });
      invalidate();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },
};

export default aiAccountService;
