import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Shield, Plus, Search, Filter, MoreHorizontal, Edit, Trash2, Eye, EyeOff, Key, Globe, FileText, Lock, Copy, Users, LockOpen, Clock, Server, RotateCcw, Cloud, Mail, Boxes, ArrowLeft, ChevronRight, LayoutGrid, Layers, LogIn, Share2 } from 'lucide-react';
import credentialService from '../services/credentialService';
import { userService } from '../services/userService';
import { useAuth } from '../contexts/AuthContext';
import SuggestInput from '../components/SuggestInput';
import toast from 'react-hot-toast';

const CredentialsPage = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const isAdmin = user?.role === 'admin';
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [addModalStep, setAddModalStep] = useState(1); // Step 1: Category, Step 2: Details
  const [newCredential, setNewCredential] = useState({
    name: '',
    type: 'password',
    username: '',
    password: '',
    url: '',
    ip: '',
    port: '',
    category: '',
    notes: '',
    expiryDate: '',
    isPrivate: true,
    sharedWithUserIds: []
  });

  // Category definitions with icons and fields
  const credentialCategories = [
    {
      id: 'Email',
      name: 'Email',
      icon: Mail,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-500/20',
      borderColor: 'border-blue-500/30',
      description: 'Email accounts & SMTP credentials'
    },
    {
      id: 'Security',
      name: 'Security', 
      icon: Shield, 
      color: 'from-purple-500 to-pink-500',
      bgColor: 'bg-purple-500/20',
      borderColor: 'border-purple-500/30',
      description: 'API keys, certificates & tokens'
    },
    { 
      id: 'Cloud Services', 
      name: 'Cloud Services', 
      icon: Cloud, 
      color: 'from-cyan-500 to-blue-500',
      bgColor: 'bg-cyan-500/20',
      borderColor: 'border-cyan-500/30',
      description: 'AWS, Azure, GCP & cloud platforms'
    },
    { 
      id: 'Custom', 
      name: 'Others', 
      icon: Boxes, 
      color: 'from-slate-500 to-slate-600',
      bgColor: 'bg-slate-500/20',
      borderColor: 'border-slate-500/30',
      description: 'Other credentials & passwords'
    },
  ];
  const [editingCredential, setEditingCredential] = useState(null);
  const [credentials, setCredentials] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [togglingCredentialId, setTogglingCredentialId] = useState(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({ show: false, credential: null });
  const [expandedCategory, setExpandedCategory] = useState(null); // Track which category stack is expanded
  const [viewMode, setViewMode] = useState('stack'); // 'stack' for stacked cards, 'grid' for flat grid
  const [hoveredStack, setHoveredStack] = useState({ key: null, backIndex: null }); // which stack and which back card is hovered

  const suggestions = useMemo(() => ({
    name: credentials.map((c) => c.name),
    username: credentials.map((c) => c.username),
    url: credentials.map((c) => c.url),
    ip: credentials.map((c) => c.ip),
    port: credentials.map((c) => c.port),
  }), [credentials]);

  // Group credentials by category
  const groupedCredentials = credentials.reduce((groups, credential) => {
    const category = credential.category || 'Custom';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(credential);
    return groups;
  }, {});

  // Get category config by ID
  const getCategoryConfig = (categoryId) => {
    return credentialCategories.find(c => c.id === categoryId) || credentialCategories.find(c => c.id === 'Custom');
  };

  // Highlight search match in text with yellow (used when searchQuery is set)
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

  // Toggle expanded category
  const toggleCategoryExpand = (categoryId) => {
    setExpandedCategory(prev => prev === categoryId ? null : categoryId);
  };

  // Render a single credential card
  const renderCredentialCard = (credential, index) => {
    const TypeIcon = getTypeIcon(credential.type);
    const expired = isExpired(credential.expiryDate);
    const expiringSoon = isExpiringSoon(credential.expiryDate);
    const isVisible = visiblePasswords[credential.id];
    
    return (
      <div 
        key={credential.id} 
        className="group relative rounded-xl border border-cyan-500/20 backdrop-blur-xl transition-all duration-300 hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/5 flex flex-col animate-fade-up overflow-hidden" 
        style={{ 
          animationDelay: `${index * 0.04}s`,
          background: 'linear-gradient(145deg, rgba(15,23,42,0.95) 0%, rgba(30,41,59,0.9) 100%)',
        }}
      >
        {/* Header Section - single row, options aligned */}
        <div className="relative p-3 sm:p-4 pb-3">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-slate-800/80 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
                <TypeIcon className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm sm:text-base font-semibold text-white truncate">{highlightSearch(credential.name, searchQuery)}</h3>
                <p className="text-xs text-slate-400 truncate">{highlightSearch(credential.category, searchQuery)}</p>
              </div>
            </div>
            {/* Action Buttons - fixed size, single row */}
            <div className="flex items-center flex-shrink-0 gap-0.5">
              <button
                className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-200 touch-manipulation ${
                  copiedId === `${credential.id}-share` ? 'bg-emerald-500/20 text-emerald-400' : 'text-sky-400 hover:bg-sky-500/20'
                }`}
                onClick={(e) => { e.stopPropagation(); shareCredential(credential); }}
                title="Share username & password"
              >
                <Share2 className="w-4 h-4" />
              </button>
              {credential.canEdit && (
                <>
                  {isAdmin && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleCredentialSharing(credential); }}
                      disabled={togglingCredentialId === credential.id}
                      className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-200 disabled:opacity-50 touch-manipulation ${
                        credential.isPrivate
                          ? 'text-amber-400 hover:bg-amber-500/20'
                          : 'text-emerald-400 hover:bg-emerald-500/20'
                      }`}
                      title={credential.isPrivate ? "Make shared" : "Make private"}
                    >
                      {credential.isPrivate ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}
                    </button>
                  )}
                  <button
                    className="w-9 h-9 flex items-center justify-center rounded-lg text-cyan-400 hover:bg-cyan-500/20 transition-all duration-200 touch-manipulation"
                    onClick={(e) => { e.stopPropagation(); openEditModal(credential); }}
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    className="w-9 h-9 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-500/20 transition-all duration-200 touch-manipulation"
                    onClick={(e) => { e.stopPropagation(); deleteCredential(credential.id); }}
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mx-3 sm:mx-4 border-t border-slate-700/30" />
        
        {/* Content Section - compact padding and clear row layout to avoid overlap */}
        <div className="relative p-3 sm:p-4 pt-3 flex-1 space-y-2.5 sm:space-y-3 min-h-0">
          {credential.username && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-slate-500 w-14 sm:w-16 flex-shrink-0">Username</span>
              <div className="flex-1 flex items-center gap-1 min-w-0 overflow-hidden">
                <p className="text-sm text-slate-200 font-mono truncate min-w-0 flex-1">{highlightSearch(credential.username, searchQuery)}</p>
                <button 
                  className={`w-9 h-9 flex items-center justify-center rounded-lg flex-shrink-0 touch-manipulation ${
                    copiedId === `${credential.id}-username` ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                  onClick={(e) => { e.stopPropagation(); copyToClipboard(credential.username, credential.id, 'username'); }}
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          
          {credential.password && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-slate-500 w-14 sm:w-16 flex-shrink-0">Password</span>
              <div className="flex-1 flex items-center gap-1 min-w-0 overflow-hidden">
                <input 
                  type={isVisible ? "text" : "password"} 
                  value={credential.password} 
                  readOnly
                  className="flex-1 min-w-[60px] h-9 bg-slate-900/50 text-slate-200 font-mono text-sm rounded-lg px-2 py-1.5 sm:px-2.5 border border-slate-700/50 focus:outline-none"
                />
                <button 
                  className={`w-9 h-9 flex items-center justify-center rounded-lg flex-shrink-0 touch-manipulation ${
                    isVisible ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                  onClick={(e) => { e.stopPropagation(); togglePasswordVisibility(credential.id); }}
                >
                  {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button 
                  className={`w-9 h-9 flex items-center justify-center rounded-lg flex-shrink-0 touch-manipulation ${
                    copiedId === `${credential.id}-password` ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                  onClick={(e) => { e.stopPropagation(); copyToClipboard(credential.password, credential.id, 'password'); }}
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          
          {credential.url && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-slate-500 w-14 sm:w-16 flex-shrink-0">URL</span>
              <a 
                href={credential.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-cyan-400 hover:text-cyan-300 truncate min-w-0 flex-1 hover:underline block overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {highlightSearch(credential.url, searchQuery)}
              </a>
            </div>
          )}

          {credential.ip && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-slate-500 w-14 sm:w-16 flex-shrink-0">IP</span>
              <p className="text-sm text-slate-300 font-mono truncate min-w-0">{highlightSearch(credential.ip + (credential.port ? `:${credential.port}` : ''), searchQuery)}</p>
            </div>
          )}

          {credential.notes && (
            <div className="pt-1">
              <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{highlightSearch(credential.notes, searchQuery)}</p>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="relative px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-900/30 border-t border-slate-700/30 flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Clock className="w-3 h-3" />
              <span>{formatDate(credential.createdAt)}</span>
            </div>
            
            <div className="flex items-center gap-1 flex-wrap justify-end">
              {getTypeBadge(credential.type)}
              {expired && (
                <span className="px-1.5 py-0.5 bg-red-500/10 text-red-400 text-[10px] font-medium rounded border border-red-500/20">
                  Expired
                </span>
              )}
              {expiringSoon && !expired && (
                <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 text-[10px] font-medium rounded border border-amber-500/20">
                  Expiring
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Fetch credentials and admin users on component mount
  useEffect(() => {
    fetchCredentials();
    if (isAdmin) {
      fetchAdminUsers();
    }
  }, [isAdmin]);

  // Update search query from URL params
  useEffect(() => {
    const urlSearch = searchParams.get('search');
    if (urlSearch) {
      setSearchQuery(urlSearch);
    }
  }, [searchParams]);

  const fetchAdminUsers = async () => {
    try {
      const result = await userService.getAllUsers();
      if (result.success) {
        // Filter only admin users and exclude current user
        const admins = (result.users || []).filter(u => u.role === 'admin' && u.id !== user?.id);
        setAdminUsers(admins);
      }
    } catch (err) {
      console.error('Failed to fetch admin users:', err);
    }
  };

  const fetchCredentials = async () => {
    const cached = credentialService.peekAllCredentials?.();
    if (cached?.success && Array.isArray(cached.credentials)) {
      setCredentials(cached.credentials);
      setError(null);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }
    try {
      const result = await credentialService.getAllCredentials();
      if (result.success) {
        setCredentials(result.credentials);
        setError(null);
      } else if (!cached) {
        setError(result.error || 'Failed to fetch credentials');
      }
    } catch (err) {
      if (!cached) setError('An unexpected error occurred');
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
      'vps': Server,
      google: LogIn,
    };
    
    return icons[type] || Key;
  };

  const getTypeBadge = (type) => {
    const typeConfig = {
      password: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
      'api-key': { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/20' },
      certificate: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20' },
      'ssh-key': { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
      'vps': { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
      google: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
    };
    const typeLabels = {
      google: 'Continue with Google',
    };
    const config = typeConfig[type] || typeConfig.password;
    const label = typeLabels[type] || type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${config.bg} ${config.text} ${config.border}`}>
        {label}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = date.getDate();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
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
      return formatDate(date);
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

  const copyToClipboard = (text, credentialId, field = null) => {
    const copiedKey = field ? `${credentialId}-${field}` : credentialId;
    // Try modern Clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => {
          setCopiedId(copiedKey);
          setTimeout(() => setCopiedId(null), 2000);
        })
        .catch(err => {
          console.error('Clipboard API failed, trying fallback: ', err);
          fallbackCopyToClipboard(text, credentialId, field);
        });
    } else {
      // Fallback for insecure contexts or older browsers
      fallbackCopyToClipboard(text, credentialId, field);
    }
  };

  const fallbackCopyToClipboard = (text, credentialId, field = null) => {
    const copiedKey = field ? `${credentialId}-${field}` : credentialId;
    // Create a temporary textarea element
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        setCopiedId(copiedKey);
        setTimeout(() => setCopiedId(null), 2000);
      } else {
        console.error('Fallback: Copy command was unsuccessful');
        alert('Failed to copy to clipboard. Please copy manually.');
      }
    } catch (err) {
      console.error('Fallback: Unable to copy', err);
      alert('Failed to copy to clipboard. Please copy manually.');
    }
    
    document.body.removeChild(textArea);
  };

  const shareCredential = async (credential) => {
    const lines = [`${credential.name}`];
    if (credential.username) lines.push(`Username: ${credential.username}`);
    if (credential.password) lines.push(`Password: ${credential.password}`);
    const shareText = lines.join('\n');

    try {
      if (navigator.share) {
        toast('Ready to share', { icon: '📤' });
        await navigator.share({ title: credential.name, text: shareText });
        return;
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      console.error('Web Share failed, falling back to clipboard:', err);
    }
    copyToClipboard(shareText, credential.id, 'share');
    toast.success('Copied to clipboard');
  };

  const addNewCredential = async () => {
    try {
      // Validate required fields
      if (!newCredential.name || !newCredential.name.trim()) {
        alert('Please enter a credential name');
        return;
      }
      if (newCredential.type !== 'google' && (!newCredential.password || !newCredential.password.trim())) {
        alert('Please enter a password/key');
        return;
      }
      
      console.log('Attempting to create credential with data:', JSON.stringify(newCredential, null, 2));
      const result = await credentialService.createCredential(newCredential);
      console.log('Create credential result:', result);
      
      if (result.success) {
        console.log('Credential created successfully');
        // Refresh credentials list
        await fetchCredentials();
        
        // Reset form and close modal
        closeAddModal();
      } else {
        console.error('Failed to create credential:', result.error);
        setError(result.error || 'Failed to add credential');
        alert(`Error: ${result.error || 'Failed to add credential'}`);
      }
    } catch (err) {
      console.error('Unexpected error creating credential:', err);
      setError('An unexpected error occurred');
      alert(`Unexpected error: ${err.message}`);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setNewCredential(prev => {
      const next = { ...prev, [name]: value };
      if (name === 'type' && value === 'google') next.password = '';
      return next;
    });
  };

  // Open add modal (reset to step 1)
  const openAddModal = () => {
    setNewCredential({
      name: '',
      type: 'password',
      username: '',
      password: '',
      url: '',
      ip: '',
      port: '',
      category: '',
      notes: '',
      expiryDate: '',
      isPrivate: true,
      sharedWithUserIds: []
    });
    setAddModalStep(1);
    setShowAddModal(true);
  };

  // Close add modal
  const closeAddModal = () => {
    setShowAddModal(false);
    setAddModalStep(1);
  };

  // Select category and proceed to step 2
  const selectCategory = (categoryId) => {
    // Set type based on category for better defaults
    let defaultType = 'password';
    if (categoryId === 'Security') defaultType = 'api-key';
    
    setNewCredential(prev => ({
      ...prev,
      category: categoryId,
      type: defaultType
    }));
    setAddModalStep(2);
  };

  // Go back to step 1
  const goBackToCategories = () => {
    setAddModalStep(1);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditingCredential(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const toggleSharedUser = (userId, isEdit = false) => {
    const setter = isEdit ? setEditingCredential : setNewCredential;
    setter(prev => {
      const currentShared = prev.sharedWithUserIds || [];
      const isCurrentlyShared = currentShared.includes(userId);
      return {
        ...prev,
        sharedWithUserIds: isCurrentlyShared
          ? currentShared.filter(id => id !== userId)
          : [...currentShared, userId]
      };
    });
  };

  const shareWithAllAdmins = (isEdit = false) => {
    const setter = isEdit ? setEditingCredential : setNewCredential;
    setter(prev => ({
      ...prev,
      sharedWithUserIds: adminUsers.map(admin => admin.id)
    }));
  };

  const clearAllSharing = (isEdit = false) => {
    const setter = isEdit ? setEditingCredential : setNewCredential;
    setter(prev => ({
      ...prev,
      sharedWithUserIds: []
    }));
  };

  const toggleCredentialSharing = async (credential) => {
    try {
      setTogglingCredentialId(credential.id);
      
      // Toggle the privacy setting
      const updateData = {
        isPrivate: !credential.isPrivate,
        sharedWithUserIds: !credential.isPrivate ? [] : credential.sharedWithUserIds // Clear sharing list if switching to shared with all
      };

      console.log('Toggling credential sharing:', { credentialId: credential.id, updateData });
      const result = await credentialService.updateCredential(credential.id, updateData);
      
      if (result.success) {
        console.log('Sharing toggled successfully');
        // Update local state
        setCredentials(prev => 
          prev.map(cred => 
            cred.id === credential.id ? result.credential : cred
          )
        );
      } else {
        console.error('Failed to toggle sharing:', result.error);
        setError(result.error || 'Failed to update credential sharing');
      }
    } catch (err) {
      console.error('Unexpected error toggling sharing:', err);
      setError('An unexpected error occurred');
    } finally {
      setTogglingCredentialId(null);
    }
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
      ip: credential.ip || '',
      port: credential.port || '',
      category: credential.category,
      notes: credential.notes || '',
      expiryDate: credential.expiryDate ? new Date(credential.expiryDate).toISOString().split('T')[0] : '',
      isPrivate: credential.isPrivate !== undefined ? credential.isPrivate : true,
      sharedWithUserIds: credential.sharedWithUserIds ? credential.sharedWithUserIds.map(u => u.id || u) : []
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

  const deleteCredential = (id) => {
    // Find the credential to get its name for the confirmation message
    const credential = credentials.find(cred => cred.id === id);
    // Show custom confirmation modal
    setDeleteConfirmModal({ show: true, credential });
  };

  const confirmDelete = async () => {
    const { credential } = deleteConfirmModal;
    if (!credential) return;
    
    const credentialName = credential.name || 'this credential';
    
    try {
      const result = await credentialService.deleteCredential(credential.id);
      
      if (result.success) {
        // Remove from local state
        setCredentials(prev => prev.filter(cred => cred.id !== credential.id));
        console.log(`Credential "${credentialName}" deleted successfully`);
        setDeleteConfirmModal({ show: false, credential: null });
      } else {
        setError(result.error || 'Failed to delete credential');
        alert(`Failed to delete credential: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      setError('An unexpected error occurred');
      alert('An unexpected error occurred while deleting the credential');
      console.error(err);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmModal({ show: false, credential: null });
  };

  const filteredCredentials = (credentials || []).filter(credential => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = !q ||
      credential.name?.toLowerCase().includes(q) ||
      credential.category?.toLowerCase().includes(q) ||
      (credential.username && credential.username.toLowerCase().includes(q)) ||
      (credential.notes && credential.notes.toLowerCase().includes(q)) ||
      (credential.url && credential.url.toLowerCase().includes(q)) ||
      (credential.ip && credential.ip.toLowerCase().includes(q));
    const matchesType = selectedType === 'all' || credential.type === selectedType;
    const matchesCategory = selectedCategory === 'all' || credential.category === selectedCategory;
    return matchesSearch && matchesType && matchesCategory;
  });

  // When searching, always show list (grid) view instead of stacked cards
  const isSearching = !!searchQuery.trim();
  const effectiveViewMode = isSearching ? 'grid' : viewMode;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-row items-center justify-between gap-2 sm:gap-4 animate-fade-in">
        <div className="flex-shrink-0 min-w-0">
          <h1 className="text-xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-0.5 sm:mb-2 truncate">Credentials</h1>
          <p className="text-slate-400 text-xs sm:text-base truncate">Secure password storage</p>
        </div>
        <div className="flex flex-row items-center gap-2 sm:gap-3 flex-shrink-0">
          <button 
            className="btn-primary bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 hover:scale-105 transition-all duration-300 text-xs sm:text-sm px-2.5 sm:px-4 py-2 whitespace-nowrap"
            onClick={openAddModal}
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline-block mr-1" /> <span className="hidden xs:inline">Add Credential</span><span className="xs:hidden">Add</span>
          </button>
        </div>
      </div>

      {/* Statistics Cards - Compact horizontal layout */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 animate-fade-up">
        {/* Total Credentials Card */}
        <div className="glass-morphism rounded-lg sm:rounded-xl border border-cyan-500/20 shadow-glow hover:shadow-glow-intense transition-all duration-300 hover:scale-[1.02] p-2 sm:p-4 flex flex-row items-center active:scale-95 cursor-pointer group">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center bg-gradient-to-r from-cyan-500 to-blue-600 shadow-lg flex-shrink-0">
            <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div className="flex flex-col items-end flex-1 ml-2 sm:ml-3">
            <span className="text-lg sm:text-xl font-bold text-white">{credentials?.length || 0}</span>
            <span className="text-[9px] sm:text-xs text-cyan-200/80 uppercase font-medium">TOTAL</span>
          </div>
        </div>

        {/* Encrypted Card */}
        <div className="glass-morphism rounded-lg sm:rounded-xl border border-green-500/20 shadow-glow hover:shadow-glow-intense transition-all duration-300 hover:scale-[1.02] p-2 sm:p-4 flex flex-row items-center active:scale-95 cursor-pointer group">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg flex-shrink-0">
            <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div className="flex flex-col items-end flex-1 ml-2 sm:ml-3">
            <span className="text-lg sm:text-xl font-bold text-white">{(credentials || []).filter(c => c.isEncrypted).length}</span>
            <span className="text-[9px] sm:text-xs text-green-200/80 uppercase font-medium">SECURE</span>
          </div>
        </div>

        {/* Expiring Soon Card */}
        <div className="glass-morphism rounded-lg sm:rounded-xl border border-yellow-500/20 shadow-glow hover:shadow-glow-intense transition-all duration-300 hover:scale-[1.02] p-2 sm:p-4 flex flex-row items-center active:scale-95 cursor-pointer group">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center bg-gradient-to-r from-yellow-500 to-amber-600 shadow-lg flex-shrink-0">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div className="flex flex-col items-end flex-1 ml-2 sm:ml-3">
            <span className="text-lg sm:text-xl font-bold text-white">{(credentials || []).filter(c => isExpiringSoon(c.expiryDate)).length}</span>
            <span className="text-[9px] sm:text-xs text-yellow-200/80 uppercase font-medium">EXPIRY</span>
          </div>
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
              <option value="ssh-key">SSH Key</option>
              <option value="google">Continue with Google</option>
            </select>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input-field bg-slate-800/50 border border-slate-700/50 focus:border-cyan-500/50 focus:ring focus:ring-cyan-500/20 transition-all duration-300"
            >
              <option value="all">All Categories</option>
              <option value="Cloud Services">Cloud Services</option>
              <option value="Security">Security</option>
              <option value="Infrastructure">Infrastructure</option>
              <option value="Email">Email</option>
              <option value="Custom">Custom</option>
            </select>
            {(searchQuery || selectedType !== 'all' || selectedCategory !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedType('all');
                  setSelectedCategory('all');
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600/50 rounded-lg text-slate-300 hover:text-white transition-all duration-300"
                title="Reset all filters"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset</span>
              </button>
            )}
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

      {/* Credentials View with Toggle */}
      {!isLoading && !error && (
        <div className="mt-6 animate-fade-up">
          {/* View Toggle Line: when expanded show back + category name; always show stack/grid toggles */}
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3 min-w-0">
              {expandedCategory ? (
                <>
                  <button
                    onClick={() => setExpandedCategory(null)}
                    className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 text-slate-400 hover:text-white transition-all flex-shrink-0"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  {(() => {
                    const cat = getCategoryConfig(expandedCategory);
                    const IconComponent = cat.icon;
                    return (
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
                          <IconComponent className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div className="min-w-0">
                          <h2 className="text-lg font-bold text-white truncate">{cat.name}</h2>
                          <p className="text-sm text-slate-400 truncate">{cat.description}</p>
                        </div>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <span className="text-sm text-slate-400">View:</span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => { setViewMode('stack'); setExpandedCategory(null); }}
                className={`p-2.5 rounded-lg border transition-all duration-200 ${
                  effectiveViewMode === 'stack'
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                    : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-600'
                }`}
                title="Stack View"
              >
                <Layers className="w-5 h-5" />
              </button>
              <button
                onClick={() => { setViewMode('grid'); setExpandedCategory(null); }}
                className={`p-2.5 rounded-lg border transition-all duration-200 ${
                  effectiveViewMode === 'grid'
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                    : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-600'
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Stack View - Category Cards */}
          {effectiveViewMode === 'stack' && !expandedCategory && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {credentialCategories.map((category, catIndex) => {
                const categoryCredentials = filteredCredentials.filter(c => (c.category || 'Custom') === category.id);
                const IconComponent = category.icon;
                const cardCount = categoryCredentials.length;
                
                // Stack offset calculation
                const visibleCards = Math.min(cardCount, 4);
                const stackOffset = 6;
                const totalStackHeight = cardCount > 1 ? (visibleCards - 1) * stackOffset : 0;
                const backCardCount = Math.min(cardCount - 1, 3);
                const isThisStackHovered = hoveredStack.key === category.id;
                
                const handleStackMouseMove = (e) => {
                  if (cardCount <= 1 || backCardCount === 0) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const y = e.clientY - rect.top;
                  const frontHeight = 240;
                  if (y < frontHeight) {
                    setHoveredStack({ key: category.id, backIndex: null });
                    return;
                  }
                  const stackAreaHeight = rect.height - frontHeight;
                  if (stackAreaHeight <= 0) return;
                  const bandHeight = stackAreaHeight / backCardCount;
                  const backIndex = Math.min(
                    Math.max(0, Math.floor((y - frontHeight) / bandHeight)),
                    backCardCount - 1
                  );
                  setHoveredStack({ key: category.id, backIndex });
                };
                
                const handleStackMouseLeave = () => setHoveredStack({ key: null, backIndex: null });
                
                return (
                  <div 
                    key={category.id} 
                    className="relative animate-fade-up"
                    style={{ 
                      animationDelay: `${catIndex * 0.06}s`,
                      paddingBottom: `${totalStackHeight}px`
                    }}
                    onMouseMove={handleStackMouseMove}
                    onMouseLeave={handleStackMouseLeave}
                  >
                    <div 
                      className={`relative ${cardCount > 0 ? 'cursor-pointer' : 'cursor-default'} group`}
                      onClick={() => cardCount > 0 && toggleCategoryExpand(category.id)}
                    >
                      {/* Stacked cards behind - each responds to hover one by one when mouse moves down */}
                      {cardCount > 1 && Array.from({ length: backCardCount }).map((_, idx) => {
                        const isThisBackHovered = isThisStackHovered && hoveredStack.backIndex !== null && hoveredStack.backIndex >= idx;
                        return (
                          <div 
                            key={idx}
                            className={`absolute inset-x-0 rounded-xl border transition-all duration-300 ${
                              isThisBackHovered
                                ? 'border-cyan-400/50 translate-y-0.5 shadow-md shadow-cyan-500/10'
                                : 'border-cyan-500/20 group-hover:translate-y-0.5'
                            }`}
                            style={{ 
                              height: '240px',
                              top: `${(idx + 1) * stackOffset}px`,
                              background: 'linear-gradient(145deg, rgba(15,23,42,0.9) 0%, rgba(30,41,59,0.8) 100%)',
                              zIndex: 3 - idx,
                            }}
                          />
                        );
                      })}
                      
                      {/* Front Card */}
                      <div 
                        className={`relative rounded-xl border border-cyan-500/30 backdrop-blur-xl transition-all duration-300 overflow-hidden ${
                          cardCount > 0 
                            ? 'group-hover:-translate-y-2 group-hover:border-cyan-400/50 group-hover:shadow-lg group-hover:shadow-cyan-500/10' 
                            : 'opacity-50'
                        }`}
                        style={{ 
                          height: '240px',
                          background: 'linear-gradient(145deg, rgba(15,23,42,0.95) 0%, rgba(30,41,59,0.9) 100%)',
                          zIndex: 10,
                        }}
                      >
                        {/* Subtle blue glow overlay */}
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                        
                        {/* Card Content */}
                        <div className="relative h-full flex flex-col items-center justify-center p-4">
                          {/* Icon */}
                          <div className={`w-14 h-14 rounded-xl bg-slate-800/80 border border-cyan-500/30 flex items-center justify-center mb-4 ${cardCount > 0 ? 'group-hover:border-cyan-400/50 group-hover:bg-cyan-500/10' : ''} transition-all duration-300`}>
                            <IconComponent className={`w-7 h-7 ${cardCount > 0 ? 'text-cyan-400' : 'text-slate-500'}`} />
                          </div>
                          
                          {/* Category Name */}
                          <h3 className={`font-semibold text-center text-base mb-3 ${cardCount > 0 ? 'text-white' : 'text-slate-500'}`}>
                            {category.name}
                          </h3>
                          
                          {/* Count Badge */}
                          <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-medium ${
                            cardCount > 0 
                              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                              : 'bg-slate-800/50 text-slate-500 border border-slate-700/50'
                          }`}>
                            {cardCount > 0 ? `${cardCount} ${cardCount === 1 ? 'item' : 'items'}` : 'Empty'}
                          </span>
                          
                          {/* Click hint */}
                          {cardCount > 0 && (
                            <div className="mt-3 flex items-center gap-1 text-slate-500 group-hover:text-cyan-400 transition-colors text-xs">
                              <span>View</span>
                              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Expanded Category View */}
          {effectiveViewMode === 'stack' && expandedCategory && (
            <div className="animate-fade-up">
              {/* Credentials Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 min-[2560px]:grid-cols-4 gap-4">
                {filteredCredentials
                  .filter(c => (c.category || 'Custom') === expandedCategory)
                  .map((credential, index) => renderCredentialCard(credential, index))}
              </div>
            </div>
          )}

          {/* Grid View - All Credentials */}
          {effectiveViewMode === 'grid' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 min-[2560px]:grid-cols-4 gap-4">
              {filteredCredentials.map((credential, index) => renderCredentialCard(credential, index))}
            </div>
          )}
        </div>
      )}

      {!isLoading && !error && filteredCredentials.length === 0 && (
        <div className="glass-morphism p-12 rounded-xl text-center border border-slate-700/30 shadow-glow animate-fade-up" style={{ animationDelay: '0.3s' }}>
          <Shield className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-slate-400 to-slate-600 mb-2">No credentials found</h3>
          <p className="text-slate-500 mb-6">Try adjusting your search criteria or add a new credential.</p>
          <button 
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-cyan-400 border border-cyan-500/50 rounded-lg hover:bg-cyan-500/10 hover:border-cyan-400 transition-all duration-300"
            onClick={openAddModal}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Credential
          </button>
        </div>
      )}

      {/* Add Credential Modal - Step Based */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black bg-opacity-60 animate-fade-in p-4 overflow-y-auto">
          <div className="glass-morphism bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-3xl relative p-6 animate-fade-up my-4 sm:my-0 max-h-[calc(100vh-2rem)] overflow-y-auto">
            
            {/* Step 1: Category Selection */}
            {addModalStep === 1 && (
              <>
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-2">Add New Credential</h2>
                  <p className="text-slate-400">Select the type of credential you want to store</p>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                  {credentialCategories.map((cat) => {
                    const IconComponent = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => selectCategory(cat.id)}
                        className={`group relative p-4 rounded-xl border ${cat.borderColor} ${cat.bgColor} hover:scale-105 transition-all duration-300 text-left`}
                      >
                        <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${cat.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                          <IconComponent className="w-6 h-6 text-white" />
                        </div>
                        <h3 className="text-white font-semibold mb-1">{cat.name}</h3>
                        <p className="text-slate-400 text-xs">{cat.description}</p>
                        <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
                      </button>
                    );
                  })}
                </div>
                
                <div className="flex justify-end">
                  <button 
                    type="button"
                    className="btn-secondary backdrop-blur-sm hover:scale-105 transition-all"
                    onClick={closeAddModal}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

            {/* Step 2: Credential Details Form */}
            {addModalStep === 2 && (
              <>
                {/* Header with back button */}
                <div className="flex items-center mb-6">
                  <button
                    type="button"
                    onClick={goBackToCategories}
                    className="mr-3 p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 text-slate-400 hover:text-white transition-all"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
                      {credentialCategories.find(c => c.id === newCredential.category)?.name || 'New'} Credential
                    </h2>
                    <p className="text-slate-400 text-sm">Fill in the details below</p>
                  </div>
                  {(() => {
                    const selectedCat = credentialCategories.find(c => c.id === newCredential.category);
                    if (selectedCat) {
                      const IconComponent = selectedCat.icon;
                      return (
                        <div className={`ml-auto w-10 h-10 rounded-lg bg-gradient-to-br ${selectedCat.color} flex items-center justify-center`}>
                          <IconComponent className="w-5 h-5 text-white" />
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                <form onSubmit={(e) => { e.preventDefault(); addNewCredential(); }}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Common Fields */}
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Name <span className="text-red-400">*</span></label>
                      <SuggestInput
                        suggestions={suggestions.name}
                        type="text"
                        name="name"
                        value={newCredential.name}
                        onChange={handleChange}
                        required
                        className="bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 px-3 w-full text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        placeholder="Credential name"
                        autoComplete="off"
                        autoFocus
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
                        <option value="ssh-key">SSH Key</option>
                        <option value="google">Continue with Google</option>
                      </select>
                    </div>

                    {/* Email specific fields */}
                    {newCredential.category === 'Email' && (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-400 mb-1">Email Address / URL</label>
                        <SuggestInput
                          suggestions={suggestions.url}
                          type="text"
                          name="url"
                          value={newCredential.url}
                          onChange={handleChange}
                          className="bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 px-3 w-full text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          placeholder="mail.example.com or webmail URL"
                        />
                      </div>
                    )}

                    {/* Cloud Services specific fields */}
                    {newCredential.category === 'Cloud Services' && (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-400 mb-1">Console / Dashboard URL</label>
                        <SuggestInput
                          suggestions={suggestions.url}
                          type="text"
                          name="url"
                          value={newCredential.url}
                          onChange={handleChange}
                          className="bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 px-3 w-full text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          placeholder="https://console.aws.amazon.com"
                        />
                      </div>
                    )}

                    {/* Security specific fields */}
                    {newCredential.category === 'Security' && (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-400 mb-1">Service URL</label>
                        <SuggestInput
                          suggestions={suggestions.url}
                          type="text"
                          name="url"
                          value={newCredential.url}
                          onChange={handleChange}
                          className="bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 px-3 w-full text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          placeholder="https://api.example.com"
                        />
                      </div>
                    )}

                    {/* Custom / Others specific fields */}
                    {newCredential.category === 'Custom' && (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-400 mb-1">URL (optional)</label>
                        <SuggestInput
                          suggestions={suggestions.url}
                          type="text"
                          name="url"
                          value={newCredential.url}
                          onChange={handleChange}
                          className="bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 px-3 w-full text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          placeholder="https://example.com"
                        />
                      </div>
                    )}

                    {/* Common credential fields */}
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Username</label>
                      <SuggestInput
                        suggestions={suggestions.username}
                        type="text"
                        name="username"
                        value={newCredential.username}
                        onChange={handleChange}
                        className="bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 px-3 w-full text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        placeholder={newCredential.category === 'Email' ? 'Email address' : 'Username'}
                        autoComplete="username"
                      />
                    </div>

                    {newCredential.type !== 'google' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">
                        {newCredential.category === 'Security' ? 'API Key / Token' : 'Password'} <span className="text-red-400">*</span>
                      </label>
                      <input 
                        type="password" 
                        name="password"
                        value={newCredential.password}
                        onChange={handleChange}
                        required={newCredential.type !== 'google'}
                        className="bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 px-3 w-full text-white focus:outline-none focus:ring-1 focus:ring-cyan-500" 
                        placeholder={newCredential.category === 'Security' ? 'Enter API key or token' : 'Enter password'}
                        autoComplete="new-password"
                      />
                    </div>
                    )}

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

                    {/* Privacy Settings for Admin */}
                    {isAdmin && (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-400 mb-1">Privacy Settings</label>
                        <div className="flex items-center space-x-6 mb-2">
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="radio"
                              name="isPrivate"
                              checked={!newCredential.isPrivate}
                              onChange={() => setNewCredential(prev => ({ ...prev, isPrivate: false, sharedWithUserIds: [] }))}
                              className="w-4 h-4 text-green-500 focus:ring-green-500"
                            />
                            <span className="text-slate-300 flex items-center">
                              <LockOpen className="w-4 h-4 mr-1 text-green-400" />
                              Share with All Admins
                            </span>
                          </label>
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="radio"
                              name="isPrivate"
                              checked={newCredential.isPrivate}
                              onChange={() => setNewCredential(prev => ({ ...prev, isPrivate: true }))}
                              className="w-4 h-4 text-cyan-500 focus:ring-cyan-500"
                            />
                            <span className="text-slate-300 flex items-center">
                              <Lock className="w-4 h-4 mr-1 text-red-400" />
                              Private
                            </span>
                          </label>
                        </div>
                        {newCredential.isPrivate && adminUsers.length > 0 && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between mb-2">
                              <label className="block text-sm font-medium text-slate-400">Share with Specific Admins (optional)</label>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => shareWithAllAdmins(false)}
                                  className="text-xs px-2 py-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded hover:bg-cyan-500/30 transition-colors"
                                >
                                  Select All
                                </button>
                                <button
                                  type="button"
                                  onClick={() => clearAllSharing(false)}
                                  className="text-xs px-2 py-1 bg-slate-700/50 text-slate-300 border border-slate-600 rounded hover:bg-slate-700 transition-colors"
                                >
                                  Clear All
                                </button>
                              </div>
                            </div>
                            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-2 max-h-32 overflow-y-auto">
                              {adminUsers.map(admin => (
                                <label key={admin.id} className="flex items-center space-x-2 py-1.5 cursor-pointer hover:bg-slate-700/30 rounded px-2">
                                  <input
                                    type="checkbox"
                                    checked={newCredential.sharedWithUserIds.includes(admin.id)}
                                    onChange={() => toggleSharedUser(admin.id, false)}
                                    className="w-4 h-4 text-cyan-500 focus:ring-cyan-500 rounded"
                                  />
                                  <Users className="w-4 h-4 text-cyan-400" />
                                  <span className="text-sm text-slate-300">{admin.fullname || admin.email}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

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
                  
                  <div className="flex justify-between mt-6">
                    <button 
                      type="button"
                      className="btn-secondary backdrop-blur-sm hover:scale-105 transition-all flex items-center"
                      onClick={goBackToCategories}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back
                    </button>
                    <div className="flex space-x-3">
                      <button 
                        type="button"
                        className="btn-secondary backdrop-blur-sm hover:scale-105 transition-all"
                        onClick={closeAddModal}
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit"
                        className={`btn-primary bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 hover:scale-105 transition-all duration-300 ${(!newCredential.name || (!newCredential.password && newCredential.type !== 'google')) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={!newCredential.name || (!newCredential.password && newCredential.type !== 'google')}
                        title={(!newCredential.name || (!newCredential.password && newCredential.type !== 'google')) ? 'Please fill in Name' + (newCredential.type === 'google' ? '' : ' and Password/Key fields') : 'Click to add credential'}
                      >
                        Add Credential
                      </button>
                    </div>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* Edit Credential Modal */}
      {showEditModal && editingCredential && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black bg-opacity-60 animate-fade-in p-4 overflow-y-auto">
          <div className="glass-morphism bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-3xl relative p-6 animate-fade-up my-4 sm:my-0 max-h-[calc(100vh-2rem)] overflow-y-auto">
            <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-4">Edit Credential</h2>
            <form onSubmit={(e) => { e.preventDefault(); updateCredential(); }}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Name</label>
                <SuggestInput
                  suggestions={suggestions.name}
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
                  <option value="Cloud Services">Cloud Services</option>
                  <option value="Security">Security</option>
                  <option value="Infrastructure">Infrastructure</option>
                  <option value="Email">Email</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Username</label>
                <SuggestInput
                  suggestions={suggestions.username}
                  type="text"
                  name="username"
                  value={editingCredential.username}
                  onChange={handleEditChange}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 px-3 w-full text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  placeholder="Username (if applicable)"
                />
              </div>
              {editingCredential.type !== 'google' && (
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
                    autoComplete="new-password"
                  />
                  <button 
                    type="button"
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
              )}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">URL (optional)</label>
                <SuggestInput
                  suggestions={suggestions.url}
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
                {isAdmin && (
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-slate-400 mb-1">Privacy Settings</label>
                  <div className="flex items-center space-x-6 mb-2">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="isPrivateEdit"
                        checked={!editingCredential.isPrivate}
                        onChange={() => setEditingCredential(prev => ({ ...prev, isPrivate: false, sharedWithUserIds: [] }))}
                        className="w-4 h-4 text-green-500 focus:ring-green-500"
                      />
                      <span className="text-slate-300 flex items-center">
                        <LockOpen className="w-4 h-4 mr-1 text-green-400" />
                        Share with All Admins
                      </span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="isPrivateEdit"
                        checked={editingCredential.isPrivate}
                        onChange={() => setEditingCredential(prev => ({ ...prev, isPrivate: true }))}
                        className="w-4 h-4 text-cyan-500 focus:ring-cyan-500"
                      />
                      <span className="text-slate-300 flex items-center">
                        <Lock className="w-4 h-4 mr-1 text-red-400" />
                        Private
                      </span>
                    </label>
                  </div>
                  {editingCredential.isPrivate && adminUsers.length > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-slate-400">Share with Specific Admins (optional)</label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => shareWithAllAdmins(true)}
                            className="text-xs px-2 py-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded hover:bg-cyan-500/30 transition-colors"
                          >
                            Select All
                          </button>
                          <button
                            type="button"
                            onClick={() => clearAllSharing(true)}
                            className="text-xs px-2 py-1 bg-slate-700/50 text-slate-300 border border-slate-600 rounded hover:bg-slate-700 transition-colors"
                          >
                            Clear All
                          </button>
                        </div>
                      </div>
                      <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-2 max-h-32 overflow-y-auto">
                        {adminUsers.map(admin => (
                          <label key={admin.id} className="flex items-center space-x-2 py-1.5 cursor-pointer hover:bg-slate-700/30 rounded px-2">
                            <input
                              type="checkbox"
                              checked={editingCredential.sharedWithUserIds.includes(admin.id)}
                              onChange={() => toggleSharedUser(admin.id, true)}
                              className="w-4 h-4 text-cyan-500 focus:ring-cyan-500 rounded"
                            />
                            <Users className="w-4 h-4 text-cyan-400" />
                            <span className="text-sm text-slate-300">{admin.fullname || admin.email}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-slate-400 mb-1">Notes (optional)</label>
                <textarea 
                  name="notes"
                  value={editingCredential.notes}
                  onChange={handleEditChange}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 px-3 w-full text-white focus:outline-none focus:ring-1 focus:ring-cyan-500" 
                  rows="1"
                  placeholder="Add any additional notes here"
                ></textarea>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-5">
              <button 
                type="button"
                className="btn-secondary backdrop-blur-sm hover:scale-105 transition-all"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingCredential(null);
                }}
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="btn-primary bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 hover:scale-105 transition-all duration-300"
                disabled={!editingCredential.name || !editingCredential.password}
              >
                Update Credential
              </button>
            </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmModal.show && deleteConfirmModal.credential && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black bg-opacity-60 animate-fade-in p-4 overflow-y-auto">
          <div className="glass-morphism bg-slate-900 border border-red-500/30 rounded-xl shadow-2xl w-full max-w-md p-6 animate-fade-up my-4 sm:my-0">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-red-400">Delete Credential?</h2>
            </div>
            
            <div className="mb-6">
              <p className="text-slate-300 mb-2">
                Are you sure you want to delete <span className="font-semibold text-white">"{deleteConfirmModal.credential.name}"</span>?
              </p>
              <p className="text-slate-400 text-sm">
                This action cannot be undone. All associated data will be permanently removed.
              </p>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button 
                type="button"
                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-all duration-200"
                onClick={cancelDelete}
              >
                Cancel
              </button>
              <button 
                type="button"
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-medium transition-all duration-200 hover:scale-105"
                onClick={confirmDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CredentialsPage;