/**
 * Admin Tools for User Management
 * 
 * This file contains utility functions for managing users.
 * Run these functions in your browser console when logged in as an admin.
 */

/**
 * Manually verify a user's email
 * @param {string} email - The email address of the user to verify
 * @returns {Promise<Object>} - The result of the verification
 */
async function manuallyVerifyEmail(email) {
  try {
    if (!email || typeof email !== 'string') {
      throw new Error('Valid email address required');
    }
    
    // Assuming Parse is already initialized in your app
    const result = await Parse.Cloud.run('manuallyVerifyEmail', { email });
    console.log('Verification result:', result);
    return result;
  } catch (error) {
    console.error('Error verifying email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Manually send a verification code to a user
 * @param {string} email - The email address of the user
 * @returns {Promise<Object>} - The result of the operation
 */
async function sendVerificationCode(email) {
  try {
    if (!email || typeof email !== 'string') {
      throw new Error('Valid email address required');
    }
    
    // Assuming Parse is already initialized in your app
    const result = await Parse.Cloud.run('sendVerificationCode', { email });
    console.log('Verification code sent:', result);
    return result;
  } catch (error) {
    console.error('Error sending verification code:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create an admin user or update an existing user to have admin role
 * @param {string} username - The username for the admin
 * @param {string} password - The password for the admin
 * @param {string} [email] - Optional email for the admin
 * @param {string} [fullname] - Optional full name for the admin
 * @returns {Promise<Object>} - The result of the operation
 */
async function createAdminUser(username, password, email, fullname) {
  try {
    if (!username || !password) {
      throw new Error('Username and password are required');
    }
    
    // Assuming Parse is already initialized in your app
    const result = await Parse.Cloud.run('createAdminUser', { 
      username, 
      password, 
      email, 
      fullname 
    });
    console.log('Admin user creation result:', result);
    return result;
  } catch (error) {
    console.error('Error creating admin user:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Usage example:
 * 
 * 1. Open your application in the browser
 * 2. Open browser developer console
 * 3. Copy and paste this entire file into the console
 * 4. Call the function with the user's email:
 *    manuallyVerifyEmail('user@example.com').then(result => console.log(result))
 * 
 * To send a verification code:
 *    sendVerificationCode('user@example.com').then(result => console.log(result))
 * 
 * To create an admin user:
 *    createAdminUser('admin', 'admin123', 'admin@example.com', 'System Admin').then(result => console.log(result))
 */ 