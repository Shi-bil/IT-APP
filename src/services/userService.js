import Parse from '../config/parseConfig';

export const userService = {
  // Get all users by calling a cloud function
  getAllUsers: async () => {
    try {
      const users = await Parse.Cloud.run('getAllUsersForAdmin');
      return {
        success: true,
        users: users,
      };
    } catch (error) {
      console.error('Get users error:', error);
      return { success: false, error: error.message };
    }
  },
  // Create a new user (admin only)
  createUser: async (userData) => {
    try {
      const result = await Parse.Cloud.run('adminCreateUser', userData);
      return { success: true, user: result };
    } catch (error) {
      console.error('Create user error:', error);
      return { success: false, error: error.message };
    }
  },
  // Update a user (admin only)
  updateUser: async (userData) => {
    try {
      const result = await Parse.Cloud.run('adminUpdateUser', userData);
      return { success: true, user: result };
    } catch (error) {
      console.error('Update user error:', error);
      return { success: false, error: error.message };
    }
  },
  // Delete a user (admin only)
  deleteUser: async (id) => {
    try {
      await Parse.Cloud.run('adminDeleteUser', { id });
      return { success: true };
    } catch (error) {
      console.error('Delete user error:', error);
      return { success: false, error: error.message };
    }
  },
  // Send verification email to user
  sendVerificationEmail: async (email) => {
    try {
      await Parse.Cloud.run('sendVerificationEmail', { email });
      return { success: true };
    } catch (error) {
      console.error('Send verification email error:', error);
      return { success: false, error: error.message };
    }
  },
}; 