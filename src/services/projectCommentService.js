import axios from 'axios';

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
});

export const projectCommentService = {
  async list({ projectId, taskId } = {}) {
    try {
      const params = {};
      if (projectId) params.projectId = projectId;
      if (taskId) params.taskId = taskId;
      const res = await axios.get('/api/projects/comments', { params, headers: authHeaders() });
      return { success: true, comments: res.data.comments || [] };
    } catch (e) {
      return { success: false, error: e.response?.data?.error || e.message, comments: [] };
    }
  },

  async create(data) {
    try {
      const res = await axios.post('/api/projects/comments', data, { headers: authHeaders() });
      return { success: true, comment: res.data.comment };
    } catch (e) {
      return { success: false, error: e.response?.data?.error || e.message };
    }
  },

  async update(commentId, text, mentions) {
    try {
      const res = await axios.put(
        '/api/projects/comments',
        { commentId, text, mentions },
        { headers: authHeaders() }
      );
      return { success: true, comment: res.data.comment };
    } catch (e) {
      return { success: false, error: e.response?.data?.error || e.message };
    }
  },

  async remove(commentId) {
    try {
      await axios.delete('/api/projects/comments', { headers: authHeaders(), data: { commentId } });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.response?.data?.error || e.message };
    }
  },
};

export default projectCommentService;
