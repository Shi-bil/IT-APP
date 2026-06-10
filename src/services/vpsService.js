import axios from 'axios';
import { readCache, writeCache, invalidatePrefix } from './_cache';

const CACHE_KEY = 'vps:all';

const invalidate = () => invalidatePrefix('vps:');

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
});

export const vpsService = {
  invalidateCache: invalidate,
  peekAllVps: () => readCache(CACHE_KEY),

  async getAllVps({ force = false } = {}) {
    if (!force) {
      const cached = readCache(CACHE_KEY);
      if (cached) return cached;
    }
    try {
      const res = await axios.get('/api/vps', { headers: authHeaders() });
      const result = { success: true, vps: res.data.vps || [] };
      writeCache(CACHE_KEY, result);
      return result;
    } catch (error) {
      return { success: false, error: error.response?.data?.error || error.message, vps: [] };
    }
  },

  async createVps(payload) {
    const attempt = () => axios.post('/api/vps', payload, { headers: authHeaders(), timeout: 15000 });
    try {
      let res;
      try {
        res = await attempt();
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        res = await attempt();
      }
      invalidate();
      return { success: true, vps: res.data.vps };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  async updateVps(id, payload) {
    const attempt = () => axios.put('/api/vps', { id, ...payload }, { headers: authHeaders(), timeout: 15000 });
    try {
      let res;
      try {
        res = await attempt();
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        res = await attempt();
      }
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
      await axios.delete('/api/vps', {
        data: { id },
        headers: authHeaders(),
      });
      invalidate();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },
};

export default vpsService;
