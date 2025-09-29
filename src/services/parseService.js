import Parse from '../config/parseConfig';

// User authentication service using Parse
export const parseService = {
  // Login with username and password
  login: async (username, password) => {
    try {
      const user = await Parse.User.logIn(username, password);
      
      // Check if user has admin role
      const userRole = user.get('role') || 'employee';
      if (userRole !== 'admin') {
        // Auto-logout if not admin
        await Parse.User.logOut();
        return { 
          success: false, 
          error: 'Access denied. This login is for administrators only.' 
        };
      }
      
      // Log successful admin login
      console.log('Admin login successful:', user.get('username'));
      
      return {
        success: true,
        user: {
          id: user.id,
          username: user.get('username'),
          email: user.get('email'),
          fullname: user.get('fullname') || 'System Administrator',
          role: userRole,
          isActive: true,
          department: user.get('department') || 'IT',
          emailVerified: user.get('emailVerified') || false
        }
      };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Login with email (for employees)
  loginWithEmail: async (email, password) => {
    try {
      // Find user by email using cloud function (which uses master key on server)
      const result = await Parse.Cloud.run('findUserByEmail', { email });
      const username = result.username;
      
      if (!username) {
        throw new Error('User not found');
      }
      
      // Then login with username and password
      const loggedInUser = await Parse.User.logIn(username, password);
      
      // Check if email is verified
      if (!loggedInUser.get('emailVerified')) {
        // Auto-logout if email not verified
        await Parse.User.logOut();
        throw new Error('Please verify your email before logging in. Check your inbox for a verification code.');
      }
      
      // Log successful login
      console.log('Employee login successful:', loggedInUser.get('email'));
      
      return {
        success: true,
        user: {
          id: loggedInUser.id,
          username: loggedInUser.get('username'),
          email: loggedInUser.get('email'),
          fullname: loggedInUser.get('fullname') || 'Employee User',
          role: loggedInUser.get('role') || 'employee',
          isActive: true,
          department: loggedInUser.get('department') || ''
        }
      };
    } catch (error) {
      console.error('Employee login error:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Register new user
  register: async (userData) => {
    try {
      const user = new Parse.User();
      user.set('username', userData.email);
      user.set('password', userData.password);
      user.set('email', userData.email);
      
      // Set fullname
      if (userData.fullname) {
        user.set('fullname', userData.fullname);
      }
      
      if (userData.department) {
        user.set('department', userData.department);
      }
      
      // Set phone if provided
      if (userData.phone) {
        user.set('phone', userData.phone);
      }
      
      // By default, new users are employees
      user.set('role', 'employee');
      
      await user.signUp();
      
      // Request email verification with code
      try {
        const verifyResult = await Parse.Cloud.run('sendVerificationCode', { email: userData.email });
        return { 
          success: true, 
          message: verifyResult.message || 'Registration successful. Please check your email for the verification code.'
        };
      } catch (verifyError) {
        console.error('Verification code error:', verifyError);
        // Still return success since user was created
        return { 
          success: true, 
          message: 'Registration successful, but there was an issue sending the verification code. Please try again or contact support.'
        };
      }
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Log out current user
  logout: async () => {
    try {
      await Parse.User.logOut();
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Get current user
  getCurrentUser: () => {
    const user = Parse.User.current();
    if (!user) return null;
    
    return {
      id: user.id,
      username: user.get('username'),
      email: user.get('email'),
      fullname: user.get('fullname') || 'User',
      role: user.get('role') || 'employee',
      isActive: true,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      department: user.get('department') || '',
      phone: user.get('phone') || '',
      emailVerified: user.get('emailVerified') || false
    };
  },
  
  // Reset password
  requestPasswordReset: async (email) => {
    try {
      await Parse.User.requestPasswordReset(email);
      return { success: true };
    } catch (error) {
      console.error('Password reset request error:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Resend verification email
  resendVerificationEmail: async (email) => {
    try {
      await Parse.Cloud.run('sendVerificationEmail', { email });
      return { success: true, message: 'Verification email sent successfully' };
    } catch (error) {
      console.error('Resend verification email error:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Send verification code
  sendVerificationCode: async (email) => {
    try {
      const result = await Parse.Cloud.run('sendVerificationCode', { email });
      return { 
        success: true, 
        message: result.message || 'Verification code sent successfully' 
      };
    } catch (error) {
      console.error('Send verification code error:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Verify email with code
  verifyEmailWithCode: async (email, code) => {
    try {
      const result = await Parse.Cloud.run('verifyEmailWithCode', { email, code });
      return { 
        success: true, 
        message: result.message || 'Email verified successfully' 
      };
    } catch (error) {
      console.error('Verify email with code error:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Update current user profile
  updateCurrentUserProfile: async (profileData) => {
    try {
      const user = Parse.User.current();
      if (!user) throw new Error('No user logged in');
      if (profileData.fullname !== undefined) user.set('fullname', profileData.fullname);
      if (profileData.department !== undefined) user.set('department', profileData.department);
      if (profileData.phone !== undefined) user.set('phone', profileData.phone);
      if (profileData.email !== undefined) user.set('email', profileData.email);
      // Add more fields as needed
      await user.save();
      return { success: true };
    } catch (error) {
      console.error('Update user profile error:', error);
      return { success: false, error: error.message };
    }
  },

  // Validate current password
  validateCurrentPassword: async (currentPassword) => {
    try {
      const result = await Parse.Cloud.run('validateCurrentPassword', { currentPassword });
      return { success: true, message: result.message };
    } catch (error) {
      console.error('Validate current password error:', error);
      return { success: false, error: error.message };
    }
  },

  // Change password
  changePassword: async (currentPassword, newPassword) => {
    try {
      const result = await Parse.Cloud.run('validateAndChangePassword', { currentPassword, newPassword });
      return { success: true, message: result.message };
    } catch (error) {
      console.error('Change password error:', error);
      return { success: false, error: error.message };
    }
  }
};

export default parseService; 