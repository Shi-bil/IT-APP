/**
 * Back4App Cloud Functions for Email Verification
 * 
 * Copy and paste this code into your Back4App Cloud Code section.
 * 
 * IMPORTANT: Make sure email sending is properly configured in your Parse Server.
 * 
 * For Nodemailer configuration in Parse Server:
 * 
 * emailAdapter: {
 *   module: 'parse-server-simple-smtp-adapter',
 *   options: {
 *     host: 'smtp.example.com',
 *     port: 587,
 *     secure: false,
 *     auth: {
 *       user: 'your-email@example.com',
 *       pass: 'your-password'
 *     },
 *     tls: {
 *       rejectUnauthorized: false
 *     }
 *   }
 * }
 */

// Find user by email - safe way to query users by email from client
Parse.Cloud.define("findUserByEmail", async (request) => {
  const { email } = request.params;
  
  if (!email) {
    throw new Error("Email is required");
  }
  
  // Query user by email using master key
  const query = new Parse.Query(Parse.User);
  query.equalTo("email", email);
  const user = await query.first({ useMasterKey: true });
  
  if (!user) {
    throw new Error("User not found");
  }
  
  // Return only the username (for login purposes)
  return {
    username: user.get("username")
  };
});

// Send verification email with a link
Parse.Cloud.define("sendVerificationEmail", async (request) => {
  const { email } = request.params;
  
  if (!email) {
    throw new Error('Email is required');
  }
  
  try {
    // Find user by email
    const query = new Parse.Query(Parse.User);
    query.equalTo('email', email);
    const user = await query.first({ useMasterKey: true });
    
    if (!user) {
      throw new Error('User not found with this email address');
    }
    
    // Generate a verification token (random string)
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    // Store the token and expiration time in the user object
    user.set('emailVerificationToken', token);
    user.set('emailVerificationTokenExpiresAt', new Date(Date.now() + 24 * 60 * 60 * 1000)); // 24 hours from now
    await user.save(null, { useMasterKey: true });
    
    // Get the frontend URL from environment variable or use a default
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    
    // Create the verification link
    const verificationLink = `${frontendUrl}/verify-email?email=${encodeURIComponent(email)}&token=${token}`;
    
    // Send the email using Nodemailer (configured in your Parse Server)
    const mailSubject = 'Verify Your Email - IT PORTAL';
    const mailText = `Please verify your email by clicking the link below:\n\n${verificationLink}`;
    const mailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #1e293b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0;">Email Verification</h1>
        </div>
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0; border-top: none;">
          <p>Hello,</p>
          <p>Thank you for registering with our IT Asset Management System. Please verify your email address by clicking the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" style="background-color: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Verify Email Address</a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p style="background-color: #e2e8f0; padding: 10px; border-radius: 4px; word-break: break-all;">${verificationLink}</p>
          <p>This link will expire in 24 hours.</p>
          <p>If you did not create an account, please ignore this email.</p>
          <p>Best regards,<br>IT Asset Management Team</p>
        </div>
      </div>
    `;
    
    try {
      // Using Parse Server's email adapter (Nodemailer)
      await Parse.Cloud.sendEmail({
        from: process.env.EMAIL_FROM || 'noreply@itassetmanagement.com',
        to: email,
        subject: mailSubject,
        text: mailText,
        html: mailHtml
      });
      
      return { success: true, message: 'Verification email sent successfully' };
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      
      // Fallback - log the verification link for development
      console.log(`IMPORTANT - Verification link for ${email}: ${verificationLink}`);
      return { success: true, message: 'Verification email processing. Please check your inbox.' };
    }
    
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw new Error('Failed to send verification email: ' + error.message);
  }
});

// Verify email with token (called by your frontend)
Parse.Cloud.define("verifyEmailWithToken", async (request) => {
  const { email, token } = request.params;
  
  if (!email || !token) {
    throw new Error('Email and token are required');
  }
  
  try {
    // Find user by email
    const query = new Parse.Query(Parse.User);
    query.equalTo('email', email);
    const user = await query.first({ useMasterKey: true });
    
    if (!user) {
      throw new Error('User not found with this email address');
    }
    
    // Check if token matches and is not expired
    const storedToken = user.get('emailVerificationToken');
    const tokenExpiresAt = user.get('emailVerificationTokenExpiresAt');
    
    if (!storedToken || storedToken !== token) {
      throw new Error('Invalid verification token');
    }
    
    if (!tokenExpiresAt || new Date() > tokenExpiresAt) {
      throw new Error('Verification token has expired');
    }
    
    // Mark email as verified and set isActive to true
    user.set('emailVerified', true);
    user.set('isActive', true);
    user.set('emailVerificationToken', null);
    user.set('emailVerificationTokenExpiresAt', null);
    await user.save(null, { useMasterKey: true });
    
    return { success: true, message: 'Email verified successfully' };
  } catch (error) {
    console.error('Error verifying email:', error);
    throw new Error('Failed to verify email: ' + error.message);
  }
});

// Bulk update: Set isActive true for all users with emailVerified true
Parse.Cloud.define("syncActiveWithEmailVerified", async (request) => {
  const query = new Parse.Query(Parse.User);
  query.equalTo("emailVerified", true);
  query.notEqualTo("isActive", true);
  query.limit(1000);
  const users = await query.find({ useMasterKey: true });
  let updated = 0;
  for (const user of users) {
    user.set("isActive", true);
    await user.save(null, { useMasterKey: true });
    updated++;
  }
  return { updated };
});

// Cloud function to get all users for admin with all needed fields
Parse.Cloud.define("getAllUsersForAdmin", async (request) => {
  if (!request.user) throw new Error("You must be logged in.");
  if (request.user.get("role") !== "admin") throw new Error("Not authorized.");

  const query = new Parse.Query(Parse.User);
  query.ascending("fullname");
  query.limit(1000);

  const users = await query.find({ useMasterKey: true });
  return users.map(user => ({
    id: user.id,
    username: user.get("username"),
    email: user.get("email"),
    fullname: user.get("fullname"),
    role: user.get("role"),
    isActive: user.get("isActive"),
    lastLogin: user.get("lastLogin"),
    createdAt: user.createdAt,
    department: user.get("department"),
    phone: user.get("phone"),
  }));
});

Parse.Cloud.define("getAssetsForAdmin", async (request) => {
  // Check if user is authenticated and is an admin
  if (!request.user) {
    throw new Error("You must be logged in to perform this action.");
  }
  
  const isAdmin = request.user.get("role") === "admin";
  if (!isAdmin) {
    throw new Error("You do not have permission to perform this action.");
  }

  try {
    const Asset = Parse.Object.extend('Asset');
    const query = new Parse.Query(Asset);
    
    // Include pointer data
    query.include('createdBy');
    query.include('assignee');
    
    // Order by creation date (newest first)
    query.descending('createdAt');
    query.limit(1000);
    
    const results = await query.find({ useMasterKey: true });
    
    return results.map(asset => ({
      id: asset.id,
      name: asset.get('name'),
      categoryId: asset.get('categoryId'),
      serialNumber: asset.get('serialNumber'),
      status: asset.get('status'),
      quantity: asset.get('quantity'),
      remark: asset.get('remark'),
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
      assignee: asset.get('assignee') ? asset.get('assignee').get('fullname') : null
    }));
  } catch (error) {
    console.error("Error fetching assets for admin:", error);
    throw new Error("Could not fetch assets.");
  }
});

// Cloud function to get assets assigned to the current user
Parse.Cloud.define("getAssetsForUser", async (request) => {
  // Check if user is authenticated
  if (!request.user) {
    throw new Error("You must be logged in to perform this action.");
  }

  try {
    const Asset = Parse.Object.extend('Asset');
    const query = new Parse.Query(Asset);
    
    // Include pointer data
    query.include('createdBy');
    query.include('assignee');
    
    // Only get assets assigned to the current user
    query.equalTo('assignee', request.user);
    
    // Order by creation date (newest first)
    query.descending('createdAt');
    query.limit(1000);
    
    const results = await query.find({ useMasterKey: true });
    
    return results.map(asset => ({
      id: asset.id,
      name: asset.get('name'),
      categoryId: asset.get('categoryId'),
      serialNumber: asset.get('serialNumber'),
      status: asset.get('status'),
      quantity: asset.get('quantity'),
      remark: asset.get('remark'),
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
      assignee: asset.get('assignee') ? asset.get('assignee').get('fullname') : null
    }));
  } catch (error) {
    console.error("Error fetching assets for user:", error);
    throw new Error("Could not fetch assets.");
  }
});

// TEMPORARY: Admin function to manually verify a user's email
Parse.Cloud.define("manuallyVerifyEmail", async (request) => {
  // This function should be protected and only accessible to admins
  // For simplicity, we're not adding that check here, but you should in production
  
  const { email } = request.params;
  
  if (!email) {
    throw new Error('Email is required');
  }
  
  try {
    // Find user by email
    const query = new Parse.Query(Parse.User);
    query.equalTo("email", email);
    const user = await query.first({ useMasterKey: true });
    
    if (!user) {
      throw new Error("User not found with this email address");
    }
    
    // Mark the user as verified
    user.set("emailVerified", true);
    
    // Clear verification code and token if they exist
    if (user.get("verificationCode")) {
      user.set("verificationCode", null);
    }
    if (user.get("codeExpiresAt")) {
      user.set("codeExpiresAt", null);
    }
    if (user.get("emailVerificationToken")) {
      user.set("emailVerificationToken", null);
    }
    if (user.get("emailVerificationTokenExpiresAt")) {
      user.set("emailVerificationTokenExpiresAt", null);
    }
    
    await user.save(null, { useMasterKey: true });
    
    return { 
      success: true, 
      message: `Email ${email} has been manually verified` 
    };
  } catch (error) {
    console.error('Error manually verifying email:', error);
    throw new Error('Failed to verify email: ' + error.message);
  }
});

// Create verification token for user after signup
Parse.Cloud.afterSave(Parse.User, async (request) => {
  const user = request.object;
  
  // Only do this for new users who are not verified yet
  if (request.original === undefined && !user.get("emailVerified")) {
    // Generate a verification token
    const verificationToken = new Array(32).fill(0).map(() => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    
    // Store the token and its expiration time with the user
    user.set('emailVerificationToken', verificationToken);
    user.set('emailVerificationTokenExpires', new Date(Date.now() + 24 * 60 * 60 * 1000)); // 24 hours validity
    await user.save(null, { useMasterKey: true });
    
    const email = user.get("email");
    
    // Construct verification URL with your actual frontend URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const verificationUrl = `${frontendUrl}/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;
    
    // For testing purposes, log the URL
    console.log(`IMPORTANT - Initial verification link for ${email}: ${verificationUrl}`);
    
    // Send the email using Nodemailer (configured in your Parse Server)
    const mailSubject = 'Verify Your Email - IT PORTAL';
    const mailText = `Please verify your email by clicking the link below:\n\n${verificationUrl}`;
    const mailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #1e293b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0;">Email Verification</h1>
        </div>
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0; border-top: none;">
          <p>Hello,</p>
          <p>Thank you for registering with our IT Asset Management System. Please use the verification code below to verify your email address:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background-color: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Verify Email</a>
          </div>
          <p>Or copy and paste the following URL into your browser:</p>
          <p>${verificationUrl}</p>
          <p>This link will expire in 24 hours.</p>
        </div>
      </div>
    `;
    
    try {
      // Using Parse Server's email adapter (Nodemailer)
      await Parse.Cloud.sendEmail({
        from: process.env.EMAIL_FROM || 'noreply@itassetmanagement.com',
        to: email,
        subject: mailSubject,
        text: mailText,
        html: mailHtml
      });
      
      console.log('Email sent successfully');
      
    } catch (error) {
      console.error('Error sending email:', error);
      // Don't throw here to prevent user creation failure
      console.log('WORKAROUND: Email sending failed, but user creation will continue.');
      console.log(`IMPORTANT - Manual verification link for ${email}: ${verificationUrl}`);
    }
  }
});

// TEMPORARY: Create an admin user for testing
Parse.Cloud.define("createAdminUser", async (request) => {
  // This should be protected in production
  const { username, password, email, fullname } = request.params;
  
  if (!username || !password) {
    throw new Error("Username and password are required");
  }
  
  try {
    // Check if user already exists
    const query = new Parse.Query(Parse.User);
    query.equalTo("username", username);
    const existingUser = await query.first({ useMasterKey: true });
    
    if (existingUser) {
      // If user exists, update role to admin
      existingUser.set("role", "admin");
      await existingUser.save(null, { useMasterKey: true });
      return { 
        success: true, 
        message: `User ${username} updated to admin role.`,
        userId: existingUser.id
      };
    }
    
    // Create new admin user
    const user = new Parse.User();
    user.set("username", username);
    user.set("password", password);
    
    if (email) {
      user.set("email", email);
    }
    
    if (fullname) {
      user.set("fullname", fullname);
    }
    
    user.set("role", "admin");
    user.set("emailVerified", true); // Auto-verify for admin
    
    await user.signUp(null, { useMasterKey: true });
    
    return { 
      success: true, 
      message: `Admin user ${username} created successfully.`,
      userId: user.id
    };
  } catch (error) {
    console.error("Error creating admin user:", error);
    throw new Error(`Failed to create admin user: ${error.message}`);
  }
});

// Role-based data access functions

// Get tickets for the current user based on role
Parse.Cloud.define('getTicketsByRole', async (request) => {
  const user = request.user;
  
  if (!user) {
    throw new Error('You must be logged in to access tickets');
  }
  
  try {
    const userRole = user.get('role') || 'employee';
    const query = new Parse.Query('Ticket');
    
    // If admin, return all tickets
    if (userRole === 'admin') {
      // No filter needed, return all tickets
    } else {
      // For employees, only return tickets they created
      query.equalTo('createdBy', user);
    }
    
    // Add sorting and limit
    query.descending('createdAt');
    query.limit(100);
    
    // Include related objects
    query.include('assignedTo');
    query.include('createdBy');
    
    const tickets = await query.find();
    return { success: true, tickets };
  } catch (error) {
    console.error('Error fetching tickets:', error);
    throw new Error('Failed to fetch tickets: ' + error.message);
  }
});

// Get assets for the current user based on role
Parse.Cloud.define('getAssetsByRole', async (request) => {
  const user = request.user;
  
  if (!user) {
    throw new Error('You must be logged in to access assets');
  }
  
  try {
    const userRole = user.get('role') || 'employee';
    const query = new Parse.Query('Asset');
    
    // If admin, return all assets
    if (userRole === 'admin') {
      // No filter needed, return all assets
    } else {
      // For employees, only return assets assigned to them
      query.equalTo('assignedTo', user);
    }
    
    // Add sorting and limit
    query.descending('updatedAt');
    query.limit(100);
    
    // Include related objects
    query.include('assignedTo');
    
    const assets = await query.find();
    return { success: true, assets };
  } catch (error) {
    console.error('Error fetching assets:', error);
    throw new Error('Failed to fetch assets: ' + error.message);
  }
});

// Before save trigger for Ticket class
Parse.Cloud.beforeSave('Ticket', async (request) => {
  const ticket = request.object;
  const user = request.user;
  
  // If this is a new ticket
  if (!ticket.existed()) {
    // Set the createdBy field to the current user
    ticket.set('createdBy', user);
  }
});

// Before save trigger for User class
Parse.Cloud.beforeSave(Parse.User, async (request) => {
  const user = request.object;
  
  // If this is a new user and no role is set
  if (!user.existed() && !user.get('role')) {
    // Set default role to employee
    user.set('role', 'employee');
  }
});

Parse.Cloud.define("createAssetHistoryRecord", async (request) => {
  // Check if user is authenticated and is an admin
  if (!request.user) {
    throw new Error("You must be logged in to perform this action.");
  }
  
  const isAdmin = request.user.get("role") === "admin";
  if (!isAdmin) {
    throw new Error("You do not have permission to perform this action.");
  }

  const { assetId, userId, handoverDate, previousUserId = null } = request.params;
  
  if (!assetId || !userId || !handoverDate) {
    throw new Error("Missing required parameters");
  }

  try {
    // Create a pointer to the Asset
    const Asset = Parse.Object.extend('Asset');
    const assetPointer = new Asset();
    assetPointer.id = assetId;

    // Create a pointer to the new User
    const User = Parse.User;
    const userPointer = User.createWithoutData(userId);

    // Create a new AssetHistory record
    const AssetHistory = Parse.Object.extend('AssetHistory');
    const history = new AssetHistory();
    
    // Set the basic info
    history.set('asset', assetPointer);
    history.set('assignedTo', userPointer);
    history.set('handoverDate', new Date(handoverDate));
    history.set('assignedBy', request.user);
    
    // Logging for debugging
    console.log('createAssetHistoryRecord params:', request.params);
    if (previousUserId) {
      const previousUserPointer = User.createWithoutData(previousUserId);
      history.set('previousUser', previousUserPointer);
      console.log('Setting previousUser in AssetHistory:', previousUserId);
    } else {
      console.log('No previousUserId provided for AssetHistory');
    }

    await history.save(null, { useMasterKey: true });
    
    return { success: true };
  } catch (error) {
    console.error("Error creating asset history:", error);
    throw new Error("Could not create asset history record.");
  }
});

Parse.Cloud.define("getAssetHistory", async (request) => {
  // Check if user is authenticated
  if (!request.user) {
    throw new Error("You must be logged in to perform this action.");
  }

  const { assetId } = request.params;
  if (!assetId) {
    throw new Error("Asset ID is required");
  }

  // Fetch the asset to check permissions
  const Asset = Parse.Object.extend('Asset');
  const asset = await new Parse.Query(Asset).get(assetId, { useMasterKey: true });

  // Allow if admin
  const isAdmin = request.user.get("role") === "admin";
  // Allow if assignee
  const assignee = asset.get('assignee');
  const isAssignee = assignee && assignee.id === request.user.id;

  if (!isAdmin && !isAssignee) {
    throw new Error("You do not have permission to view this asset's history.");
  }

  try {
    // Query the AssetHistory class
    const AssetHistory = Parse.Object.extend('AssetHistory');
    const query = new Parse.Query(AssetHistory);

    query.equalTo('asset', asset);
    query.include('assignedTo');
    query.include('previousUser');
    query.include('assignedBy');
    query.include('changedBy');
    query.descending('createdAt');

    const results = await query.find({ useMasterKey: true });

    return results.map(history => {
      if (history.get('statusChange')) {
        return {
          id: history.id,
          assetId: history.get('asset').id,
          type: 'status_change',
          newStatus: history.get('newStatus'),
          previousStatus: history.get('previousStatus'),
          previousUser: history.get('previousUser') ? {
            id: history.get('previousUser').id,
            fullname: history.get('previousUser').get('fullname') || 'Unknown User'
          } : null,
          changeDate: history.get('changeDate'),
          unassignedDate: history.get('unassignedDate'),
          changedBy: history.get('changedBy') ? {
            id: history.get('changedBy').id,
            fullname: history.get('changedBy').get('fullname') || 'Unknown User'
          } : null,
          createdAt: history.createdAt
        };
      } else {
        // Regular assignment log
        return {
          id: history.id,
          assetId: history.get('asset').id,
          type: 'assignment',
          assignedTo: {
            id: history.get('assignedTo').id,
            fullname: history.get('assignedTo').get('fullname') || 'Unknown User'
          },
          previousUser: history.get('previousUser') ? {
            id: history.get('previousUser').id,
            fullname: history.get('previousUser').get('fullname') || 'Unknown User'
          } : null,
          handoverDate: history.get('handoverDate'),
          assignedBy: {
            id: history.get('assignedBy').id,
            fullname: history.get('assignedBy').get('fullname') || 'Unknown User'
          },
          createdAt: history.createdAt
        };
      }
    });
  } catch (error) {
    console.error("Error fetching asset history:", error);
    throw new Error("Could not fetch asset history.");
  }
});

Parse.Cloud.define("createAssetStatusLog", async (request) => {
  // Check if user is authenticated and is an admin
  if (!request.user) {
    throw new Error("You must be logged in to perform this action.");
  }
  
  const isAdmin = request.user.get("role") === "admin";
  if (!isAdmin) {
    throw new Error("You do not have permission to perform this action.");
  }

  const { assetId, status, previousStatus, previousAssigneeId } = request.params;
  
  if (!assetId || !status) {
    throw new Error("Missing required parameters");
  }

  try {
    // Create a pointer to the Asset
    const Asset = Parse.Object.extend('Asset');
    const assetPointer = new Asset();
    assetPointer.id = assetId;

    // Create a new AssetHistory record for status change
    const AssetHistory = Parse.Object.extend('AssetHistory');
    const history = new AssetHistory();
    
    // Set the basic info
    history.set('asset', assetPointer);
    history.set('statusChange', true);
    history.set('newStatus', status);
    history.set('previousStatus', previousStatus || null);
    history.set('changedBy', request.user);
    history.set('changeDate', new Date());
    
    // If there was a previous assignee and status changed to free, record that
    if (previousAssigneeId && status === 'free') {
      const User = Parse.User;
      const previousUserPointer = new User();
      previousUserPointer.id = previousAssigneeId;
      history.set('previousUser', previousUserPointer);
      history.set('unassignedDate', new Date());
    }

    await history.save(null, { useMasterKey: true });
    
    return { success: true };
  } catch (error) {
    console.error("Error creating asset status log:", error);
    throw new Error("Could not create asset status log.");
  }
});

// Generate and send verification code via email
Parse.Cloud.define("sendVerificationCode", async (request) => {
  const { email } = request.params;
  
  if (!email) {
    throw new Error('Email is required');
  }
  
  try {
    // Find user by email
    const query = new Parse.Query(Parse.User);
    query.equalTo('email', email);
    const user = await query.first({ useMasterKey: true });
    
    if (!user) {
      throw new Error('User not found with this email address');
    }
    
    // Generate a 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store the code and expiration time (60 seconds from now) in the user object
    user.set('verificationCode', verificationCode);
    user.set('codeExpiresAt', new Date(Date.now() + 60 * 1000)); // 60 seconds from now
    await user.save(null, { useMasterKey: true });
    
    // Send the email using Nodemailer (configured in your Parse Server)
    const mailSubject = 'Your Verification Code - IT PORTAL';
    const mailText = `Your verification code is: ${verificationCode}\n\nThis code will expire in 60 seconds.`;
    const mailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #1e293b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0;">Email Verification</h1>
        </div>
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0; border-top: none;">
          <p>Hello,</p>
          <p>Thank you for registering with our IT Asset Management System. Please use the verification code below to verify your email address:</p>
          <div style="text-align: center; margin: 30px 0;">
            <div style="background-color: #e2e8f0; padding: 15px; border-radius: 4px; font-size: 24px; font-weight: bold; letter-spacing: 5px;">${verificationCode}</div>
          </div>
          <p><strong>This code will expire in 60 seconds.</strong></p>
          <p>If you did not create an account, please ignore this email.</p>
          <p>Best regards,<br>IT Asset Management Team</p>
        </div>
      </div>
    `;
    
    try {
      // Using Parse Server's email adapter (Nodemailer)
      await Parse.Cloud.sendEmail({
        from: process.env.EMAIL_FROM || 'noreply@itassetmanagement.com',
        to: email,
        subject: mailSubject,
        text: mailText,
        html: mailHtml
      });
      
      return { success: true, message: 'Verification code sent successfully' };
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      
      // Fallback - log the code for development
      console.log(`IMPORTANT - Verification code for ${email}: ${verificationCode}`);
      return { success: true, message: 'Verification code processing. Please check your inbox.' };
    }
    
  } catch (error) {
    console.error('Error sending verification code:', error);
    throw new Error('Failed to send verification code: ' + error.message);
  }
});

