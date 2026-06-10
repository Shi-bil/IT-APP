import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, Plus, Search, Filter, MoreHorizontal, Edit, Trash2, Eye, Mail, Phone, MapPin, RotateCcw, Package, FolderKanban, FileText, UserCheck, UserPlus, Shield } from 'lucide-react';
import { userService } from '../services/userService';
import AllAssetsView from '../components/AllAssetsView';
import { assetService } from '../services/assetService';
import useTabRefresh from '../hooks/useTabRefresh';

const UsersPage = () => {
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
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
    { value: 'AI', label: 'AI' },
    { value: 'Others', label: 'Others' }
  ];

  // Role options for dropdown
  const roleOptions = [
    { value: 'employee', label: 'Employee' },
    { value: 'manager', label: 'Manager' },
    { value: 'admin', label: 'Admin' }
  ];

  const fetchUsers = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const result = await userService.getAllUsers();
    if (result.success) {
      setUsers(result.users);
    }
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Real-time sync: poll every 5s (cross-device) + instant when another tab mutates.
  useTabRefresh(() => fetchUsers(true));

  // Update search query from URL params
  useEffect(() => {
    const urlSearch = searchParams.get('search');
    if (urlSearch) {
      setSearchQuery(urlSearch);
    }
  }, [searchParams]);

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

  // Highlight search match with transparent yellow
  const highlightSearch = (text, search) => {
    if (!text || typeof text !== 'string') return text;
    const q = search && search.trim();
    if (!q) return text;
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = String(text).split(regex);
    if (parts.length === 1) return text;
    return parts.map((part, i) =>
      i % 2 === 1 ? (
        <span key={i} className="bg-yellow-400/25 rounded px-0.5">{part}</span>
      ) : (
        part
      )
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
    
    // Check if user was created this month
    const now = new Date();
    const createdDate = new Date(user.createdAt);
    const isNewThisMonth = createdDate.getMonth() === now.getMonth() && createdDate.getFullYear() === now.getFullYear();
    
    const matchesStatus =
      selectedStatus === 'all' ||
      (selectedStatus === 'active' && user.isActive) ||
      (selectedStatus === 'inactive' && !user.isActive) ||
      (selectedStatus === 'new' && isNewThisMonth);
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
    // Use id or _id as fallback
    const userId = deleteUser.id || deleteUser._id;
    console.log('Attempting to delete user:', { id: userId, user: deleteUser });
    if (!userId) {
      setDeleteError('User ID is missing');
      setDeleteLoading(false);
      return;
    }
    const result = await userService.deleteUser(userId);
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

  const handlePromoteOrDemote = async () => {
    if (!promoteUserId) return;
    setPromoteLoading(true);
    setPromoteError('');
    setPromoteSuccess('');
    const selectedUser = users.find(u => u.id === promoteUserId || u._id === promoteUserId);
    if (!selectedUser) {
      setPromoteError('User not found.');
      setPromoteLoading(false);
      return;
    }
    const isAdmin = selectedUser.role === 'admin';
    const newRole = isAdmin ? 'employee' : 'admin';
    const result = await userService.updateUser({ ...selectedUser, role: newRole });
    setPromoteLoading(false);
    if (result.success) {
      setPromoteSuccess(isAdmin 
        ? `${selectedUser.fullname} has been demoted to Employee.`
        : `${selectedUser.fullname} has been promoted to Admin.`
      );
      setPromoteUserId('');
      // Refresh users
      const refreshed = await userService.getAllUsers();
      if (refreshed.success) setUsers(refreshed.users);
    } else {
      setPromoteError(result.error || (isAdmin ? 'Failed to demote user' : 'Failed to promote user'));
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
      <div className="flex flex-row items-center justify-between gap-2 sm:gap-4 animate-fade-in">
        <div className="flex-shrink-0 min-w-0">
          <h1 className="text-xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-0.5 sm:mb-2 truncate">Users</h1>
          <p className="text-slate-400 text-xs sm:text-base truncate">Manage user accounts</p>
        </div>
        <div className="flex flex-row items-center gap-2 sm:gap-3 flex-shrink-0">
          <button
            className="btn-primary bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 hover:scale-105 transition-all duration-300 flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-2.5 sm:px-4 py-2 whitespace-nowrap"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden xs:inline">Add User</span><span className="xs:hidden">Add</span>
          </button>
        </div>
      </div>

      {/* Statistics Cards - Compact horizontal layout - Click to filter */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 animate-fade-up">
        {/* Total Users Card */}
        <div 
          onClick={() => { setSelectedStatus('all'); setSelectedRole('all'); }}
          className={`glass-morphism rounded-lg sm:rounded-xl border shadow-glow hover:shadow-glow-intense transition-all duration-300 hover:scale-[1.02] p-2 sm:p-4 flex flex-row items-center active:scale-95 cursor-pointer group ${
            selectedStatus === 'all' && selectedRole === 'all' 
              ? 'border-cyan-500/60 ring-2 ring-cyan-500/30 bg-cyan-500/10' 
              : 'border-cyan-500/20'
          }`}
        >
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center bg-gradient-to-r from-cyan-500 to-blue-600 shadow-lg flex-shrink-0">
            <Users className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div className="flex flex-col items-end flex-1 ml-2 sm:ml-3">
            <span className="text-lg sm:text-xl font-bold text-white">{totalUsers}</span>
            <span className="text-[9px] sm:text-xs text-cyan-200/80 uppercase font-medium">TOTAL</span>
          </div>
        </div>

        {/* Active Users Card */}
        <div 
          onClick={() => { setSelectedStatus(selectedStatus === 'active' ? 'all' : 'active'); setSelectedRole('all'); }}
          className={`glass-morphism rounded-lg sm:rounded-xl border shadow-glow hover:shadow-glow-intense transition-all duration-300 hover:scale-[1.02] p-2 sm:p-4 flex flex-row items-center active:scale-95 cursor-pointer group ${
            selectedStatus === 'active' 
              ? 'border-green-500/60 ring-2 ring-green-500/30 bg-green-500/10' 
              : 'border-green-500/20'
          }`}
        >
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg flex-shrink-0">
            <UserCheck className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div className="flex flex-col items-end flex-1 ml-2 sm:ml-3">
            <span className="text-lg sm:text-xl font-bold text-white">{activeUsers}</span>
            <span className="text-[9px] sm:text-xs text-green-200/80 uppercase font-medium">ACTIVE</span>
          </div>
        </div>

        {/* Admins Card */}
        <div 
          onClick={() => { setSelectedRole(selectedRole === 'admin' ? 'all' : 'admin'); setSelectedStatus('all'); }}
          className={`glass-morphism rounded-lg sm:rounded-xl border shadow-glow hover:shadow-glow-intense transition-all duration-300 hover:scale-[1.02] p-2 sm:p-4 flex flex-row items-center active:scale-95 cursor-pointer group ${
            selectedRole === 'admin' 
              ? 'border-red-500/60 ring-2 ring-red-500/30 bg-red-500/10' 
              : 'border-red-500/20'
          }`}
        >
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center bg-gradient-to-r from-red-500 to-pink-600 shadow-lg flex-shrink-0">
            <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div className="flex flex-col items-end flex-1 ml-2 sm:ml-3">
            <span className="text-lg sm:text-xl font-bold text-white">{adminUsers}</span>
            <span className="text-[9px] sm:text-xs text-red-200/80 uppercase font-medium">ADMINS</span>
          </div>
        </div>

        {/* New This Month Card */}
        <div 
          onClick={() => { setSelectedStatus(selectedStatus === 'new' ? 'all' : 'new'); setSelectedRole('all'); }}
          className={`glass-morphism rounded-lg sm:rounded-xl border shadow-glow hover:shadow-glow-intense transition-all duration-300 hover:scale-[1.02] p-2 sm:p-4 flex flex-row items-center active:scale-95 cursor-pointer group ${
            selectedStatus === 'new' 
              ? 'border-blue-500/60 ring-2 ring-blue-500/30 bg-blue-500/10' 
              : 'border-blue-500/20'
          }`}
        >
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center bg-gradient-to-r from-blue-500 to-indigo-600 shadow-lg flex-shrink-0">
            <UserPlus className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div className="flex flex-col items-end flex-1 ml-2 sm:ml-3">
            <span className="text-lg sm:text-xl font-bold text-white">{newThisMonth}</span>
            <span className="text-[9px] sm:text-xs text-blue-200/80 uppercase font-medium">NEW</span>
          </div>
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
              <option value="new">New This Month</option>
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

      {/* Promote/Demote Admin - Compact and Aligned */}
      <div className="flex items-center justify-end space-x-2 mt-2 mb-4">
        <select
          className="input-field text-sm h-8 px-3 py-1 rounded-md border border-blue-400 focus:ring-2 focus:ring-blue-500 bg-slate-900"
          style={{ minWidth: 180 }}
          value={promoteUserId}
          onChange={e => setPromoteUserId(e.target.value)}
        >
          <option value="" key="promote-default">Select user</option>
          {users.filter(u => u.role === 'employee' || u.role === 'admin').map(u => (
            <option key={u.id || u._id} value={u.id || u._id}>
              {u.fullname} ({u.email}) - {u.role === 'admin' ? 'Admin' : 'Employee'}
            </option>
          ))}
        </select>
        {(() => {
          const selectedUser = users.find(u => u.id === promoteUserId || u._id === promoteUserId);
          const isAdmin = selectedUser?.role === 'admin';
          return (
            <button
              className={`text-xs sm:text-sm h-8 px-2 sm:px-4 py-1 rounded-md whitespace-nowrap ${isAdmin 
                ? 'bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white' 
                : 'btn-primary'}`}
              disabled={!promoteUserId || promoteLoading}
              onClick={handlePromoteOrDemote}
            >
              {promoteLoading 
                ? (isAdmin ? 'Revoking...' : 'Promoting...') 
                : (isAdmin ? 'Revoke' : 'Promote')}
            </button>
          );
        })()}
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
                              <h3 className="text-sm font-medium text-white truncate">{highlightSearch(user.fullname, searchQuery)}</h3>
                            <p className="text-xs text-slate-400 truncate">{highlightSearch(user.username, searchQuery)}</p>
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
                            <span className="text-xs text-slate-300 truncate">{highlightSearch(user.email, searchQuery)}</span>
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
                          <button className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 hover:text-white transition-colors" onClick={() => {
                            console.log('Delete button clicked for user:', user);
                            setDeleteUser(user);
                          }}>
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
                  autoComplete="new-password"
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
                <select className="input-field w-full"
                  value={editForm.department}
                  onChange={e => setEditForm(f => ({ ...f, department: e.target.value }))}>
                  <option value="">Select Department</option>
                  {departmentOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
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