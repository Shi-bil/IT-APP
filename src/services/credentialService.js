import axios from 'axios';
import { readCache, writeCache, invalidatePrefix } from './_cache';

// Credential management service using HTTP API
export const credentialService = {
  peekAllCredentials: () => readCache('credentials:all'),

  // Create a new credential
  createCredential: async (credentialData) => {
    try {
      console.log('credentialService: Sending credential data:', credentialData);
      const token = localStorage.getItem('auth_token');
      const res = await axios.post('/api/credentials', credentialData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });
      console.log('credentialService: Response received:', res.data);
      invalidatePrefix('credentials:');
      return { success: true, credential: res.data.credential };
    } catch (error) {
      console.error('Create credential error:', error);
      console.error('Error response:', error.response);
      console.error('Error response data:', error.response?.data);
      console.error('Error status:', error.response?.status);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  // Get all credentials for the current user
  getAllCredentials: async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await axios.get('/api/credentials', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = { success: true, credentials: res.data.credentials || [] };
      writeCache('credentials:all', result);
      return result;
    } catch (error) {
      console.error('Get credentials error:', error);
      return { success: false, error: error.response?.data?.error || error.message, credentials: [] };
    }
  },

  // Get credential by ID
  getCredentialById: async (credentialId) => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await axios.get('/api/credentials/get', {
        params: { id: credentialId },
        headers: { Authorization: `Bearer ${token}` },
      });
      return { success: true, credential: res.data.credential };
    } catch (error) {
      console.error('Get credential error:', error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  // Update credential
  updateCredential: async (credentialId, credentialData) => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await axios.put('/api/credentials/update', { id: credentialId, ...credentialData }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      invalidatePrefix('credentials:');
      return { success: true, credential: res.data.credential };
    } catch (error) {
      console.error('Update credential error:', error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  // Delete credential
  deleteCredential: async (credentialId) => {
    try {
      const token = localStorage.getItem('auth_token');
      await axios.post('/api/credentials/delete', { id: credentialId }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      invalidatePrefix('credentials:');
      return { success: true };
    } catch (error) {
      console.error('Delete credential error:', error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  // Search credentials
  searchCredentials: async (searchTerm) => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await axios.get('/api/credentials', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const regex = new RegExp(searchTerm, 'i');
      const filtered = (res.data.credentials || []).filter(c =>
        regex.test(c.name || '') || regex.test(c.username || '') || regex.test(c.category || '')
      );
      return { success: true, credentials: filtered };
    } catch (error) {
      console.error('Search credentials error:', error);
      return { success: false, error: error.response?.data?.error || error.message, credentials: [] };
    }
  },
  
  // Get credentials by type
  getCredentialsByType: async (type) => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await axios.get('/api/credentials', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const filtered = (res.data.credentials || []).filter(c => (c.type || '') === type);
      return { success: true, credentials: filtered };
    } catch (error) {
      console.error('Get credentials by type error:', error);
      return { success: false, error: error.response?.data?.error || error.message, credentials: [] };
    }
  },
  
  // Get credentials by category
  getCredentialsByCategory: async (category) => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await axios.get('/api/credentials', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const filtered = (res.data.credentials || []).filter(c => (c.category || '') === category);
      return { success: true, credentials: filtered };
    } catch (error) {
      console.error('Get credentials by category error:', error);
      return { success: false, error: error.response?.data?.error || error.message, credentials: [] };
    }
  }
};

export default credentialService; 