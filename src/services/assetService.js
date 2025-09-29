import Parse from '../config/parseConfig';

// Asset management service using Parse
export const assetService = {
  // Create a new asset
  createAsset: async (assetData) => {
    try {
      const Asset = Parse.Object.extend('Asset');
      const asset = new Asset();
      
      // Set basic asset properties
      asset.set('name', assetData.name);
      asset.set('categoryId', assetData.categoryId);
      asset.set('serialNumber', assetData.serialNumber);
      asset.set('status', assetData.status);
      asset.set('quantity', parseInt(assetData.quantity));
      asset.set('remark', assetData.remark);
      
      // Set created by current user
      const currentUser = Parse.User.current();
      if (currentUser) {
        asset.set('createdBy', currentUser);
      }
      
      // Save the asset
      const savedAsset = await asset.save();
      
      return {
        success: true,
        asset: {
          id: savedAsset.id,
          name: savedAsset.get('name'),
          categoryId: savedAsset.get('categoryId'),
          serialNumber: savedAsset.get('serialNumber'),
          status: savedAsset.get('status'),
          quantity: savedAsset.get('quantity'),
          remark: savedAsset.get('remark'),
          createdAt: savedAsset.createdAt,
          updatedAt: savedAsset.updatedAt
        }
      };
    } catch (error) {
      console.error('Create asset error:', error);
      return { success: false, error: error.message };
    }
  },

  // Get all assets
  getAllAssets: async () => {
    try {
      const assets = await Parse.Cloud.run('getAssetsForAdmin');
      return {
        success: true,
        assets: assets
      };
    } catch (error) {
      console.error('Get assets error:', error);
      return { success: false, error: error.message };
    }
  },

  // Get assets assigned to the current user
  getUserAssets: async () => {
    try {
      const assets = await Parse.Cloud.run('getAssetsForUser');
      return {
        success: true,
        assets: assets
      };
    } catch (error) {
      console.error('Get user assets error:', error);
      return { success: false, error: error.message };
    }
  },

  // Get asset by ID
  getAssetById: async (assetId) => {
    try {
      const Asset = Parse.Object.extend('Asset');
      const query = new Parse.Query(Asset);
      
      query.include('createdBy');
      
      const asset = await query.get(assetId);
      
      return {
        success: true,
        asset: {
          id: asset.id,
          name: asset.get('name'),
          categoryId: asset.get('categoryId'),
          serialNumber: asset.get('serialNumber'),
          status: asset.get('status'),
          quantity: asset.get('quantity'),
          remark: asset.get('remark'),
          createdAt: asset.createdAt,
          updatedAt: asset.updatedAt
        }
      };
    } catch (error) {
      console.error('Get asset error:', error);
      return { success: false, error: error.message };
    }
  },

  // Update asset
  updateAsset: async (assetId, assetData) => {
    try {
      const Asset = Parse.Object.extend('Asset');
      const query = new Parse.Query(Asset);
      query.include('assignee');
      const asset = await query.get(assetId);
      
      // Get current status and assignee before update
      const previousStatus = asset.get('status');
      const previousAssignee = asset.get('assignee');
      let previousAssigneeId = null;
      
      if (previousAssignee) {
        previousAssigneeId = previousAssignee.id;
      }
      
      // Update asset properties
      asset.set('name', assetData.name);
      asset.set('categoryId', assetData.categoryId);
      asset.set('serialNumber', assetData.serialNumber);
      asset.set('status', assetData.status);
      asset.set('quantity', parseInt(assetData.quantity));
      asset.set('remark', assetData.remark);
      
      // If status is changing to "free", remove the assignee
      if (assetData.status === 'free' && previousStatus !== 'free') {
        asset.unset('assignee');
        asset.unset('handedoverdate');
      }
      
      const savedAsset = await asset.save();
      
      // If status changed to "free", create a status log
      if (assetData.status === 'free' && previousStatus !== 'free') {
        await assetService.createAssetStatusLog(
          assetId, 
          assetData.status, 
          previousStatus, 
          previousAssigneeId
        );
      }
      
      return {
        success: true,
        asset: {
          id: savedAsset.id,
          name: savedAsset.get('name'),
          categoryId: savedAsset.get('categoryId'),
          serialNumber: savedAsset.get('serialNumber'),
          status: savedAsset.get('status'),
          quantity: savedAsset.get('quantity'),
          remark: savedAsset.get('remark'),
          createdAt: savedAsset.createdAt,
          updatedAt: savedAsset.updatedAt
        }
      };
    } catch (error) {
      console.error('Update asset error:', error);
      return { success: false, error: error.message };
    }
  },

  // Assign asset to a user
  assignAsset: async (assetId, userId, handoverDate) => {
    try {
      const Asset = Parse.Object.extend('Asset');
      const assetPointer = new Asset();
      assetPointer.id = assetId;

      // Always fetch the latest asset state from the database, including 'assignee'
      const query = new Parse.Query(Asset);
      query.include('assignee');
      const asset = await query.get(assetId);

      // Debug: print the fetched asset and assignee
      console.log('Fetched asset:', asset.toJSON());
      let currentAssignee = asset.get('assignee');
      if (currentAssignee && currentAssignee.fetch) {
        currentAssignee = await currentAssignee.fetch();
      }
      console.log('Current assignee before assignment:', currentAssignee ? currentAssignee.id : null);

      // The current assignee before assignment is the previous user
      let previousUserId = null;
      if (currentAssignee && currentAssignee.id !== userId) {
        previousUserId = currentAssignee.id;
      } else {
        // Fallback: look up the most recent assignment in AssetHistory
        const AssetHistory = Parse.Object.extend('AssetHistory');
        const historyQuery = new Parse.Query(AssetHistory);
        historyQuery.equalTo('asset', assetPointer);
        historyQuery.exists('assignedTo');
        historyQuery.notEqualTo('assignedTo', Parse.User.createWithoutData(userId));
        historyQuery.notEqualTo('statusChange', true);
        historyQuery.descending('createdAt');
        historyQuery.limit(1);
        historyQuery.include('assignedTo');
        const lastAssignment = await historyQuery.first();
        if (lastAssignment && lastAssignment.get('assignedTo')) {
          previousUserId = lastAssignment.get('assignedTo').id;
        }
      }

      // Set the new assignee on the Asset
      const userPointer = Parse.User.createWithoutData(userId);
      asset.set('assignee', userPointer);
      asset.set('handedoverdate', new Date(handoverDate));
      asset.set('status', 'using');
      await asset.save();

      // Create AssetHistory record (assignedTo = new user, previousUser = previous assignee)
      await assetService.createAssetHistoryRecord(assetId, userId, handoverDate, previousUserId);

      return { success: true };
    } catch (error) {
      console.error('Assign asset error:', error);
      return { success: false, error: error.message };
    }
  },

  // Create asset history record
  createAssetHistoryRecord: async (assetId, userId, handoverDate, previousUserId = null) => {
    try {
      const params = {
        assetId,
        userId,
        handoverDate,
        previousUserId
      };
      
      await Parse.Cloud.run('createAssetHistoryRecord', params);
      return { success: true };
    } catch (error) {
      console.error('Create asset history error:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Get asset history
  getAssetHistory: async (assetId) => {
    try {
      const history = await Parse.Cloud.run('getAssetHistory', { assetId });
      return { success: true, history };
    } catch (error) {
      console.error('Get asset history error:', error);
      return { success: false, error: error.message };
    }
  },

  // Delete asset
  deleteAsset: async (assetId) => {
    try {
      const Asset = Parse.Object.extend('Asset');
      const query = new Parse.Query(Asset);
      const asset = await query.get(assetId);
      
      await asset.destroy();
      
      return { success: true };
    } catch (error) {
      console.error('Delete asset error:', error);
      return { success: false, error: error.message };
    }
  },

  // Get assets by category
  getAssetsByCategory: async (categoryId) => {
    try {
      const Asset = Parse.Object.extend('Asset');
      const query = new Parse.Query(Asset);
      
      query.equalTo('categoryId', categoryId);
      query.include('createdBy');
      query.descending('createdAt');
      
      const results = await query.find();
      
      return {
        success: true,
        assets: results.map(asset => ({
          id: asset.id,
          name: asset.get('name'),
          categoryId: asset.get('categoryId'),
          serialNumber: asset.get('serialNumber'),
          status: asset.get('status'),
          quantity: asset.get('quantity'),
          remark: asset.get('remark'),
          createdAt: asset.createdAt,
          updatedAt: asset.updatedAt
        }))
      };
    } catch (error) {
      console.error('Get assets by category error:', error);
      return { success: false, error: error.message };
    }
  },

  // Get assets by status
  getAssetsByStatus: async (status) => {
    try {
      const Asset = Parse.Object.extend('Asset');
      const query = new Parse.Query(Asset);
      
      query.equalTo('status', status);
      query.include('createdBy');
      query.descending('createdAt');
      
      const results = await query.find();
      
      return {
        success: true,
        assets: results.map(asset => ({
          id: asset.id,
          name: asset.get('name'),
          categoryId: asset.get('categoryId'),
          serialNumber: asset.get('serialNumber'),
          status: asset.get('status'),
          quantity: asset.get('quantity'),
          remark: asset.get('remark'),
          createdAt: asset.createdAt,
          updatedAt: asset.updatedAt
        }))
      };
    } catch (error) {
      console.error('Get assets by status error:', error);
      return { success: false, error: error.message };
    }
  },

  // Search assets
  searchAssets: async (searchTerm) => {
    try {
      const Asset = Parse.Object.extend('Asset');
      const query = new Parse.Query(Asset);
      
      // Search in name, serial number, and remark
      query.matches('name', searchTerm, 'i');
      query.matches('serialNumber', searchTerm, 'i');
      query.matches('remark', searchTerm, 'i');
      
      query.include('createdBy');
      query.descending('createdAt');
      
      const results = await query.find();
      
      return {
        success: true,
        assets: results.map(asset => ({
          id: asset.id,
          name: asset.get('name'),
          categoryId: asset.get('categoryId'),
          serialNumber: asset.get('serialNumber'),
          status: asset.get('status'),
          quantity: asset.get('quantity'),
          remark: asset.get('remark'),
          createdAt: asset.createdAt,
          updatedAt: asset.updatedAt
        }))
      };
    } catch (error) {
      console.error('Search assets error:', error);
      return { success: false, error: error.message };
    }
  },

  // Create asset status log
  createAssetStatusLog: async (assetId, status, previousStatus, previousAssigneeId = null) => {
    try {
      const params = {
        assetId,
        status,
        previousStatus,
        previousAssigneeId
      };
      
      await Parse.Cloud.run('createAssetStatusLog', params);
      return { success: true };
    } catch (error) {
      console.error('Create asset status log error:', error);
      return { success: false, error: error.message };
    }
  },

  // Get assets assigned to a specific user (admin only)
  getAssetsForUserId: async (userId) => {
    try {
      const assets = await Parse.Cloud.run('getAssetsForUserId', { userId });
      return { success: true, assets };
    } catch (error) {
      console.error('Get assets for userId error:', error);
      return { success: false, error: error.message };
    }
  }
};

export default assetService; 