// Verify email with code
Parse.Cloud.define("verifyEmailWithCode", async (request) => {
  const { email, code } = request.params;
  
  if (!email || !code) {
    throw new Error('Email and verification code are required');
  }
  
  try {
    // Find user by email
    const query = new Parse.Query(Parse.User);
    query.equalTo('email', email);
    const user = await query.first({ useMasterKey: true });
    
    if (!user) {
      throw new Error('User not found with this email address');
    }
    
    // Check if code matches and is not expired
    const storedCode = user.get('verificationCode');
    const codeExpiresAt = user.get('codeExpiresAt');
    
    if (!storedCode || storedCode !== code) {
      throw new Error('Invalid verification code');
    }
    
    if (!codeExpiresAt || new Date() > codeExpiresAt) {
      throw new Error('Verification code has expired. Please request a new code.');
    }
    
    // Mark email as verified
    user.set('emailVerified', true);
    user.set('verificationCode', null);
    user.set('codeExpiresAt', null);
    await user.save(null, { useMasterKey: true });
    
    return { success: true, message: 'Email verified successfully' };
  } catch (error) {
    console.error('Error verifying email with code:', error);
    throw new Error('Failed to verify email: ' + error.message);
  }
}); 

// Get ticket statistics for dashboard
Parse.Cloud.define('getTicketStats', async (request) => {
  const { user } = request;
  if (!user) {
    throw new Error('User must be authenticated');
  }
  
  const Ticket = Parse.Object.extend('Ticket');
  const query = new Parse.Query(Ticket);
  
  // If not admin, only get stats for user's tickets
  if (user.get('role') !== 'admin') {
    query.equalTo('createdBy', user);
  }
  
  const tickets = await query.find({ useMasterKey: true });
  
  // Count tickets by status
  const openCount = tickets.filter(t => t.get('status') === 'open').length;
  const inProgressCount = tickets.filter(t => t.get('status') === 'in-progress').length;
  const resolvedCount = tickets.filter(t => t.get('status') === 'resolved').length;
  const closedCount = tickets.filter(t => t.get('status') === 'closed').length;
  
  // Count tickets resolved today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const resolvedToday = tickets.filter(t => {
    const updatedAt = t.updatedAt;
    return t.get('status') === 'resolved' && 
           updatedAt >= today;
  }).length;
  
  // Calculate average resolution time (for resolved tickets)
  let totalResolutionTimeHours = 0;
  let resolvedTicketsCount = 0;
  
  tickets.forEach(ticket => {
    if (ticket.get('status') === 'resolved') {
      const createdAt = ticket.createdAt;
      const updatedAt = ticket.updatedAt;
      const diffHours = (updatedAt - createdAt) / (1000 * 60 * 60);
      totalResolutionTimeHours += diffHours;
      resolvedTicketsCount++;
    }
  });
  
  const avgResolutionTime = resolvedTicketsCount > 0 
    ? (totalResolutionTimeHours / resolvedTicketsCount).toFixed(1) 
    : 0;
  
  return {
    openCount,
    inProgressCount,
    resolvedCount,
    closedCount,
    resolvedToday,
    avgResolutionTime
  };
}); 

