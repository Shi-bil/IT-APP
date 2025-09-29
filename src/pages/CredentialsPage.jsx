import React, { useState, useEffect } from 'react';
import { Shield, Plus, Search, Filter, MoreHorizontal, Edit, Trash2, Eye, EyeOff, Key, Globe, FileText, Lock, Copy } from 'lucide-react';
import credentialService from '../services/credentialService';

const CredentialsPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newCredential, setNewCredential] = useState({
    name: '',
      type: 'password',
    username: '',
    password: '',
    url: '',
      category: 'Database',
    notes: ''
  });
  const [editingCredential, setEditingCredential] = useState(null);
  const [credentials, setCredentials] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch credentials on component mount
  useEffect(() => {
    fetchCredentials();
  }, []);

  const fetchCredentials = async () => {
    setIsLoading(true);
    try {
      const result = await credentialService.getAllCredentials();
      if (result.success) {
        setCredentials(result.credentials);
        setError(null);
      } else {
        setError(result.error || 'Failed to fetch credentials');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const getTypeIcon = (type) => {
    const icons = {
      password: Key,
      'api-key': Globe,
      certificate: FileText,
      'ssh-key': Lock,
    };
    
    return icons[type] || Key;
  };

  const getTypeBadge = (type) => {
    const typeClasses = {
      password: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      'api-key': 'bg-green-500/20 text-green-300 border-green-500/30',
      certificate: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      'ssh-key': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${typeClasses[type]}`}>
        {type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
      </span>
    );
  };

  const formatTimeAgo = (date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
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
      return date.toLocaleDateString();
    }
  };

  const isExpiringSoon = (expiryDate) => {
    if (!expiryDate) return false;
    const now = new Date();
    const diffDays = Math.floor((expiryDate.getTime() - now.getTime()) / 86400000);
    return diffDays <= 30;
  };

  const isExpired = (expiryDate) => {
    if (!expiryDate) return false;
    return expiryDate < new Date();
  };

  const togglePasswordVisibility = (id) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        // Could add a toast notification here
        console.log('Copied to clipboard');
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
      });
  };

  const addNewCredential = async () => {
    try {
      const result = await credentialService.createCredential(newCredential);
      
      if (result.success) {
        // Refresh credentials list
        await fetchCredentials();
        
        // Reset form and close modal
        setShowAddModal(false);
        setNewCredential({
          name: '',
          type: 'password',
          username: '',
          password: '',
          url: '',
          category: 'Database',
          notes: ''
        });
      } else {
        setError(result.error || 'Failed to add credential');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error(err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setNewCredential(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditingCredential(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const openEditModal = (credential) => {
    // Create a copy of the credential for editing
    setEditingCredential({
      id: credential.id,
      name: credential.name,
      type: credential.type,
      username: credential.username || '',
      password: credential.password,
      url: credential.url || '',
      category: credential.category,
      notes: credential.notes || '',
      expiryDate: credential.expiryDate ? new Date(credential.expiryDate).toISOString().split('T')[0] : ''
    });
    setShowEditModal(true);
  };

  const updateCredential = async () => {
    try {
      const result = await credentialService.updateCredential(editingCredential.id, editingCredential);
      
      if (result.success) {
        // Update the credential in the local state
        setCredentials(prev => 
          prev.map(cred => 
            cred.id === editingCredential.id ? result.credential : cred
          )
        );
        
        // Close modal
        setShowEditModal(false);
        setEditingCredential(null);
      } else {
        setError(result.error || 'Failed to update credential');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error(err);
    }
  };

  const deleteCredential = async (id) => {
    try {
      const result = await credentialService.deleteCredential(id);
      
      if (result.success) {
        // Remove from local state
        setCredentials(prev => prev.filter(cred => cred.id !== id));
      } else {
        setError(result.error || 'Failed to delete credential');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error(err);
    }
  };

  const filteredCredentials = credentials.filter(credential => {
    const matchesSearch = credential.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         credential.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (credential.username && credential.username.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = selectedType === 'all' || credential.type === selectedType;
    const matchesCategory = selectedCategory === 'all' || credential.category === selectedCategory;
    
    return matchesSearch && matchesType && matchesCategory;
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 animate-fade-in">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-1 sm:mb-2">Password Manager</h1>
          <p className="text-slate-400 text-sm sm:text-base">Secure storage for passwords, API keys, and certificates</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <button 
            className="btn-primary bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 hover:scale-105 transition-all duration-300"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="w-4 h-4 inline-block mr-1" /> Add Credential
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6 animate-fade-up">
        <div className="glass-morphism p-6 rounded-xl border border-slate-700/30 shadow-glow hover:shadow-glow-intense transition-all duration-300 hover:scale-[1.02]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-400">Total Credentials</h3>
            <Shield className="w-5 h-5 text-cyan-400" />
          </div>
          <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">{credentials.length}</p>
          <p className="text-sm text-green-400 mt-1">Safely stored</p>
        </div>
        <div className="glass-morphism p-6 rounded-xl border border-slate-700/30 shadow-glow hover:shadow-glow-intense transition-all duration-300 hover:scale-[1.02]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-400">Encrypted</h3>
            <div className="w-2 h-2 bg-green-400 rounded-full shadow-glow-green"></div>
          </div>
          <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600">{credentials.filter(c => c.isEncrypted).length}</p>
          <p className="text-sm text-green-400 mt-1">100% secured</p>
        </div>
        <div className="glass-morphism p-6 rounded-xl border border-slate-700/30 shadow-glow hover:shadow-glow-intense transition-all duration-300 hover:scale-[1.02]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-400">Expiring Soon</h3>
            <div className="w-2 h-2 bg-yellow-400 rounded-full shadow-glow-yellow"></div>
          </div>
          <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-600">{credentials.filter(c => isExpiringSoon(c.expiryDate)).length}</p>
          <p className="text-sm text-yellow-400 mt-1">Within 30 days</p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="glass-morphism p-6 rounded-xl border border-slate-700/30 shadow-glow animate-fade-up" style={{ animationDelay: '0.1s' }}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search credentials..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pl-10 w-full bg-slate-800/50 border border-slate-700/50 focus:border-cyan-500/50 focus:ring focus:ring-cyan-500/20 transition-all duration-300"
            />
            {(searchQuery || selectedType !== 'all' || selectedCategory !== 'all') && (
              <button 
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedType('all');
                  setSelectedCategory('all');
                }}
                title="Reset filters"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </button>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="input-field bg-slate-800/50 border border-slate-700/50 focus:border-cyan-500/50 focus:ring focus:ring-cyan-500/20 transition-all duration-300"
            >
              <option value="all">All Types</option>
              <option value="password">Password</option>
              <option value="api-key">API Key</option>
              <option value="certificate">Certificate</option>
              <option value="ssh-key">SSH Key</option>
            </select>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input-field bg-slate-800/50 border border-slate-700/50 focus:border-cyan-500/50 focus:ring focus:ring-cyan-500/20 transition-all duration-300"
            >
              <option value="all">All Categories</option>
              <option value="Database">Database</option>
              <option value="Cloud Services">Cloud Services</option>
              <option value="Security">Security</option>
              <option value="Infrastructure">Infrastructure</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading and Error States */}
      {isLoading && (
        <div className="glass-morphism p-12 rounded-xl text-center border border-slate-700/30 shadow-glow animate-pulse">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 bg-cyan-500/20 rounded-full animate-ping"></div>
            <Shield className="w-16 h-16 text-cyan-400 mx-auto relative animate-spin" />
          </div>
          <h3 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-2">Loading credentials...</h3>
          <p className="text-slate-500">Please wait while AI processes your data</p>
        </div>
      )}

      {error && (
        <div className="glass-morphism p-6 rounded-xl bg-red-500/10 border border-red-500/30 shadow-glow-error animate-fade-in">
          <Shield className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <h3 className="text-xl font-semibold text-red-400 mb-2">Error loading credentials</h3>
          <p className="text-slate-500 mb-6">{error}</p>
          <button 
            className="btn-primary bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 hover:scale-105 transition-all duration-300"
            onClick={fetchCredentials}
          >
            Retry
          </button>
        </div>
      )}

      {/* Credentials List */}
      {!isLoading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6 animate-fade-up">
        {filteredCredentials.map((credential, index) => {
          const TypeIcon = getTypeIcon(credential.type);
          const expired = isExpired(credential.expiryDate);
          const expiringSoon = isExpiringSoon(credential.expiryDate);
          const isVisible = visiblePasswords[credential.id];
          const getAnimationDelay = (i) => ({ animationDelay: `${i * 0.05}s` });
          
          return (
              <div key={credential.id} className="glass-morphism p-5 rounded-xl hover:shadow-glow-intense transition-all duration-300 hover:scale-[1.03] flex flex-col items-stretch relative animate-fade-up" style={getAnimationDelay(index)}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600 flex items-center justify-center">
                      <TypeIcon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">{credential.name}</h3>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button 
                      className="p-1 rounded-lg glass-morphism-hover text-green-400 hover:text-white transition-colors"
                      onClick={() => openEditModal(credential)}
                      title="Edit"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      className="p-1 rounded-lg glass-morphism-hover text-red-400 hover:text-white transition-colors"
                      onClick={() => deleteCredential(credential.id)}
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2 mb-3">
                      {getTypeBadge(credential.type)}
                      {credential.isEncrypted && (
                        <div className="flex items-center space-x-1 px-2 py-1 bg-green-500/20 text-green-300 border border-green-500/30 rounded-full text-xs">
                          <Shield className="w-3 h-3" />
                          <span>Encrypted</span>
                        </div>
                      )}
                      {expired && (
                        <div className="px-2 py-1 bg-red-500/20 text-red-300 border border-red-500/30 rounded-full text-xs">
                          Expired
                        </div>
                      )}
                      {expiringSoon && !expired && (
                        <div className="px-2 py-1 bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 rounded-full text-xs">
                          Expires Soon
                        </div>
                      )}
                    </div>
                
                <div className="flex-1">
                    {credential.username && (
                      <p className="text-sm text-slate-400 mb-1">Username: {credential.username}</p>
                    )}
                    {credential.url && (
                      <p className="text-sm text-slate-400 mb-1">URL: {credential.url}</p>
                    )}
                  {credential.password && (
                    <div className="flex flex-col mb-2">
                      <p className="text-sm text-slate-400 mb-1">Password:</p>
                <div className="flex items-center space-x-2">
                        <input 
                          type={isVisible ? "text" : "password"} 
                          value={credential.password} 
                          readOnly
                          className="bg-slate-800/50 rounded px-2 py-1 text-sm border border-slate-700 w-full"
                        />
                        <button 
                          className="p-1.5 rounded-lg glass-morphism-hover text-slate-400 hover:text-white transition-colors border border-slate-600 flex-shrink-0"
                          onClick={() => togglePasswordVisibility(credential.id)}
                          title={isVisible ? "Hide password" : "Show password"}
                        >
                          {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                        <button 
                          className="p-1.5 rounded-lg glass-morphism-hover text-slate-400 hover:text-white transition-colors border border-slate-600 flex-shrink-0"
                          onClick={() => copyToClipboard(credential.password)}
                          title="Copy to clipboard"
                        >
                          <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
                  )}
                  <p className="text-sm text-slate-500">Category: {credential.category}</p>
                </div>

                {credential.notes && (
                  <div className="mt-3 p-2 bg-slate-700/30 rounded-lg">
                    <p className="text-xs text-slate-300">{credential.notes}</p>
                  </div>
                )}
                
                <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between text-xs text-slate-500">
                  <span>{new Date(credential.createdAt).toLocaleDateString()}</span>
                  {credential.expiryDate && (
                    <span>Expires: {new Date(credential.expiryDate).toLocaleDateString()}</span>
                  )}
                </div>
            </div>
          );
        })}
      </div>
      )}

      {!isLoading && !error && filteredCredentials.length === 0 && (
        <div className="glass-morphism p-12 rounded-xl text-center border border-slate-700/30 shadow-glow animate-fade-up" style={{ animationDelay: '0.3s' }}>
          <Shield className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-slate-400 to-slate-600 mb-2">No credentials found</h3>
          <p className="text-slate-500 mb-6">Try adjusting your search criteria or add a new credential.</p>
          <button 
            className="btn-primary bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 hover:scale-105 transition-all duration-300"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="w-5 h-5 mr-2" />
            <span className="text-base font-medium">Add First Credential</span>
          </button>
        </div>
      )}

      {/* Add Credential Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 animate-fade-in p-2 sm:p-4">
          <div className="glass-morphism bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-xs sm:max-w-md md:max-w-4xl max-h-[90vh] overflow-auto relative p-2 sm:p-4 md:p-8 animate-fade-up">
            <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-5">Add New Credential</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Name</label>
                <input 
                  type="text" 
                  name="name"
                  value={newCredential.name}
                  onChange={handleChange}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 px-3 w-full text-white focus:outline-none focus:ring-1 focus:ring-cyan-500" 
                  placeholder="Credential name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Type</label>
                <select 
                  name="type"
                  value={newCredential.type}
                  onChange={handleChange}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 px-3 w-full text-white appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  style={{ backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em" }}
                >
                  <option value="password">Password</option>
                  <option value="api-key">API Key</option>
                  <option value="certificate">Certificate</option>
                  <option value="ssh-key">SSH Key</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Category</label>
                <select 
                  name="category"
                  value={newCredential.category}
                  onChange={handleChange}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 px-3 w-full text-white appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  style={{ backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em" }}
                >
                  <option value="Database">Database</option>
                  <option value="Cloud Services">Cloud Services</option>
                  <option value="Security">Security</option>
                  <option value="Infrastructure">Infrastructure</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Username</label>
                <input 
                  type="text" 
                  name="username"
                  value={newCredential.username}
                  onChange={handleChange}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 px-3 w-full text-white focus:outline-none focus:ring-1 focus:ring-cyan-500" 
                  placeholder="Username (if applicable)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Password/Key</label>
                <input 
                  type="password" 
                  name="password"
                  value={newCredential.password}
                  onChange={handleChange}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 px-3 w-full text-white focus:outline-none focus:ring-1 focus:ring-cyan-500" 
                  placeholder="Enter password or key"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">URL (optional)</label>
                <input 
                  type="text" 
                  name="url"
                  value={newCredential.url}
                  onChange={handleChange}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 px-3 w-full text-white focus:outline-none focus:ring-1 focus:ring-cyan-500" 
                  placeholder="https://example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Expiry Date (optional)</label>
                <input 
                  type="date" 
                  name="expiryDate"
                  value={newCredential.expiryDate || ''}
                  onChange={handleChange}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 px-3 w-full text-white focus:outline-none focus:ring-1 focus:ring-cyan-500" 
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-400 mb-1">Notes (optional)</label>
                <textarea 
                  name="notes"
                  value={newCredential.notes}
                  onChange={handleChange}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 px-3 w-full text-white focus:outline-none focus:ring-1 focus:ring-cyan-500" 
                  rows="2"
                  placeholder="Add any additional notes here"
                ></textarea>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button 
                className="btn-secondary backdrop-blur-sm hover:scale-105 transition-all"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </button>
              <button 
                className="btn-primary bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 hover:scale-105 transition-all duration-300"
                onClick={addNewCredential}
                disabled={!newCredential.name || !newCredential.password}
              >
                Add Credential
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Credential Modal */}
      {showEditModal && editingCredential && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 animate-fade-in p-2 sm:p-4">
          <div className="glass-morphism bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-xs sm:max-w-md md:max-w-4xl max-h-[90vh] overflow-auto relative p-2 sm:p-4 md:p-8 animate-fade-up">
            <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-5">Edit Credential</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Name</label>
                <input 
                  type="text" 
                  name="name"
                  value={editingCredential.name}
                  onChange={handleEditChange}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 px-3 w-full text-white focus:outline-none focus:ring-1 focus:ring-cyan-500" 
                  placeholder="Credential name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Type</label>
                <select 
                  name="type"
                  value={editingCredential.type}
                  onChange={handleEditChange}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 px-3 w-full text-white appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  style={{ backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em" }}
                >
                  <option value="password">Password</option>
                  <option value="api-key">API Key</option>
                  <option value="certificate">Certificate</option>
                  <option value="ssh-key">SSH Key</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Category</label>
                <select 
                  name="category"
                  value={editingCredential.category}
                  onChange={handleEditChange}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 px-3 w-full text-white appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  style={{ backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em" }}
                >
                  <option value="Database">Database</option>
                  <option value="Cloud Services">Cloud Services</option>
                  <option value="Security">Security</option>
                  <option value="Infrastructure">Infrastructure</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Username</label>
                <input 
                  type="text" 
                  name="username"
                  value={editingCredential.username}
                  onChange={handleEditChange}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 px-3 w-full text-white focus:outline-none focus:ring-1 focus:ring-cyan-500" 
                  placeholder="Username (if applicable)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Password/Key</label>
                <div className="flex items-center space-x-2">
                  <input 
                    type={visiblePasswords.edit ? "text" : "password"} 
                    name="password"
                    value={editingCredential.password}
                    onChange={handleEditChange}
                    className="bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 px-3 w-full text-white focus:outline-none focus:ring-1 focus:ring-cyan-500" 
                    placeholder="Enter password or key"
                  />
                  <button 
                    className="bg-slate-800/50 border border-slate-700/50 p-2 rounded-lg text-slate-400 hover:text-white transition-colors flex-shrink-0"
                    onClick={() => setVisiblePasswords(prev => ({
                      ...prev,
                      edit: !prev.edit
                    }))}
                    title={visiblePasswords.edit ? "Hide password" : "Show password"}
                  >
                    {visiblePasswords.edit ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">URL (optional)</label>
                <input 
                  type="text" 
                  name="url"
                  value={editingCredential.url}
                  onChange={handleEditChange}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 px-3 w-full text-white focus:outline-none focus:ring-1 focus:ring-cyan-500" 
                  placeholder="https://example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Expiry Date (optional)</label>
                <input 
                  type="date" 
                  name="expiryDate"
                  value={editingCredential.expiryDate || ''}
                  onChange={handleEditChange}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 px-3 w-full text-white focus:outline-none focus:ring-1 focus:ring-cyan-500" 
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-400 mb-1">Notes (optional)</label>
                <textarea 
                  name="notes"
                  value={editingCredential.notes}
                  onChange={handleEditChange}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 px-3 w-full text-white focus:outline-none focus:ring-1 focus:ring-cyan-500" 
                  rows="2"
                  placeholder="Add any additional notes here"
                ></textarea>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button 
                className="btn-secondary backdrop-blur-sm hover:scale-105 transition-all"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingCredential(null);
                }}
              >
                Cancel
              </button>
              <button 
                className="btn-primary bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 hover:scale-105 transition-all duration-300"
                onClick={updateCredential}
                disabled={!editingCredential.name || !editingCredential.password}
              >
                Update Credential
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CredentialsPage;