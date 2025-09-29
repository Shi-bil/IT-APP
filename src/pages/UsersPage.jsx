import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, Filter, MoreHorizontal, Edit, Trash2, Eye, Mail, Phone, MapPin, RotateCcw, Package, FolderKanban, FileText } from 'lucide-react';
import { userService } from '../services/userService';
import AllAssetsView from '../components/AllAssetsView';
import { assetService } from '../services/assetService';

const UsersPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    fullname: '',
    email: '',
    password: '',
    department: '',
    role: 'employee',
    phone: '',
  });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const [viewUser, setViewUser] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [deleteUser, setDeleteUser] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [promoteUserId, setPromoteUserId] = useState('');
  const [promoteLoading, setPromoteLoading] = useState(false);
  const [promoteError, setPromoteError] = useState('');
  const [promoteSuccess, setPromoteSuccess] = useState('');
  const [viewAssetsUser, setViewAssetsUser] = useState(null);
  const [viewAssets, setViewAssets] = useState([]);
  const [viewAssetsLoading, setViewAssetsLoading] = useState(false);
  const [viewAssetsError, setViewAssetsError] = useState('');

  // Department options (same as signup page)
  const departmentOptions = [
    { value: 'Business_Development', label: 'Business Development' },
    { value: 'Accounting', label: 'Accounting' },
    { value: 'Others', label: 'Others' }
  ];

  // Role options for dropdown
  const roleOptions = [
    { value: 'employee', label: 'Employee' },
    { value: 'manager', label: 'Manager' },
    { value: 'admin', label: 'Admin' }
  ];

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      const result = await userService.getAllUsers();
      if (result.success) {
        setUsers(result.users);
      }
      setLoading(false);
    };
    fetchUsers();
  }, []);

  const getRoleBadge = (role) => {
    const roleClasses = {
      admin: 'bg-red-500/20 text-red-300 border-red-500/30',
      manager: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      user: 'bg-green-500/20 text-green-300 border-green-500/30',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${roleClasses[role]}`}>
        {role ? role.charAt(0).toUpperCase() + role.slice(1) : 'User'}
      </span>
    );
  };

  const getStatusBadge = (isActive) => {
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
        isActive ? 'status-active' : 'status-inactive'
      }`}>
        {isActive ? 'Active' : 'Inactive'}
      </span>
    );
  };

  const getInitials = (fullname) => {
    if (!fullname) return 'U';
    const parts = fullname.trim().split(' ');
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const formatLastLogin = (date) => {
    if (!date) return 'Never';
    const now = new Date();
    const loginDate = new Date(date);
    const diffMs = now.getTime() - loginDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return loginDate.toLocaleDateString();
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.fullname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.username?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = selectedRole === 'all' || user.role === selectedRole;
    const matchesStatus =
      selectedStatus === 'all' ||
                         (selectedStatus === 'active' && user.isActive) ||
                         (selectedStatus === 'inactive' && !user.isActive);
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Real statistics
  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.isActive).length;
  const adminUsers = users.filter(u => u.role === 'admin').length;
  const now = new Date();
  const newThisMonth = users.filter(u => {
    const created = new Date(u.createdAt);
    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
  }).length;

  const validateAddForm = () => {
    if (!addForm.fullname.trim()) return 'Full name is required.';
    if (!addForm.email.trim()) return 'Email is required.';
    if (!/^\S+@\S+\.\S+$/.test(addForm.email)) return 'Invalid email format.';
    if (!addForm.password || addForm.password.length < 6) return 'Password must be at least 6 characters.';
    if (!addForm.department) return 'Department is required.';
    return '';
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setAddLoading(true);
    setAddError('');
    const validationError = validateAddForm();
    if (validationError) {
      setAddError(validationError);
      setAddLoading(false);
      return;
    }
    // Set isActive to false by default for new users
    const result = await userService.createUser({ ...addForm, isActive: false });
    setAddLoading(false);
    if (result.success) {
      // Send verification email after user creation
      await userService.sendVerificationEmail(addForm.email);
      setShowAddModal(false);
      setAddForm({ fullname: '', email: '', password: '', department: '', role: 'employee', phone: '' });
      // Refresh users
      const refreshed = await userService.getAllUsers();
      if (refreshed.success) setUsers(refreshed.users);
    } else {
      setAddError(result.error || 'Failed to add user');
    }
  };

  const openEditModal = (user) => {
    setEditUser(user);
    setEditForm({
      id: user.id,
      fullname: user.fullname || '',
      email: user.email || '',
      department: user.department || '',
      role: user.role === 'user' ? 'employee' : user.role || 'employee',
      phone: user.phone || '',
      isActive: user.isActive,
    });
    setEditError('');
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    setEditError('');
    const result = await userService.updateUser(editForm);
    setEditLoading(false);
    if (result.success) {
      setEditUser(null);
      setEditForm(null);
      // Refresh users
      const refreshed = await userService.getAllUsers();
      if (refreshed.success) setUsers(refreshed.users);
    } else {
      setEditError(result.error || 'Failed to update user');
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUser) return;
    setDeleteLoading(true);
    setDeleteError('');
    const result = await userService.deleteUser(deleteUser.id);
    setDeleteLoading(false);
    if (result.success) {
      setDeleteUser(null);
      // Refresh users
      const refreshed = await userService.getAllUsers();
      if (refreshed.success) setUsers(refreshed.users);
    } else {
      setDeleteError(result.error || 'Failed to delete user');
    }
  };

  const handlePromoteToAdmin = async () => {
    if (!promoteUserId) return;
    setPromoteLoading(true);
    setPromoteError('');
    setPromoteSuccess('');
    const userToPromote = users.find(u => u.id === promoteUserId);
    if (!userToPromote) {
      setPromoteError('User not found.');
      setPromoteLoading(false);
      return;
    }
    const result = await userService.updateUser({ ...userToPromote, role: 'admin' });
    setPromoteLoading(false);
    if (result.success) {
      setPromoteSuccess(`${userToPromote.fullname} has been promoted to Admin.`);
      setPromoteUserId('');
      // Refresh users
      const refreshed = await userService.getAllUsers();
      if (refreshed.success) setUsers(refreshed.users);
    } else {
      setPromoteError(result.error || 'Failed to promote user');
    }
  };

  const handleViewUserAssets = async (user) => {
    setViewAssetsUser(user);
    setViewAssets([]);
    setViewAssetsError('');
    setViewAssetsLoading(true);
    const result = await assetService.getAssetsForUserId(user.id);
    if (result.success) {
      setViewAssets(result.assets);
    } else {
      setViewAssetsError(result.error || 'Failed to fetch assets');
    }
    setViewAssetsLoading(false);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 animate-fade-in">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-1 sm:mb-2">Users</h1>
          <p className="text-slate-400 text-sm sm:text-base">Manage user accounts and permissions</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            className="btn-primary bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="w-4 h-4" />
            Add User
          </button>
        </div>
      </div>

      {/* Statistics Cards - now using real data */}
      <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 animate-fade-up">
        <div className="glass-morphism p-6 rounded-xl border border-slate-700/30 shadow-glow hover:shadow-glow-intense transition-all duration-300 hover:scale-[1.02]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-400">Total Users</h3>
            <Users className="w-5 h-5 text-cyan-400" />
          </div>
          <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">{totalUsers}</p>
          <p className="text-sm text-green-400 mt-1">+5% from last month</p>
        </div>
        <div className="glass-morphism p-6 rounded-xl border border-slate-700/30 shadow-glow hover:shadow-glow-intense transition-all duration-300 hover:scale-[1.02]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-400">Active Users</h3>
            <div className="w-2 h-2 bg-green-400 rounded-full shadow-glow-green"></div>
          </div>
          <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600">{activeUsers}</p>
          <p className="text-sm text-slate-400 mt-1">
            {totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0}% of total
          </p>
        </div>
        <div className="glass-morphism p-6 rounded-xl border border-slate-700/30 shadow-glow hover:shadow-glow-intense transition-all duration-300 hover:scale-[1.02]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-400">Admins</h3>
            <div className="w-2 h-2 bg-red-400 rounded-full shadow-glow-red"></div>
          </div>
          <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-pink-600">{adminUsers}</p>
          <p className="text-sm text-slate-400 mt-1">
            {totalUsers > 0 ? Math.round((adminUsers / totalUsers) * 100) : 0}% of total
          </p>
        </div>
        <div className="glass-morphism p-6 rounded-xl border border-slate-700/30 shadow-glow hover:shadow-glow-intense transition-all duration-300 hover:scale-[1.02]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-400">New This Month</h3>
            <div className="w-2 h-2 bg-blue-400 rounded-full shadow-glow-blue"></div>
          </div>
          <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-600">{newThisMonth}</p>
          <p className="text-sm text-green-400 mt-1">+3 from last month</p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="glass-morphism p-6 rounded-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pl-10 w-full"
            />
          </div>
          <div className="flex items-center space-x-4">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="input-field"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="employee">Employee</option>
            </select>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="input-field"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <button
              className="border border-blue-500 text-blue-400 bg-transparent hover:bg-blue-500/10 font-medium rounded-lg px-4 py-2 ml-2 flex items-center gap-2 transition"
              onClick={() => {
                setSearchQuery('');
                setSelectedRole('all');
                setSelectedStatus('all');
              }}
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Promote to Admin - Compact and Aligned */}
      <div className="flex items-center justify-end space-x-2 mt-2 mb-4">
        <select
          className="input-field text-sm h-8 px-3 py-1 rounded-md border border-blue-400 focus:ring-2 focus:ring-blue-500 bg-slate-900"
          style={{ minWidth: 180 }}
          value={promoteUserId}
          onChange={e => setPromoteUserId(e.target.value)}
        >
          <option value="">Select employee to promote</option>
          {users.filter(u => u.role === 'employee').map(u => (
            <option key={u.id} value={u.id}>{u.fullname} ({u.email})</option>
          ))}
        </select>
        <button
          className="btn-primary text-sm h-8 px-4 py-1 rounded-md"
          disabled={!promoteUserId || promoteLoading}
          onClick={handlePromoteToAdmin}
        >
          {promoteLoading ? 'Promoting...' : 'Promote to Admin'}
        </button>
        {promoteError && <span className="text-red-400 text-xs ml-2">{promoteError}</span>}
        {promoteSuccess && <span className="text-green-400 text-xs ml-2">{promoteSuccess}</span>}
      </div>

      {/* Users Table */}
      <div className="glass-morphism rounded-xl overflow-hidden animate-fade-up" style={{ animationDelay: '0.2s' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800/50 border-b border-white/10">
              <tr>
                <th className="text-left py-4 px-3 text-sm font-medium text-slate-300 w-1/4">Users</th>
                <th className="text-left py-4 px-2 text-sm font-medium text-slate-300 w-16">Role</th>
                <th className="text-left py-4 px-2 text-sm font-medium text-slate-300 w-16">Status</th>
                <th className="text-left py-4 px-2 text-sm font-medium text-slate-300 w-24">Department</th>
                <th className="text-left py-4 px-2 text-sm font-medium text-slate-300 w-20">Last Login</th>
                <th className="text-left py-4 px-2 pl-6 text-sm font-medium text-slate-300 w-1/4">Contact</th>
                <th className="text-center py-4 px-3 text-sm font-medium text-slate-300 w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400">Loading users...</td></tr>
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user, index) => {
                  const getAnimationDelay = (i) => ({ animationDelay: `${i * 0.05}s` });
                  return (
                    <tr key={user.id} className="hover:bg-white/5 transition-colors animate-fade-up" style={getAnimationDelay(index)}>
                      <td className="py-4 px-3">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 flex items-center justify-center text-white font-medium text-xs flex-shrink-0">
                              {getInitials(user.fullname)}
                          </div>
                          <div className="min-w-0 flex-1">
                              <h3 className="text-sm font-medium text-white truncate">{user.fullname}</h3>
                            <p className="text-xs text-slate-400 truncate">{user.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-2">
                        {getRoleBadge(user.role)}
                      </td>
                      <td className="py-4 px-2">
                        {getStatusBadge(user.isActive)}
                      </td>
                      <td className="py-4 px-2">
                        <div className="flex items-center space-x-1">
                          <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <span className="text-sm text-slate-300 truncate">{user.department}</span>
                        </div>
                      </td>
                      <td className="py-4 px-2">
                        <span className="text-sm text-slate-300 whitespace-nowrap">
                          {user.lastLogin ? formatLastLogin(user.lastLogin) : 'Never'}
                        </span>
                      </td>
                      <td className="py-4 px-2 pl-6">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1">
                            <Mail className="w-3 h-3 text-slate-400 flex-shrink-0" />
                            <span className="text-xs text-slate-300 truncate">{user.email}</span>
                          </div>
                          {user.phone && (
                            <div className="flex items-center space-x-1">
                              <Phone className="w-3 h-3 text-slate-400 flex-shrink-0" />
                              <span className="text-xs text-slate-300 truncate">{user.phone}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button className="p-1.5 rounded-lg hover:bg-cyan-500/20 text-cyan-400 hover:text-white transition-colors" onClick={() => handleViewUserAssets(user)} title="View User Assets">
                            <FileText className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 rounded-lg hover:bg-blue-500/20 text-blue-400 hover:text-white transition-colors" onClick={() => setViewUser(user)}>
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 rounded-lg hover:bg-green-500/20 text-green-400 hover:text-white transition-colors" onClick={() => openEditModal(user)}>
                            <Edit className="w-4 h-4" />
                          </button>
                          <button className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 hover:text-white transition-colors" onClick={() => setDeleteUser(user)}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">No users found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 animate-fade-in p-2 sm:p-4">
          <div className="glass-morphism bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-xs sm:max-w-md md:max-w-lg max-h-[90vh] overflow-auto relative p-2 sm:p-4 md:p-8 animate-fade-up">
            <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-4">Add New User</h2>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Full Name</label>
                <input type="text" className="input-field w-full" required
                  value={addForm.fullname}
                  onChange={e => setAddForm(f => ({ ...f, fullname: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Email</label>
                <input type="email" className="input-field w-full" required
                  value={addForm.email}
                  onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Password</label>
                <input type="password" className="input-field w-full" required
                  value={addForm.password}
                  onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Department</label>
                <select
                  className="input-field w-full"
                  required
                  value={addForm.department}
                  onChange={e => setAddForm(f => ({ ...f, department: e.target.value }))}
                >
                  <option value="">Select Department</option>
                  {departmentOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Role</label>
                <select className="input-field w-full" value={addForm.role}
                  onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))}>
                  {roleOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Phone</label>
                <input type="text" className="input-field w-full"
                  value={addForm.phone}
                  onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))}
                />
              </div>
              {addError && <div className="text-red-400 text-sm">{addError}</div>}
              <div className="flex justify-end space-x-3 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)} disabled={addLoading}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={addLoading}>{addLoading ? 'Adding...' : 'Add User'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View User Modal */}
      {viewUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 animate-fade-in p-2 sm:p-4">
          <div className="glass-morphism bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-xs sm:max-w-md md:max-w-lg max-h-[90vh] overflow-auto relative p-2 sm:p-4 md:p-8 animate-fade-up">
            <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-4">User Details</h2>
            <div className="space-y-2 text-slate-200">
              <div><b>Full Name:</b> {viewUser.fullname}</div>
              <div><b>Email:</b> {viewUser.email}</div>
              <div><b>Username:</b> {viewUser.username}</div>
              <div><b>Role:</b> {viewUser.role}</div>
              <div><b>Department:</b> {viewUser.department}</div>
              <div><b>Phone:</b> {viewUser.phone}</div>
              <div><b>Status:</b> {viewUser.isActive ? 'Active' : 'Inactive'}</div>
              <div><b>Created At:</b> {viewUser.createdAt ? new Date(viewUser.createdAt).toLocaleString() : ''}</div>
            </div>
            <div className="flex justify-end space-x-3 pt-6">
              <button className="btn-secondary" onClick={() => setViewUser(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editUser && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 animate-fade-in p-2 sm:p-4">
          <div className="glass-morphism bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-xs sm:max-w-md md:max-w-lg max-h-[90vh] overflow-auto relative p-2 sm:p-4 md:p-8 animate-fade-up">
            <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-4">Edit User</h2>
            <form onSubmit={handleEditUser} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Full Name</label>
                <input type="text" className="input-field w-full" required
                  value={editForm.fullname}
                  onChange={e => setEditForm(f => ({ ...f, fullname: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Email</label>
                <input type="email" className="input-field w-full" required
                  value={editForm.email}
                  onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Department</label>
                <input type="text" className="input-field w-full"
                  value={editForm.department}
                  onChange={e => setEditForm(f => ({ ...f, department: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Role</label>
                <select className="input-field w-full" value={editForm.role}
                  onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Phone</label>
                <input type="text" className="input-field w-full"
                  value={editForm.phone}
                  onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Status</label>
                <select className="input-field w-full" value={editForm.isActive ? 'active' : 'inactive'}
                  onChange={e => setEditForm(f => ({ ...f, isActive: e.target.value === 'active' }))}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              {editError && <div className="text-red-400 text-sm">{editError}</div>}
              <div className="flex justify-end space-x-3 pt-2">
                <button type="button" className="btn-secondary" onClick={() => { setEditUser(null); setEditForm(null); }} disabled={editLoading}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={editLoading}>{editLoading ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {deleteUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 animate-fade-in p-2 sm:p-4">
          <div className="glass-morphism bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-xs sm:max-w-md md:max-w-lg max-h-[90vh] overflow-auto relative p-2 sm:p-4 md:p-8 animate-fade-up text-center">
            <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-pink-600 mb-4">Delete User</h2>
            <p className="text-slate-300 mb-6">Are you sure you want to delete <b>{deleteUser.fullname}</b>? This action cannot be undone.</p>
            {deleteError && <div className="text-red-400 text-sm mb-2">{deleteError}</div>}
            <div className="flex justify-end space-x-3 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setDeleteUser(null)} disabled={deleteLoading}>Cancel</button>
              <button type="button" className="btn-danger" onClick={handleDeleteUser} disabled={deleteLoading}>{deleteLoading ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {viewAssetsUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 animate-fade-in p-2 sm:p-4">
          {viewAssetsLoading ? (
            <div className="glass-morphism bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-xs sm:max-w-md md:max-w-lg max-h-[90vh] overflow-auto relative p-2 sm:p-4 md:p-8 animate-fade-up text-center">
              <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-4">Loading Assets...</h2>
              <p className="text-slate-300 mb-6">Please wait while we fetch the assets for {viewAssetsUser.fullname}.</p>
            </div>
          ) : viewAssetsError ? (
            <div className="glass-morphism bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-xs sm:max-w-md md:max-w-lg max-h-[90vh] overflow-auto relative p-2 sm:p-4 md:p-8 animate-fade-up text-center">
              <h2 className="text-xl font-bold text-red-400 mb-4">Error</h2>
              <p className="text-slate-300 mb-6">{viewAssetsError}</p>
              <button className="btn-secondary" onClick={() => setViewAssetsUser(null)}>Close</button>
            </div>
          ) : (
            <AllAssetsView assets={viewAssets} user={viewAssetsUser} onClose={() => setViewAssetsUser(null)} />
          )}
        </div>
      )}
    </div>
  );
};

export default UsersPage;