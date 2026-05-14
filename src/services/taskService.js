import axios from 'axios';

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
});

export const taskService = {
  async list(projectId) {
    try {
      const res = await axios.get('/api/projects/tasks', {
        params: { projectId },
        headers: authHeaders(),
      });
      return { success: true, tasks: res.data.tasks || [] };
    } catch (e) {
      return { success: false, error: e.response?.data?.error || e.message, tasks: [] };
    }
  },

  async create(data) {
    try {
      const res = await axios.post('/api/projects/tasks', data, { headers: authHeaders() });
      return { success: true, task: res.data.task };
    } catch (e) {
      return { success: false, error: e.response?.data?.error || e.message };
    }
  },

  async update(taskId, data) {
    try {
      const res = await axios.put('/api/projects/tasks', { taskId, ...data }, { headers: authHeaders() });
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
      return { success: true, subtask: res.data.subtask };
    } catch (e) {
      return { success: false, error: e.response?.data?.error || e.message };
    }
  },

  async updateSubtask(subtaskId, data) {
    try {
      const res = await axios.put('/api/projects/subtasks', { subtaskId, ...data }, { headers: authHeaders() });
      return { success: true, subtask: res.data.subtask };
    } catch (e) {
      return { success: false, error: e.response?.data?.error || e.message };
    }
  },

  async removeSubtask(subtaskId) {
    try {
      await axios.delete('/api/projects/subtasks', { headers: authHeaders(), data: { subtaskId } });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.response?.data?.error || e.message };
    }
  },
};

export default taskService;
