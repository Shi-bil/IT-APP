import axios from 'axios';
import { readCache, writeCache, invalidatePrefix } from './_cache';

export const userService = {
  peekDirectory: () => readCache('users:directory'),
  peekAllUsers: () => readCache('users:all'),

  // Get all users (admin)
  getAllUsers: async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await axios.get('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = { success: true, users: res.data.users };
      writeCache('users:all', result);
      return result;
    } catch (error) {
      console.error('Get users error:', error);
      return { success: false, error: error.message };
    }
  },
  // Lightweight directory for member/assignee pickers. Any authenticated user.
  getDirectory: async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await axios.get('/api/users/directory', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = { success: true, users: res.data.users };
      writeCache('users:directory', result);
      return result;
    } catch (error) {
      console.error('Get directory error:', error);
      return { success: false, error: error.message };
    }
  },
  // Create a new user (admin)
  createUser: async (userData) => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await axios.post('/api/admin/users', userData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      invalidatePrefix('users:');
      return { success: true, user: res.data.user };
    } catch (error) {
      console.error('Create user error:', error);
      return { success: false, error: error.message };
    }
  },
  // Update a user (admin)
  updateUser: async (userData) => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await axios.put('/api/admin/users', userData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      invalidatePrefix('users:');
      return { success: true, user: res.data.user };
    } catch (error) {
      console.error('Update user error:', error);
      return { success: false, error: error.message };
    }
  },
  // Delete a user (admin)
  deleteUser: async (id) => {
    try {
      if (!id) {
        console.error('Delete user called with no ID');
        return { success: false, error: 'User ID is required' };
      }
      const token = localStorage.getItem('auth_token');
      // Ensure ID is a string
      const userId = String(id);
      console.log('Deleting user with id:', userId, 'type:', typeof userId);
      const response = await axios.delete('/api/admin/users', {
        data: { id: userId },
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });
      console.log('Delete response:', response.data);
      invalidatePrefix('users:');
      return { success: true };
    } catch (error) {
      console.error('Delete user error:', error.response?.data || error.message);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },
  // Send verification email to user
  sendVerificationEmail: async (email) => {
    try {
      await axios.post('/api/send-code', { email });
      return { success: true };
    } catch (error) {
      console.error('Send verification email error:', error);
      return { success: false, error: error.message };
    }
  },
}; 