// Cloud function to get user info for tickets
Parse.Cloud.define("getUserInfoForTickets", async (request) => {
  if (!request.user) {
    throw new Error("You must be logged in to perform this action.");
  }
  
  try {
    // Query the User class to get all users
    const query = new Parse.Query(Parse.User);
    const users = await query.find({ useMasterKey: true });
    
    // Create a map of user IDs to their fullname and department
    const userInfo = {};
    users.forEach(user => {
      userInfo[user.id] = {
        fullname: user.get('fullname') || 'Unknown User',
        department: user.get('department') || 'No Department'
      };
    });
    
    return userInfo;
  } catch (error) {
    console.error("Error fetching user info for tickets:", error);
    throw new Error("Could not fetch user info.");
  }
});

// Cloud function to get tickets with user info
Parse.Cloud.define("getTicketsWithUserInfo", async (request) => {
  if (!request.user) {
    throw new Error("You must be logged in to perform this action.");
  }
  
  try {
    const Ticket = Parse.Object.extend('Ticket');
    const query = new Parse.Query(Ticket);
    
    // Include the createdBy and assignedTo user objects
    query.include('createdBy');
    query.include('assignedTo');
    
    // Sort by creation date, newest first
    query.descending('createdAt');
    
    const tickets = await query.find({ useMasterKey: true });
    
    // Map the tickets with user info
    return tickets.map(ticket => {
      const createdBy = ticket.get('createdBy');
      const assignedTo = ticket.get('assignedTo');
      
      return {
        id: ticket.id,
        title: ticket.get('title'),
        description: ticket.get('description'),
        category: ticket.get('category'),
        priority: ticket.get('priority'),
        status: ticket.get('status'),
        tags: ticket.get('tags') || [],
        dueDate: ticket.get('dueDate'),
        resolution: ticket.get('resolution'),
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        createdBy: createdBy ? {
          id: createdBy.id,
          username: createdBy.get('username'),
          email: createdBy.get('email'),
          fullname: createdBy.get('fullname') || 'Unknown User',
          role: createdBy.get('role') || 'employee',
          department: createdBy.get('department') || 'No Department'
        } : null,
        assignedTo: assignedTo ? {
          id: assignedTo.id,
          username: assignedTo.get('username'),
          email: assignedTo.get('email'),
          fullname: assignedTo.get('fullname') || 'Unknown User',
          role: assignedTo.get('role') || 'admin',
          department: assignedTo.get('department') || 'No Department'
        } : null
      };
    });
  } catch (error) {
    console.error("Error fetching tickets with user info:", error);
    throw new Error("Could not fetch tickets with user info.");
  }
}); 

