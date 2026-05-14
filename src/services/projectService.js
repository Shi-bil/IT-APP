import axios from 'axios';

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
});

export const projectService = {
  async list({ mine = false } = {}) {
    try {
      const res = await axios.get('/api/projects', {
        params: mine ? { mine: 'true' } : {},
        headers: authHeaders(),
      });
      return { success: true, projects: res.data.projects || [] };
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
      return { success: true, project: res.data.project };
    } catch (e) {
      return { success: false, error: e.response?.data?.error || e.message };
    }
  },

  async update(projectId, data) {
    try {
      const res = await axios.put('/api/projects/update', { projectId, ...data }, { headers: authHeaders() });
      return { success: true, project: res.data.project };
    } catch (e) {
      return { success: false, error: e.response?.data?.error || e.message };
    }
  },

  async remove(projectId) {
    try {
      await axios.post('/api/projects/delete', { projectId }, { headers: authHeaders() });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.response?.data?.error || e.message };
    }
  },
};

export default projectService;
