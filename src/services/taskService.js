import axios from 'axios';
import { readCache, writeCache, invalidatePrefix } from './_cache';

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
});

export const taskService = {
  peekList: (projectId) => readCache(`tasks:${projectId}`),
  peekStats: () => readCache('tasks:stats'),

  async list(projectId) {
    const key = `tasks:${projectId}`;
    try {
      const res = await axios.get('/api/projects/tasks', {
        params: { projectId },
        headers: authHeaders(),
      });
      const result = { success: true, tasks: res.data.tasks || [] };
      writeCache(key, result);
      return result;
    } catch (e) {
      return { success: false, error: e.response?.data?.error || e.message, tasks: [] };
    }
  },

  async getStats(projectIds) {
    if (!projectIds || !projectIds.length) return { success: true, stats: {} };
    try {
      const res = await axios.get('/api/projects/tasks', {
        params: { stats: 'true', projectIds: projectIds.join(',') },
        headers: authHeaders(),
      });
      const result = { success: true, stats: res.data.stats || {} };
      writeCache('tasks:stats', result);
      return result;
    } catch (e) {
      return { success: false, error: e.response?.data?.error || e.message, stats: {} };
    }
  },

  async create(data) {
    try {
      const res = await axios.post('/api/projects/tasks', data, { headers: authHeaders() });
      invalidatePrefix('tasks:');
      return { success: true, task: res.data.task };
    } catch (e) {
      return { success: false, error: e.response?.data?.error || e.message };
    }
  },

  async update(taskId, data) {
    try {
      const res = await axios.put('/api/projects/tasks', { taskId, ...data }, { headers: authHeaders() });
      invalidatePrefix('tasks:');
      return { success: true, task: res.data.task };
    } catch (e) {
      return { success: false, error: e.response?.data?.error || e.message };
    }
  },

  async remove(taskId) {
    try {
      await axios.delete('/api/projects/tasks', {
        headers: authHeaders(),
        data: { taskId },
      });
      invalidatePrefix('tasks:');
      return { success: true };
    } catch (e) {
      return { success: false, error: e.response?.data?.error || e.message };
    }
  },

  // Subtasks
  async listSubtasks(taskId) {
    try {
      const res = await axios.get('/api/projects/subtasks', {
        params: { taskId },
        headers: authHeaders(),
      });
      return { success: true, subtasks: res.data.subtasks || [] };
    } catch (e) {
      return { success: false, error: e.response?.data?.error || e.message, subtasks: [] };
    }
  },

  async createSubtask(data) {
    try {
      const res = await axios.post('/api/projects/subtasks', data, { headers: authHeaders() });
      invalidatePrefix('tasks:');
      return { success: true, subtask: res.data.subtask };
    } catch (e) {
      return { success: false, error: e.response?.data?.error || e.message };
    }
  },

  async updateSubtask(subtaskId, data) {
    try {
      const res = await axios.put('/api/projects/subtasks', { subtaskId, ...data }, { headers: authHeaders() });
      invalidatePrefix('tasks:');
      return { success: true, subtask: res.data.subtask };
    } catch (e) {
      return { success: false, error: e.response?.data?.error || e.message };
    }
  },

  async removeSubtask(subtaskId) {
    try {
      await axios.delete('/api/projects/subtasks', { headers: authHeaders(), data: { subtaskId } });
      invalidatePrefix('tasks:');
      return { success: true };
    } catch (e) {
      return { success: false, error: e.response?.data?.error || e.message };
    }
  },
};

export default taskService;