// Add this cloud function to fetch comments with user data
Parse.Cloud.define("getTicketCommentsWithUserInfo", async (request) => {
  const { ticketId } = request.params;
  
  if (!request.user) {
    throw new Error("You must be logged in to perform this action.");
  }
  
  if (!ticketId) {
    throw new Error("Ticket ID is required");
  }
  
  try {
    const TicketComment = Parse.Object.extend('TicketComment');
    const query = new Parse.Query(TicketComment);
    
    // Create a pointer to the Ticket object
    const Ticket = Parse.Object.extend('Ticket');
    const ticketPointer = new Ticket();
    ticketPointer.id = ticketId;
    
    // Query for comments related to this ticket
    query.equalTo('ticket', ticketPointer);
    
    // Include the createdBy user object
    query.include('createdBy');
    
    // Sort by creation date, oldest first
    query.ascending('createdAt');
    
    const comments = await query.find({ useMasterKey: true });
    
    return comments.map(comment => {
      const createdBy = comment.get('createdBy');
      
      return {
        id: comment.id,
        text: comment.get('text'),
        createdAt: comment.createdAt,
        createdBy: createdBy ? {
          id: createdBy.id,
          username: createdBy.get('username'),
          fullname: createdBy.get('fullname') || 'Unknown User',
          role: createdBy.get('role') || 'employee',
          department: createdBy.get('department') || 'No Department'
        } : null
      };
    });
  } catch (error) {
    console.error('Get ticket comments error:', error);
    throw new Error('Could not fetch ticket comments: ' + error.message);
  }
}); 

