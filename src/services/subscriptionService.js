import axios from 'axios';

const TTL_MS = 30_000;
let _cache = null;
let _cachedAt = 0;

const invalidate = () => {
  _cache = null;
  _cachedAt = 0;
};

export const subscriptionService = {
  invalidateCache: invalidate,

  async getAllSubscriptions({ force = false } = {}) {
    const now = Date.now();
    if (!force && _cache && now - _cachedAt < TTL_MS) {
      return _cache;
    }
    try {
      const token = localStorage.getItem('auth_token');
      const res = await axios.get('/api/subscriptions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = { success: true, subscriptions: res.data.subscriptions || [] };
      _cache = result;
      _cachedAt = now;
      return result;
    } catch (error) {
      return { success: false, error: error.response?.data?.error || error.message, subscriptions: [] };
    }
  },

  async createSubscription(payload) {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await axios.post('/api/subscriptions', payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      invalidate();
      return { success: true, subscription: res.data.subscription };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  async updateSubscription(id, payload) {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await axios.put('/api/subscriptions', { id, ...payload }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      invalidate();
      return { success: true, subscription: res.data.subscription };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  async addPayment(id, payload) {
    return this.updateSubscription(id, { action: 'add-payment', ...payload });
  },

  async editPayment(id, paymentId, payload) {
    return this.updateSubscription(id, { action: 'edit-payment', paymentId, ...payload });
  },

  async markAsPaid(id, payload) {
    return this.updateSubscription(id, { action: 'mark-paid', ...payload });
  },

  async unmarkPaid(id, payload) {
    return this.updateSubscription(id, { action: 'unmark-paid', ...payload });
  },

  async markPaidThrough(id, payload) {
    return this.updateSubscription(id, { action: 'mark-paid-through', ...payload });
  },

  async deleteSubscription(id) {
    try {
      const token = localStorage.getItem('auth_token');
      await axios.delete('/api/subscriptions', {
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

export default subscriptionService;
