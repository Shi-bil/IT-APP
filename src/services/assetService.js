import axios from 'axios';
import { readCache, writeCache, invalidatePrefix } from './_cache';

// Asset management service using HTTP API
export const assetService = {
  // Synchronously read the last-known asset list (used to paint instantly
  // before the network request resolves). Returns null on cache miss.
  peekAllAssets: () => readCache('assets:all'),
  peekUserAssets: () => readCache('assets:mine'),

  // Create a new asset
  createAsset: async (assetData) => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await axios.post('/api/assets', assetData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      invalidatePrefix('assets:');
      return { success: true, asset: res.data.asset };
    } catch (error) {
      console.error('Create asset error:', error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  // Get all assets
  getAllAssets: async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await axios.get('/api/assets', {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Normalize to prior shape - use id field from new MongoDB structure
      const assets = (res.data.assets || []).map(a => ({
        id: a.id || a._id, // Use id from new structure, fallback to _id
        name: a.name,
        categoryId: a.categoryId,
        serialNumber: a.serialNumber,
        status: a.status,
        quantity: a.quantity,
        remark: a.remark,
        assignee: a.assignee || 'N/A', // Use the resolved assignee name from API
        assigneeUserId: a.assigneeUserId, // Keep the ID for reference
        userName: a.userName, // Keep the manual userName
        // SIM-specific fields
        simType: a.simType || '',
        plan: a.plan || '',
        updatedAt: a.updatedAt,
        createdAt: a.createdAt,
      }));
      const result = { success: true, assets };
      writeCache('assets:all', result);
      return result;
    } catch (error) {
      console.error('Get assets error:', error);
      return { success: false, error: error.response?.data?.error || error.message, assets: [] };
    }
  },

  // Get assets assigned to the current user
  getUserAssets: async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await axios.get('/api/assets', {
        params: { mine: 'true' },
        headers: { Authorization: `Bearer ${token}` },
      });
      const assets = (res.data.assets || []).map(a => ({
        id: a.id || a._id, // Use id from new structure, fallback to _id
        name: a.name,
        categoryId: a.categoryId,
        serialNumber: a.serialNumber,
        status: a.status,
        quantity: a.quantity,
        remark: a.remark,
        assignee: a.assigneeUserId ? a.assigneeUserId : null,
        updatedAt: a.updatedAt,
        createdAt: a.createdAt,
      }));
      const result = { success: true, assets };
      writeCache('assets:mine', result);
      return result;
    } catch (error) {
      console.error('Get user assets error:', error);
      return { success: false, error: error.response?.data?.error || error.message, assets: [] };
    }
  },

  // Get asset by ID
  getAssetById: async (assetId) => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await axios.get('/api/assets/get', {
        params: { assetId },
        headers: { Authorization: `Bearer ${token}` },
      });
      const a = res.data.asset;
      return { 
        success: true, 
        asset: { 
          id: a.id || a._id, 
          name: a.name, 
          categoryId: a.categoryId, 
          serialNumber: a.serialNumber, 
          status: a.status, 
          quantity: a.quantity, 
          remark: a.remark,
          userName: a.userName || '',
          assignee: a.assignee || '',
          assigneeUserId: a.assigneeUserId || '',
          // SIM-specific fields
          simType: a.simType || '',
          plan: a.plan || '',
          createdAt: a.createdAt, 
          updatedAt: a.updatedAt 
        } 
      };
    } catch (error) {
      console.error('Get asset error:', error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  // Update asset
  updateAsset: async (assetId, assetData) => {
    try {
      const token = localStorage.getItem('auth_token');
      
      // Clean up data before sending - remove empty ObjectId fields and computed fields
      const cleanData = { ...assetData };
      delete cleanData.id; // Don't send id, we use assetId
      delete cleanData.assignee; // This is a computed field
      if (cleanData.assigneeUserId === '' || cleanData.assigneeUserId === undefined) {
        delete cleanData.assigneeUserId; // Don't send empty ObjectId
      }
      delete cleanData.createdAt; // Don't update timestamps
      delete cleanData.updatedAt;
      
      const res = await axios.put('/api/assets/update', { assetId, ...cleanData }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      invalidatePrefix('assets:');
      const a = res.data.asset;
      return { 
        success: true, 
        asset: { 
          id: a.id || a._id, 
          name: a.name, 
          categoryId: a.categoryId, 
          serialNumber: a.serialNumber, 
          status: a.status, 
          quantity: a.quantity, 
          remark: a.remark,
          userName: a.userName || '',
          assignee: a.assignee || '',
          assigneeUserId: a.assigneeUserId || '',
          // SIM-specific fields
          simType: a.simType || '',
          plan: a.plan || '',
          createdAt: a.createdAt, 
          updatedAt: a.updatedAt 
        } 
      };
    } catch (error) {
      console.error('Update asset error:', error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  // Assign asset to a user
  assignAsset: async (assetId, userId, handoverDate) => {
    try {
      const token = localStorage.getItem('auth_token');
      await axios.post('/api/assets/assign', { assetId, userId, handoverDate }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      invalidatePrefix('assets:');
      return { success: true };
    } catch (error) {
      console.error('Assign asset error:', error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  // Create asset history record
  createAssetHistoryRecord: async (assetId, userId, handoverDate, previousUserId = null) => {
    try {
      // History automatically written by backend on assign/update
      return { success: true };
    } catch (error) {
      console.error('Create asset history error:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Get asset history
  getAssetHistory: async (assetId) => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await axios.get('/api/assets/history', {
        params: { assetId },
        headers: { Authorization: `Bearer ${token}` },
      });
      return { success: true, history: res.data.history || [] };
    } catch (error) {
      console.error('Get asset history error:', error);
      return { success: false, error: error.response?.data?.error || error.message, history: [] };
    }
  },

  // Delete asset
  deleteAsset: async (assetId) => {
    try {
      const token = localStorage.getItem('auth_token');
      await axios.post('/api/assets/delete', { assetId }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      invalidatePrefix('assets:');
      return { success: true };
    } catch (error) {
      console.error('Delete asset error:', error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  // Get assets by category
  getAssetsByCategory: async (categoryId) => {
    try {
      const all = await assetService.getAllAssets();
      if (!all.success) return all;
      return { success: true, assets: all.assets.filter(a => a.categoryId === categoryId) };
    } catch (error) {
      console.error('Get assets by category error:', error);
      return { success: false, error: error.message };
    }
  },

  // Get assets by status
  getAssetsByStatus: async (status) => {
    try {
      const all = await assetService.getAllAssets();
      if (!all.success) return all;
      return { success: true, assets: all.assets.filter(a => a.status === status) };
    } catch (error) {
      console.error('Get assets by status error:', error);
      return { success: false, error: error.message };
    }
  },

  // Search assets
  searchAssets: async (searchTerm) => {
    try {
      const all = await assetService.getAllAssets();
      if (!all.success) return all;
      const regex = new RegExp(searchTerm, 'i');
      const filtered = all.assets.filter(a => regex.test(a.name || '') || regex.test(a.serialNumber || '') || regex.test(a.remark || ''));
      return { success: true, assets: filtered };
    } catch (error) {
      console.error('Search assets error:', error);
      return { success: false, error: error.message };
    }
  },

  // Create asset status log
  createAssetStatusLog: async (assetId, status, previousStatus, previousAssigneeId = null) => {
    try {
      // Status log handled in backend update route
      return { success: true };
    } catch (error) {
      console.error('Create asset status log error:', error);
      return { success: false, error: error.message };
    }
  },

  // Get assets assigned to a specific user (admin only)
  getAssetsForUserId: async (userId) => {
    try {
      const all = await assetService.getAllAssets();
      if (!all.success) return all;
      return { success: true, assets: all.assets.filter(a => String(a.assignee) === String(userId)) };
    } catch (error) {
      console.error('Get assets for userId error:', error);
      return { success: false, error: error.message };
    }
  },

  // Import multiple assets from Excel
  importAssets: async (assets, categoryId) => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await axios.post('/api/assets/bulk-import',
        { assets, categoryId },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      invalidatePrefix('assets:');
      return { success: true, results: res.data.results };
    } catch (error) {
      console.error('Import assets error:', error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  }
};

export default assetService; 