// Add this cloud function to get ticket details by ID with user info
Parse.Cloud.define("getTicketByIdWithUserInfo", async (request) => {
  const { ticketId } = request.params;
  
  if (!request.user) {
    throw new Error("You must be logged in to perform this action.");
  }
  
  if (!ticketId) {
    throw new Error("Ticket ID is required");
  }
  
  try {
    const Ticket = Parse.Object.extend('Ticket');
    const query = new Parse.Query(Ticket);
    
    // Include the createdBy and assignedTo user objects
    query.include('createdBy');
    query.include('assignedTo');
    
    const ticket = await query.get(ticketId, { useMasterKey: true });
    
    if (!ticket) {
      throw new Error("Ticket not found");
    }
    
    const createdBy = ticket.get('createdBy');
    const assignedTo = ticket.get('assignedTo');
    
    return {
      id: ticket.id,
      title: ticket.get('title'),
      description: ticket.get('description'),
      category: ticket.get('category'),
      priority: ticket.get('priority'),
      status: ticket.get('status'),
      tags: ticket.get('tags') || [],
      dueDate: ticket.get('dueDate'),
      resolution: ticket.get('resolution'),
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      createdBy: createdBy ? {
        id: createdBy.id,
        username: createdBy.get('username'),
        email: createdBy.get('email'),
        fullname: createdBy.get('fullname') || 'Unknown User',
        role: createdBy.get('role') || 'employee',
        department: createdBy.get('department') || 'No Department'
      } : null,
      assignedTo: assignedTo ? {
        id: assignedTo.id,
        username: assignedTo.get('username'),
        email: assignedTo.get('email'),
        fullname: assignedTo.get('fullname') || 'Unknown User',
        role: assignedTo.get('role') || 'admin',
        department: assignedTo.get('department') || 'No Department'
      } : null
    };
  } catch (error) {
    console.error('Get ticket by ID error:', error);
    throw new Error('Could not fetch ticket details: ' + error.message);
  }
}); 

