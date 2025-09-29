import Parse from '../config/parseConfig';

// Credential management service using Parse
export const credentialService = {
  // Create a new credential
  createCredential: async (credentialData) => {
    try {
      const Credential = Parse.Object.extend('Credential');
      const credential = new Credential();
      
      // Set credential properties
      credential.set('name', credentialData.name);
      credential.set('type', credentialData.type);
      
      if (credentialData.username) {
        credential.set('username', credentialData.username);
      }
      
      credential.set('password', credentialData.password);
      
      if (credentialData.url) {
        credential.set('url', credentialData.url);
      }
      
      credential.set('category', credentialData.category);
      credential.set('isEncrypted', true);
      
      if (credentialData.notes) {
        credential.set('notes', credentialData.notes);
      }
      
      if (credentialData.expiryDate) {
        credential.set('expiryDate', new Date(credentialData.expiryDate));
      }
      
      // Set created by current user
      const currentUser = Parse.User.current();
      if (currentUser) {
        credential.set('createdBy', currentUser);
      }
      
      // Set ACL to restrict access to only the creator
      const acl = new Parse.ACL(currentUser);
      credential.setACL(acl);
      
      // Save the credential
      const savedCredential = await credential.save();
      
      return {
        success: true,
        credential: {
          id: savedCredential.id,
          name: savedCredential.get('name'),
          type: savedCredential.get('type'),
          username: savedCredential.get('username'),
          password: savedCredential.get('password'),
          url: savedCredential.get('url'),
          category: savedCredential.get('category'),
          isEncrypted: savedCredential.get('isEncrypted'),
          notes: savedCredential.get('notes'),
          expiryDate: savedCredential.get('expiryDate'),
          createdAt: savedCredential.createdAt
        }
      };
    } catch (error) {
      console.error('Create credential error:', error);
      return { success: false, error: error.message };
    }
  },

  // Get all credentials for the current user
  getAllCredentials: async () => {
    try {
      const Credential = Parse.Object.extend('Credential');
      const query = new Parse.Query(Credential);
      
      // Include the createdBy user object
      query.include('createdBy');
      
      // Sort by creation date, newest first
      query.descending('createdAt');
      
      const results = await query.find();
      
      return {
        success: true,
        credentials: results.map(credential => ({
          id: credential.id,
          name: credential.get('name'),
          type: credential.get('type'),
          username: credential.get('username'),
          password: credential.get('password'),
          url: credential.get('url'),
          category: credential.get('category'),
          isEncrypted: credential.get('isEncrypted'),
          notes: credential.get('notes'),
          expiryDate: credential.get('expiryDate'),
          createdAt: credential.createdAt,
          createdBy: credential.get('createdBy') ? {
            id: credential.get('createdBy').id,
            username: credential.get('createdBy').get('username'),
            email: credential.get('createdBy').get('email'),
            firstName: credential.get('createdBy').get('firstName') || '',
            lastName: credential.get('createdBy').get('lastName') || '',
            fullname: credential.get('createdBy').get('fullname') || '',
            role: credential.get('createdBy').get('role') || 'employee',
            department: credential.get('createdBy').get('department') || ''
          } : null
        }))
      };
    } catch (error) {
      console.error('Get credentials error:', error);
      return { success: false, error: error.message };
    }
  },

  // Get credential by ID
  getCredentialById: async (credentialId) => {
    try {
      const Credential = Parse.Object.extend('Credential');
      const query = new Parse.Query(Credential);
      
      query.include('createdBy');
      
      const credential = await query.get(credentialId);
      
      return {
        success: true,
        credential: {
          id: credential.id,
          name: credential.get('name'),
          type: credential.get('type'),
          username: credential.get('username'),
          password: credential.get('password'),
          url: credential.get('url'),
          category: credential.get('category'),
          isEncrypted: credential.get('isEncrypted'),
          notes: credential.get('notes'),
          expiryDate: credential.get('expiryDate'),
          createdAt: credential.createdAt,
          createdBy: credential.get('createdBy') ? {
            id: credential.get('createdBy').id,
            username: credential.get('createdBy').get('username'),
            fullname: credential.get('createdBy').get('fullname') || '',
            role: credential.get('createdBy').get('role') || 'employee'
          } : null
        }
      };
    } catch (error) {
      console.error('Get credential error:', error);
      return { success: false, error: error.message };
    }
  },

  // Update credential
  updateCredential: async (credentialId, credentialData) => {
    try {
      const Credential = Parse.Object.extend('Credential');
      const query = new Parse.Query(Credential);
      const credential = await query.get(credentialId);
      
      // Update credential properties
      credential.set('name', credentialData.name);
      credential.set('type', credentialData.type);
      
      if (credentialData.username !== undefined) {
        credential.set('username', credentialData.username);
      }
      
      if (credentialData.password !== undefined) {
        credential.set('password', credentialData.password);
      }
      
      if (credentialData.url !== undefined) {
        credential.set('url', credentialData.url);
      }
      
      credential.set('category', credentialData.category);
      
      if (credentialData.notes !== undefined) {
        credential.set('notes', credentialData.notes);
      }
      
      if (credentialData.expiryDate !== undefined) {
        credential.set('expiryDate', credentialData.expiryDate ? new Date(credentialData.expiryDate) : null);
      }
      
      const savedCredential = await credential.save();
      
      return {
        success: true,
        credential: {
          id: savedCredential.id,
          name: savedCredential.get('name'),
          type: savedCredential.get('type'),
          username: savedCredential.get('username'),
          password: savedCredential.get('password'),
          url: savedCredential.get('url'),
          category: savedCredential.get('category'),
          isEncrypted: savedCredential.get('isEncrypted'),
          notes: savedCredential.get('notes'),
          expiryDate: savedCredential.get('expiryDate'),
          createdAt: savedCredential.createdAt,
          updatedAt: savedCredential.updatedAt
        }
      };
    } catch (error) {
      console.error('Update credential error:', error);
      return { success: false, error: error.message };
    }
  },

  // Delete credential
  deleteCredential: async (credentialId) => {
    try {
      const Credential = Parse.Object.extend('Credential');
      const query = new Parse.Query(Credential);
      const credential = await query.get(credentialId);
      
      await credential.destroy();
      
      return { success: true };
    } catch (error) {
      console.error('Delete credential error:', error);
      return { success: false, error: error.message };
    }
  },

  // Search credentials
  searchCredentials: async (searchTerm) => {
    try {
      const Credential = Parse.Object.extend('Credential');
      
      // Create multiple queries for different fields
      const nameQuery = new Parse.Query(Credential);
      nameQuery.matches('name', searchTerm, 'i');
      
      const usernameQuery = new Parse.Query(Credential);
      usernameQuery.matches('username', searchTerm, 'i');
      
      const categoryQuery = new Parse.Query(Credential);
      categoryQuery.matches('category', searchTerm, 'i');
      
      // Combine queries with OR
      const query = Parse.Query.or(nameQuery, usernameQuery, categoryQuery);
      
      query.include('createdBy');
      query.descending('createdAt');
      
      const results = await query.find();
      
      return {
        success: true,
        credentials: results.map(credential => ({
          id: credential.id,
          name: credential.get('name'),
          type: credential.get('type'),
          username: credential.get('username'),
          password: credential.get('password'),
          url: credential.get('url'),
          category: credential.get('category'),
          isEncrypted: credential.get('isEncrypted'),
          notes: credential.get('notes'),
          expiryDate: credential.get('expiryDate'),
          createdAt: credential.createdAt,
          createdBy: credential.get('createdBy') ? {
            id: credential.get('createdBy').id,
            username: credential.get('createdBy').get('username'),
            fullname: credential.get('createdBy').get('fullname') || ''
          } : null
        }))
      };
    } catch (error) {
      console.error('Search credentials error:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Get credentials by type
  getCredentialsByType: async (type) => {
    try {
      const Credential = Parse.Object.extend('Credential');
      const query = new Parse.Query(Credential);
      
      query.equalTo('type', type);
      query.include('createdBy');
      query.descending('createdAt');
      
      const results = await query.find();
      
      return {
        success: true,
        credentials: results.map(credential => ({
          id: credential.id,
          name: credential.get('name'),
          type: credential.get('type'),
          username: credential.get('username'),
          password: credential.get('password'),
          url: credential.get('url'),
          category: credential.get('category'),
          isEncrypted: credential.get('isEncrypted'),
          notes: credential.get('notes'),
          expiryDate: credential.get('expiryDate'),
          createdAt: credential.createdAt,
          createdBy: credential.get('createdBy') ? {
            id: credential.get('createdBy').id,
            username: credential.get('createdBy').get('username'),
            fullname: credential.get('createdBy').get('fullname') || ''
          } : null
        }))
      };
    } catch (error) {
      console.error('Get credentials by type error:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Get credentials by category
  getCredentialsByCategory: async (category) => {
    try {
      const Credential = Parse.Object.extend('Credential');
      const query = new Parse.Query(Credential);
      
      query.equalTo('category', category);
      query.include('createdBy');
      query.descending('createdAt');
      
      const results = await query.find();
      
      return {
        success: true,
        credentials: results.map(credential => ({
          id: credential.id,
          name: credential.get('name'),
          type: credential.get('type'),
          username: credential.get('username'),
          password: credential.get('password'),
          url: credential.get('url'),
          category: credential.get('category'),
          isEncrypted: credential.get('isEncrypted'),
          notes: credential.get('notes'),
          expiryDate: credential.get('expiryDate'),
          createdAt: credential.createdAt,
          createdBy: credential.get('createdBy') ? {
            id: credential.get('createdBy').id,
            username: credential.get('createdBy').get('username'),
            fullname: credential.get('createdBy').get('fullname') || ''
          } : null
        }))
      };
    } catch (error) {
      console.error('Get credentials by category error:', error);
      return { success: false, error: error.message };
    }
  }
};

export default credentialService; 