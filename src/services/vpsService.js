import axios from 'axios';

// Module-scoped SWR-style cache. Subsequent navigations to the VPS page (or any
// other consumer) within TTL_MS get an instant cache hit; mutations invalidate.
// Pass { force: true } to skip the cache (used by tab-focus refresh).
const TTL_MS = 30_000;
let _cache = null;
let _cachedAt = 0;

const invalidate = () => {
  _cache = null;
  _cachedAt = 0;
};

export const vpsService = {
  invalidateCache: invalidate,

  async getAllVps({ force = false } = {}) {
    const now = Date.now();
    if (!force && _cache && now - _cachedAt < TTL_MS) {
      return _cache;
    }
    try {
      const token = localStorage.getItem('auth_token');
      const res = await axios.get('/api/vps', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = { success: true, vps: res.data.vps || [] };
      _cache = result;
      _cachedAt = now;
      return result;
    } catch (error) {
      return { success: false, error: error.response?.data?.error || error.message, vps: [] };
    }
  },

  async createVps(payload) {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await axios.post('/api/vps', payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      invalidate();
      return { success: true, vps: res.data.vps };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  async updateVps(id, payload) {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await axios.put('/api/vps', { id, ...payload }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      invalidate();
      return { success: true, vps: res.data.vps };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  async addPayment(id, payload) {
    return this.updateVps(id, { action: 'add-payment', ...payload });
  },

  async editPayment(id, paymentId, payload) {
    return this.updateVps(id, { action: 'edit-payment', paymentId, ...payload });
  },

  async markAsPaid(id, payload) {
    return this.updateVps(id, { action: 'mark-paid', ...payload });
  },

  async markPaidThrough(id, payload) {
    return this.updateVps(id, { action: 'mark-paid-through', ...payload });
  },

  async unmarkPaid(id, payload) {
    return this.updateVps(id, { action: 'unmark-paid', ...payload });
  },

  async deleteVps(id) {
    try {
      const token = localStorage.getItem('auth_token');
      await axios.delete('/api/vps', {
        data: { id },
        headers: { Authorization: `Bearer ${token}` },
      });
      invalidate();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },
};

export default vpsService;