// Add this cloud function to get user tickets with user info
Parse.Cloud.define("getUserTicketsWithUserInfo", async (request) => {
  if (!request.user) {
    throw new Error("You must be logged in to perform this action.");
  }
  
  try {
    const Ticket = Parse.Object.extend('Ticket');
    const query = new Parse.Query(Ticket);
    
    // Only get tickets created by current user
    query.equalTo('createdBy', request.user);
    
    // Include the assignedTo user object
    query.include('assignedTo');
    
    // Sort by creation date, newest first
    query.descending('createdAt');
    
    const tickets = await query.find({ useMasterKey: true });
    
    // Map the tickets with user info
    return tickets.map(ticket => {
      const assignedTo = ticket.get('assignedTo');
      
      return {
        id: ticket.id,
        title: ticket.get('title'),
        description: ticket.get('description'),
        category: ticket.get('category'),
        priority: ticket.get('priority'),
        status: ticket.get('status'),
        tags: ticket.get('tags') || [],
        dueDate: ticket.get('dueDate'),
        resolution: ticket.get('resolution'),
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        // Current user is the creator
        createdBy: {
          id: request.user.id,
          username: request.user.get('username'),
          email: request.user.get('email'),
          fullname: request.user.get('fullname') || 'Current User',
          role: request.user.get('role') || 'employee',
          department: request.user.get('department') || 'No Department'
        },
        assignedTo: assignedTo ? {
          id: assignedTo.id,
          username: assignedTo.get('username'),
          email: assignedTo.get('email'),
          fullname: assignedTo.get('fullname') || 'Unknown User',
          role: assignedTo.get('role') || 'admin',
          department: assignedTo.get('department') || 'No Department'
        } : null
      };
    });
  } catch (error) {
    console.error("Error fetching user tickets:", error);
    throw new Error("Could not fetch user tickets: " + error.message);
  }
}); 

