import axios from 'axios';
import { readCache, writeCache, invalidatePrefix } from './_cache';

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
});

export const projectService = {
  peekList: () => readCache('projects:list'),

  async list({ mine = false } = {}) {
    try {
      const res = await axios.get('/api/projects', {
        params: mine ? { mine: 'true' } : {},
        headers: authHeaders(),
      });
      const result = { success: true, projects: res.data.projects || [] };
      writeCache('projects:list', result);
      return result;
    } catch (e) {
      return { success: false, error: e.response?.data?.error || e.message, projects: [] };
    }
  },

  async get(projectId) {
    try {
      const res = await axios.get('/api/projects/get', {
        params: { projectId },
        headers: authHeaders(),
      });
      return { success: true, project: res.data.project };
    } catch (e) {
      return { success: false, error: e.response?.data?.error || e.message };
    }
  },

  async create(data) {
    try {
      const res = await axios.post('/api/projects', data, { headers: authHeaders() });
      invalidatePrefix('projects:');
      invalidatePrefix('tasks:stats');
      return { success: true, project: res.data.project };
    } catch (e) {
      return { success: false, error: e.response?.data?.error || e.message };
    }
  },

  async update(projectId, data) {
    try {
      const res = await axios.put('/api/projects/update', { projectId, ...data }, { headers: authHeaders() });
      invalidatePrefix('projects:');
      return { success: true, project: res.data.project };
    } catch (e) {
      return { success: false, error: e.response?.data?.error || e.message };
    }
  },

  async remove(projectId) {
    try {
      await axios.post('/api/projects/delete', { projectId }, { headers: authHeaders() });
      invalidatePrefix('projects:');
      invalidatePrefix('tasks:');
      return { success: true };
    } catch (e) {
      return { success: false, error: e.response?.data?.error || e.message };
    }
  },
};

export default projectService;
