import axios from 'axios';

const TTL_MS = 30_000;
let _cache = null;
let _cachedAt = 0;

const invalidate = () => {
  _cache = null;
  _cachedAt = 0;
};

export const objectStorageService = {
  invalidateCache: invalidate,

  async getAll({ force = false } = {}) {
    const now = Date.now();
    if (!force && _cache && now - _cachedAt < TTL_MS) {
      return _cache;
    }
    try {
      const token = localStorage.getItem('auth_token');
      const res = await axios.get('/api/object-storage', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = { success: true, items: res.data.items || [] };
      _cache = result;
      _cachedAt = now;
      return result;
    } catch (error) {
      return { success: false, error: error.response?.data?.error || error.message, items: [] };
    }
  },

  async create(payload) {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await axios.post('/api/object-storage', payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      invalidate();
      return { success: true, item: res.data.item };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  async update(id, payload) {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await axios.put('/api/object-storage', { id, ...payload }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      invalidate();
      return { success: true, item: res.data.item };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  async addPayment(id, payload) {
    return this.update(id, { action: 'add-payment', ...payload });
  },

  async editPayment(id, paymentId, payload) {
    return this.update(id, { action: 'edit-payment', paymentId, ...payload });
  },

  async markAsPaid(id, payload) {
    return this.update(id, { action: 'mark-paid', ...payload });
  },

  async markPaidThrough(id, payload) {
    return this.update(id, { action: 'mark-paid-through', ...payload });
  },

  async unmarkPaid(id, payload) {
    return this.update(id, { action: 'unmark-paid', ...payload });
  },

  async delete(id) {
    try {
      const token = localStorage.getItem('auth_token');
      await axios.delete('/api/object-storage', {
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

export default objectStorageService;