// Cloud function for admin to create a new user
Parse.Cloud.define("adminCreateUser", async (request) => {
  if (!request.user) throw new Error("You must be logged in.");
  if (request.user.get("role") !== "admin") throw new Error("Not authorized.");

  const { fullname, email, password, department, role, phone } = request.params;
  if (!fullname || !email || !password) throw new Error("fullname, email, and password are required");

  // Check if user already exists
  const query = new Parse.Query(Parse.User);
  query.equalTo("email", email);
  const existing = await query.first({ useMasterKey: true });
  if (existing) throw new Error("A user with this email already exists.");

  const user = new Parse.User();
  user.set("username", email);
  user.set("password", password);
  user.set("email", email);
  user.set("fullname", fullname);
  user.set("department", department || '');
  user.set("role", role || 'user');
  user.set("phone", phone || '');
  user.set("isActive", true);

  await user.signUp(null, { useMasterKey: true });

  return {
    id: user.id,
    username: user.get("username"),
    email: user.get("email"),
    fullname: user.get("fullname"),
    role: user.get("role"),
    isActive: user.get("isActive"),
    createdAt: user.createdAt,
    department: user.get("department"),
    phone: user.get("phone"),
  };
});

// Cloud function for admin to update a user
Parse.Cloud.define("adminUpdateUser", async (request) => {
  if (!request.user) throw new Error("You must be logged in.");
  if (request.user.get("role") !== "admin") throw new Error("Not authorized.");

  const { id, fullname, email, department, role, phone, isActive } = request.params;
  if (!id) throw new Error("User id is required");

  const query = new Parse.Query(Parse.User);
  const user = await query.get(id, { useMasterKey: true });
  if (!user) throw new Error("User not found");

  if (fullname !== undefined) user.set("fullname", fullname);
  if (email !== undefined) user.set("email", email);
  if (department !== undefined) user.set("department", department);
  if (role !== undefined) user.set("role", role);
  if (phone !== undefined) user.set("phone", phone);
  if (isActive !== undefined) user.set("isActive", isActive);

  await user.save(null, { useMasterKey: true });

  return {
    id: user.id,
    username: user.get("username"),
    email: user.get("email"),
    fullname: user.get("fullname"),
    role: user.get("role"),
    isActive: user.get("isActive"),
    createdAt: user.createdAt,
    department: user.get("department"),
    phone: user.get("phone"),
  };
});

