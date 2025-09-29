import React, { useState, useEffect } from 'react';
import { Settings, User, Shield, Database, Globe, Save, Eye, EyeOff, CalendarCheck, CalendarClock, CheckCircle, UserCog } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import parseService from '../services/parseService';

const SettingsPage = () => {
  const { user: authUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Read query params
  const searchParams = new URLSearchParams(location.search);
  const initialTab = searchParams.get('tab') || 'profile';
  const viewOnly = searchParams.get('view') === '1' && initialTab === 'profile';

  const [user, setUser] = useState(authUser);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [fullname, setFullname] = useState(authUser?.fullname || '');
  const [email, setEmail] = useState(authUser?.email || '');
  const [department, setDepartment] = useState(authUser?.department || '');
  const [phone, setPhone] = useState(authUser?.phone || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  
  // Phone validation state
  const [phoneError, setPhoneError] = useState('');
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const isAdmin = user?.role === 'admin';

  // Phone validation function
  const validatePhone = (value) => {
    // Remove any non-digit characters
    const digitsOnly = value.replace(/\D/g, '');
    
    // Check if it's empty (optional field)
    if (!digitsOnly) {
      setPhoneError('');
      return '';
    }
    
    // Check if it contains only digits
    if (!/^\d+$/.test(digitsOnly)) {
      setPhoneError('Phone number can only contain digits');
      return digitsOnly;
    }
    
    // Check if it's more than 10 digits
    if (digitsOnly.length > 10) {
      setPhoneError('Phone number cannot exceed 10 digits');
      return digitsOnly.substring(0, 10);
    }
    
    // Check if it starts with 0 and has at least 5 digits
    if (digitsOnly.length >= 1 && digitsOnly[0] !== '0') {
      setPhoneError('Phone number should start with 0');
      return digitsOnly;
    }
    
    if (digitsOnly.length >= 1 && digitsOnly.length < 10) {
      setPhoneError('Phone number should be at least 10 digits');
      return digitsOnly;
    }
    
    setPhoneError('');
    return digitsOnly;
  };

  // Handle phone input change
  const handlePhoneChange = (e) => {
    const value = e.target.value;
    const validatedValue = validatePhone(value);
    setPhone(validatedValue);
  };

  // Department options (same as UsersPage)
  const departmentOptions = [
    { value: 'Business_Development', label: 'Business Development' },
    { value: 'Accounting', label: 'Accounting' },
    { value: 'Others', label: 'Others' }
  ];

  useEffect(() => {
    async function fetchUser() {
      const freshUser = await parseService.getCurrentUser();
      if (freshUser) {
        setUser(freshUser);
        setFullname(freshUser.fullname || '');
        setEmail(freshUser.email || '');
        setDepartment(freshUser.department || '');
        setPhone(freshUser.phone || '');
      }
    }
    fetchUser();
  }, []);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    
    // Validate phone before saving
    if (phone && phoneError) {
      setMessage('Please fix the phone number errors before saving.');
      return;
    }
    
    setSaving(true);
    setMessage('');
    const result = await parseService.updateCurrentUserProfile({ fullname, email, department, phone });
    if (result.success) {
      setMessage('Profile updated successfully!');
      const freshUser = await parseService.getCurrentUser();
      if (freshUser) setUser(freshUser);
    } else {
      setMessage(result.error || 'Failed to update profile.');
    }
    setSaving(false);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setChangingPassword(true);
    setPasswordMessage('');
    
    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setPasswordMessage('New passwords do not match.');
      setChangingPassword(false);
      return;
    }
    
    // Validate password strength
    if (newPassword.length < 6) {
      setPasswordMessage('New password must be at least 6 characters long.');
      setChangingPassword(false);
      return;
    }
    
    const result = await parseService.changePassword(currentPassword, newPassword);
    if (result.success) {
      setPasswordMessage('Password changed successfully! Redirecting to login...');
      // Clear password fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      // Wait a moment to show success message, then logout and redirect
      setTimeout(async () => {
        await logout();
        navigate('/login');
      }, 2000);
    } else {
      setPasswordMessage(result.error || 'Failed to change password.');
    }
    setChangingPassword(false);
  };

  const tabs = [
    { id: 'profile', name: 'Profile', icon: User },
    { id: 'security', name: 'Security', icon: Shield },
    { id: 'system', name: 'System', icon: Database },
    { id: 'integrations', name: 'Integrations', icon: Globe },
  ];

  // Helper to format date as dd-MMM-yyyy
  function formatDateDMY(date) {
    if (!date) return '-';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = d.toLocaleString('default', { month: 'short' });
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  }

  const renderProfileTab = () => (
    <form className="space-y-6" onSubmit={handleProfileSave}>
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Profile Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Full Name</label>
            <input
              type="text"
              value={fullname}
              onChange={e => setFullname(e.target.value)}
              className="input-field w-full"
              disabled={viewOnly}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="input-field w-full"
              disabled={viewOnly}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Username</label>
            <input
              type="text"
              value={user?.username}
              className="input-field w-full"
              disabled
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Department</label>
            <select
              value={department}
              onChange={e => setDepartment(e.target.value)}
              className="input-field w-full"
              disabled={!isAdmin || viewOnly}
            >
              <option value="">Select Department</option>
              {departmentOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              className="input-field w-full"
              placeholder="05xxxxx"
              disabled={viewOnly}
            />
            {phoneError && (
              <div className="mt-1 text-sm text-red-400">{phoneError}</div>
            )}
          </div>
        </div>
      </div>
      {message && <div className="text-center text-sm text-cyan-400 font-medium">{message}</div>}
      <div className="flex justify-end">
        {!viewOnly && (
          <button 
            className="btn-primary flex items-center gap-2" 
            type="submit" 
            disabled={saving || (phone && phoneError)}
          >
            {saving ? 'Saving...' : 'Save Changes'}
            <Save className="w-4 h-4" />
          </button>
        )}
      </div>
      {/* Modern Info Card */}
      <div className="mt-8">
        <div className="glass-morphism rounded-xl p-6 flex flex-col md:grid md:grid-cols-4 items-center justify-between gap-6 shadow-lg border border-cyan-400/10">
          <div className="flex items-center gap-3 flex-1 min-w-[180px]">
            <CalendarCheck className="w-5 h-5 text-cyan-400" />
            <div>
              <span className="block text-xs text-slate-400 mb-0.5">Account Created</span>
              <span className="block text-lg font-bold text-white font-mono tracking-wide">{formatDateDMY(user?.createdAt)}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-1 min-w-[180px]">
            <CalendarClock className="w-5 h-5 text-cyan-400" />
            <div>
              <span className="block text-xs text-slate-400 mb-0.5">Last Updated</span>
              <span className="block text-lg font-bold text-white font-mono tracking-wide">{formatDateDMY(user?.updatedAt)}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-1 min-w-[180px]">
            <CheckCircle className={`w-5 h-5 ${user?.emailVerified ? 'text-green-400' : 'text-red-400'}`} />
            <div>
              <span className="block text-xs text-slate-400 mb-0.5">Email Verified</span>
              <span className={`block text-lg font-bold ${user?.emailVerified ? 'text-green-400' : 'text-red-400'}`}>{user?.emailVerified ? 'Yes' : 'No'}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-1 min-w-[180px]">
            <UserCog className="w-5 h-5 text-cyan-400" />
            <div>
              <span className="block text-xs text-slate-400 mb-0.5">Role</span>
              <span className="block text-lg font-bold text-white capitalize">{user?.role}</span>
            </div>
          </div>
        </div>
      </div>
    </form>
  );

  const renderSecurityTab = () => (
    <form onSubmit={handlePasswordChange} className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Change Password</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Current Password</label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input-field w-full pr-10"
                placeholder="Enter current password"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">New Password</label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input-field w-full pr-10"
                placeholder="Enter new password"
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input-field w-full"
              placeholder="Confirm new password"
              required
            />
          </div>
        </div>
        {passwordMessage && (
          <div className={`mt-4 text-sm font-medium ${
            passwordMessage.includes('successfully') ? 'text-green-400' : 'text-red-400'
          }`}>
            {passwordMessage}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Two-Factor Authentication</h3>
        {isAdmin ? (
          <div className="glass-morphism p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-white font-medium">Enable 2FA</h4>
                <p className="text-sm text-slate-400">Add an extra layer of security to your account</p>
              </div>
              <button type="button" className="btn-primary">Enable</button>
            </div>
          </div>
        ) : (
          <div className="glass-morphism p-4 rounded-lg opacity-60 cursor-not-allowed relative">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-white font-medium">Enable 2FA</h4>
                <p className="text-sm text-slate-400">Add an extra layer of security to your account</p>
              </div>
              <button type="button" className="btn-primary" disabled>Enable</button>
            </div>
            <span className="absolute top-1/2 right-4 transform -translate-y-1/2 text-xs text-orange-400 bg-slate-800/80 px-2 py-0.5 rounded-full border border-orange-400/20">Coming Soon</span>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button 
          type="submit" 
          className="btn-primary flex items-center justify-center"
          disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
        >
          {changingPassword ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Changing Password...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Update Security Settings
            </>
          )}
        </button>
      </div>
    </form>
  );

  const renderSystemTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">System Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Company Name</label>
            <input
              type="text"
              defaultValue="Zainlee Technologies LLC"
              className="input-field w-full" disabled={!isAdmin}/>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Default Currency</label>
            <select className="input-field w-full" disabled={!isAdmin}>
              <option value="AED">AED - UAE Dirham</option>
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - Pound Sterling</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Time Zone</label>
            <select className="input-field w-full" disabled={!isAdmin}>
              <option value="GST">GST - Gulf Standard Time</option>
              <option value="UTC">UTC</option>
              <option value="EST">EST - Eastern Time</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Date Format</label>
            <select className="input-field w-full" disabled={!isAdmin}>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );

  const renderIntegrationsTab = () => (
    <div className="space-y-6 relative">
      {!isAdmin && (
        <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center z-10 rounded-lg">
          <span className="text-orange-400 text-lg font-semibold">Integrations are coming soon and only available for admins.</span>
        </div>
      )}
      <div className={isAdmin ? '' : 'pointer-events-none opacity-60 select-none'}>
        <h3 className="text-lg font-semibold text-white mb-4">Available Integrations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { name: 'Back4App', description: 'Cloud database and backend services', status: 'connected' },
            { name: 'Slack', description: 'Team communication and notifications', status: 'available' },
            { name: 'Microsoft 365', description: 'Office suite and user management', status: 'available' },
            { name: 'Google Workspace', description: 'Productivity tools and SSO', status: 'available' },
            { name: 'Jira', description: 'Issue tracking and project management', status: 'available' },
            { name: 'Okta', description: 'Identity and access management', status: 'available' },
          ].map((integration, index) => (
            <div key={index} className="glass-morphism p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-white font-medium">{integration.name}</h4>
                {integration.status === 'connected' ? (
                  <div className="px-2 py-1 bg-green-500/20 text-green-300 border border-green-500/30 rounded-full text-xs">
                    Connected
                  </div>
                ) : (
                  <button className="btn-primary text-sm py-1 px-3" disabled>Connect</button>
                )}
              </div>
              <p className="text-sm text-slate-400">{integration.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return renderProfileTab();
      case 'security':
        return renderSecurityTab();
      case 'system':
        return renderSystemTab();
      case 'integrations':
        return renderIntegrationsTab();
      default:
        return renderProfileTab();
    }
  };

  if (viewOnly) {
    return (
      <div className="space-y-6">
        <div className="glass-morphism p-6 rounded-xl max-w-2xl mx-auto mt-8 animate-fade-up">
          {renderProfileTab()}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 animate-fade-in">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-1 sm:mb-2">Settings</h1>
          <p className="text-slate-400 text-sm sm:text-base">Manage your account and system preferences</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 sm:gap-6 animate-fade-up">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="glass-morphism p-4 rounded-xl border border-slate-700/30 shadow-glow animate-fade-up" style={{ animationDelay: '0.05s' }}>
            <nav className="space-y-2">
              {tabs.map((tab, idx) => {
                const Icon = tab.icon;
                const isIntegrations = tab.id === 'integrations';
                const isDisabled = isIntegrations && !isAdmin;
                return (
                  <button
                    key={tab.id}
                    onClick={() => !isDisabled && setActiveTab(tab.id)}
                    className={[
                      'w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors relative animate-fade-up',
                      activeTab === tab.id
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : isDisabled
                          ? 'text-slate-500 bg-slate-800/40 cursor-not-allowed opacity-60'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                    ].join(' ')}
                    style={{ animationDelay: `${idx * 0.05}s` }}
                    disabled={isDisabled}
                    tabIndex={isDisabled ? -1 : 0}
                    aria-disabled={isDisabled}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{tab.name}</span>
                    {isIntegrations && (
                      <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-orange-900/60 text-orange-400 border border-orange-400/30">Coming Soon</span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <div className="glass-morphism p-6 rounded-xl border border-slate-700/30 shadow-glow animate-fade-up" style={{ animationDelay: '0.1s' }}>
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;