// Cloud function for admin to delete a user
Parse.Cloud.define("adminDeleteUser", async (request) => {
  if (!request.user) throw new Error("You must be logged in.");
  if (request.user.get("role") !== "admin") throw new Error("Not authorized.");

  const { id } = request.params;
  if (!id) throw new Error("User id is required");

  const query = new Parse.Query(Parse.User);
  const user = await query.get(id, { useMasterKey: true });
  if (!user) throw new Error("User not found");

  await user.destroy({ useMasterKey: true });
  return { success: true };
});

// Automatically update lastLogin on every login
Parse.Cloud.afterLogin(async (request) => {
  const user = request.object;
  user.set('lastLogin', new Date());
  await user.save(null, { useMasterKey: true });
});

// Validate current password and change password
Parse.Cloud.define("validateAndChangePassword", async (request) => {
  const { currentPassword, newPassword } = request.params;
  
  if (!request.user) {
    throw new Error("You must be logged in to change your password.");
  }
  
  if (!currentPassword || !newPassword) {
    throw new Error("Current password and new password are required.");
  }
  
  try {
    // Validate current password by attempting to log in with it
    const username = request.user.get("username");
    const user = await Parse.User.logIn(username, currentPassword);
    
    if (!user) {
      throw new Error("Current password is incorrect.");
    }
    
    // Set the new password
    user.setPassword(newPassword);
    await user.save(null, { useMasterKey: true });
    
    return { 
      success: true, 
      message: "Password changed successfully." 
    };
  } catch (error) {
    console.error('Error changing password:', error);
    if (error.code === 101) {
      throw new Error("Current password is incorrect.");
    }
    throw new Error("Failed to change password: " + error.message);
  }
});

// Validate current password only (for checking before showing change password form)
Parse.Cloud.define("validateCurrentPassword", async (request) => {
  const { currentPassword } = request.params;
  
  if (!request.user) {
    throw new Error("You must be logged in to validate your password.");
  }
  
  if (!currentPassword) {
    throw new Error("Current password is required.");
  }
  
  try {
    // Validate current password by attempting to log in with it
    const username = request.user.get("username");
    const user = await Parse.User.logIn(username, currentPassword);
    
    if (!user) {
      throw new Error("Current password is incorrect.");
    }
    
    return { 
      success: true, 
      message: "Current password is correct." 
    };
  } catch (error) {
    console.error('Error validating password:', error);
    if (error.code === 101) {
      throw new Error("Current password is incorrect.");
    }
    throw new Error("Failed to validate password: " + error.message);
  }
});

// Cloud function to get assets for a specific userId (admin only)
Parse.Cloud.define("getAssetsForUserId", async (request) => {
  if (!request.user || request.user.get("role") !== "admin") {
    throw new Error("Not authorized.");
  }
  const { userId } = request.params;
  if (!userId) throw new Error("userId required");
  const User = Parse.User;
  const userPointer = new User();
  userPointer.id = userId;
  const Asset = Parse.Object.extend('Asset');
  const query = new Parse.Query(Asset);
  query.equalTo('assignee', userPointer);
  query.include('assignee');
  query.include('createdBy');
  query.descending('createdAt');
  query.limit(1000);
  const results = await query.find({ useMasterKey: true });
  return results.map(asset => ({
    id: asset.id,
    name: asset.get('name'),
    categoryId: asset.get('categoryId'),
    serialNumber: asset.get('serialNumber'),
    status: asset.get('status'),
    quantity: asset.get('quantity'),
    remark: asset.get('remark'),
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
    assignee: asset.get('assignee') ? asset.get('assignee').get('fullname') : null
  }));
}); 