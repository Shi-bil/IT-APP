import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Package, Plus, Search, Filter, MoreHorizontal, Edit, Trash2, Eye, Calendar, Grid3X3, User, Loader2, History, X, ArrowLeft, RotateCcw, FileText, FileSpreadsheet, Zap, Activity, Laptop, Smartphone, Tablet, Signal, Car, Boxes, Network } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { assetService } from '../services/assetService';
import { exportService } from '../services/exportService';
import AssignAssetModal from '../components/AssignAssetModal';
import AssetHistoryList from '../components/AssetHistoryList';
import AssetView from '../components/AssetView';
import { useAuth } from '../contexts/AuthContext';
import logo from '../assets/logo.png';
import AllAssetsView from '../components/AllAssetsView';

const AssetsPage = () => {
  const navigate = useNavigate();
  const { user, hasPermission, isLoading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [viewingLogForAsset, setViewingLogForAsset] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef(null);
  const [isResetting, setIsResetting] = useState(false);
  const [viewingAsset, setViewingAsset] = useState(null);
  // Export menu portal positioning
  const [exportMenuPos, setExportMenuPos] = useState({ top: 0, left: 0 });
  const exportMenuPortalRef = useRef(null);
  const [showAllAssetsView, setShowAllAssetsView] = useState(false);

  const isAdmin = user?.role === 'admin';

  // Show loading if auth is still loading
  if (authLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-2">Assets</h1>
            <p className="text-slate-400">Loading user information...</p>
          </div>
        </div>
        <div className="glass-morphism p-12 rounded-xl text-center border border-slate-700/30 shadow-glow animate-pulse">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 bg-cyan-500/20 rounded-full animate-ping"></div>
            <Loader2 className="w-16 h-16 text-cyan-400 mx-auto relative animate-spin" />
          </div>
          <h3 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-2">Loading...</h3>
          <p className="text-slate-500">Please wait while we load your information</p>
        </div>
      </div>
    );
  }

  const categories = [
    { id: '1', name: 'Laptops', icon: 'laptop', color: 'blue' },
    { id: '2', name: 'Mobiles', icon: 'smartphone', color: 'green' },
    { id: '3', name: 'Tablets', icon: 'tablet', color: 'purple' },
    { id: '4', name: 'SIMs', icon: 'signal', color: 'cyan' },
    { id: '5', name: 'Vehicles', icon: 'car', color: 'orange' },
    { id: '6', name: 'Other', icon: 'boxes', color: 'gray' },
  ];

  // Fetch assets from Back4App
  const fetchAssets = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching assets for user:', user?.role, 'isAdmin:', isAdmin);
      
      let result;
      if (isAdmin) {
        result = await assetService.getAllAssets();
      } else {
        result = await assetService.getUserAssets();
      }
      
      console.log('Assets fetch result:', result);
      
      if (result.success) {
        setAssets(result.assets);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to fetch assets');
      console.error('Fetch assets error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load assets on component mount
  useEffect(() => {
    if (user) {
      fetchAssets();
    }
  }, [isAdmin, user]);

  // Navigate to the asset form page
  const goToAddAssetPage = () => {
    navigate('/assets-managment/new');
  };

  // Handle asset deletion
  const handleDeleteAsset = async (assetId) => {
    if (window.confirm('Are you sure you want to delete this asset?')) {
      try {
        const result = await assetService.deleteAsset(assetId);
        if (result.success) {
          // Refresh the assets list
          fetchAssets();
        } else {
          alert('Failed to delete asset: ' + result.error);
        }
      } catch (err) {
        alert('Failed to delete asset');
        console.error('Delete asset error:', err);
      }
    }
  };

  const handleOpenAssignModal = (asset) => {
    setSelectedAsset(asset);
    setIsAssignModalOpen(true);
  };

  const handleOpenHistoryLog = (asset) => {
    setViewingLogForAsset(asset);
  };

  const handleResetFilters = () => {
    setIsResetting(true);
    setSearchQuery('');
    if (isAdmin) {
      setSelectedCategory('all');
    }
    setSelectedStatus('all');
    
    // Reset the animation state after a short delay
    setTimeout(() => {
      setIsResetting(false);
    }, 500);
  };

  const handleAssetAssigned = () => {
    fetchAssets();
  };

  const getStatusBadge = (status) => {
    const statusClasses = {
      using: 'bg-green-500/20 text-green-400 border-green-500/30',
      free: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      maintenance: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      retired: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${statusClasses[status]}`}>
        {status === 'using' ? 'Using' : status === 'free' ? 'Free to Use' : status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getCategoryIcon = (categoryName) => {
    switch(categoryName.toLowerCase()) {
      case 'laptops': return <Laptop className="w-8 h-8 text-blue-400 drop-shadow-glow-sm" />;
      case 'mobiles': return <Smartphone className="w-8 h-8 text-green-400 drop-shadow-glow-sm" />;
      case 'tablets': return <Tablet className="w-8 h-8 text-purple-400 drop-shadow-glow-sm" />;
      case 'sims': return <Signal className="w-8 h-8 text-cyan-400 drop-shadow-glow-sm" />;
      case 'vehicles': return <Car className="w-8 h-8 text-orange-400 drop-shadow-glow-sm" />;
      default: return <Boxes className="w-8 h-8 text-slate-400 drop-shadow-glow-sm" />;
    }
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.name : 'Unknown';
  };

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = isAdmin ? 
      (asset.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (asset.serialNumber?.toLowerCase() || '').includes(searchQuery.toLowerCase()) : 
      true;
    const matchesCategory = selectedCategory === 'all' || asset.categoryId === selectedCategory;
    const matchesStatus = selectedStatus === 'all' || asset.status === selectedStatus;
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Format assets data for export
  const formatAssetsForExport = () => {
    return filteredAssets.map(asset => ({
      Name: asset.name,
      SerialNumber: asset.serialNumber,
      Category: getCategoryName(asset.categoryId),
      Status: asset.status === 'using' ? 'Using' : 
              asset.status === 'free' ? 'Free to Use' : 
              asset.status.charAt(0).toUpperCase() + asset.status.slice(1),
      AssignedTo: asset.assignee || 'N/A',
      LastUpdated: new Date(asset.updatedAt).toLocaleDateString()
    }));
  };

  // Handle export
  const handleExport = (format) => {
    const exportData = formatAssetsForExport();
    const fileName = `assets_export_${new Date().toISOString().split('T')[0]}`;
    
    // Generate title based on filters
    let title = 'Assets Report';
    if (selectedCategory !== 'all') {
      title += ` - Category: ${getCategoryName(selectedCategory)}`;
    }
    if (selectedStatus !== 'all') {
      title += ` - Status: ${selectedStatus === 'using' ? 'Using' : 
                selectedStatus === 'free' ? 'Free to Use' : 
                selectedStatus.charAt(0).toUpperCase() + selectedStatus.slice(1)}`;
    }
    
    if (format === 'excel') {
      exportService.exportToExcel(exportData, fileName);
    } else if (format === 'docx') {
      exportService.exportToDocx(exportData, fileName, title);
    }
    
    setShowExportMenu(false);
  };

  // Close export menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setShowExportMenu(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Add animation classes for elements
  const getAnimationDelay = (index) => {
    return { animationDelay: `${index * 0.05}s` };
  };

  const handleViewAsset = (asset) => {
    setViewingAsset(asset);
  };

  if (viewingLogForAsset) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-2">Asset Track Log</h1>
            <p className="text-slate-400">
              Viewing log for: <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">{viewingLogForAsset.name}</span>
            </p>
          </div>
          <button onClick={() => setViewingLogForAsset(null)} className="btn-secondary backdrop-blur-sm hover:scale-105 transition-all">
            <ArrowLeft className="w-4 h-4 inline-block mr-1" /> Back to Assets
          </button>
        </div>
        <div className="glass-morphism p-6 rounded-xl border border-slate-700/30 shadow-glow animate-fade-up">
          <AssetHistoryList assetId={viewingLogForAsset.id} />
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-2">
              {isAdmin ? 'Assets' : 'My Assets'}
            </h1>
            <p className="text-slate-400">
              {isAdmin ? 'Manage and track all your IT assets' : 'View your assigned IT assets'}
            </p>
          </div>
        </div>
        <div className="glass-morphism p-12 rounded-xl text-center border border-slate-700/30 shadow-glow animate-pulse">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 bg-cyan-500/20 rounded-full animate-ping"></div>
            <Loader2 className="w-16 h-16 text-cyan-400 mx-auto relative animate-spin" />
          </div>
          <h3 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-2">
            {isAdmin ? 'Loading assets...' : 'Loading your assets...'}
          </h3>
          <p className="text-slate-500">Please wait while AI processes your data</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-2">
              {isAdmin ? 'Assets' : 'My Assets'}
            </h1>
            <p className="text-slate-400">
              {isAdmin ? 'Manage and track all your IT assets' : 'View your assigned IT assets'}
            </p>
          </div>
        </div>
        <div className="glass-morphism p-12 rounded-xl text-center border border-red-500/30 shadow-glow-error animate-fade-in">
          <Package className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-red-400 mb-2">
            {isAdmin ? 'Error loading assets' : 'Error loading your assets'}
          </h3>
          <p className="text-slate-500 mb-6">{error}</p>
          <button 
            className="btn-primary bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 hover:scale-105 transition-all duration-300"
            onClick={fetchAssets}
          >
            <Loader2 className="w-4 h-4 inline-block mr-1" /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 animate-fade-in">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-1 sm:mb-2">
              {isAdmin ? 'Assets' : 'My Assets'}
            </h1>
            <p className="text-slate-400 flex items-center text-sm sm:text-base">
              <Zap className="w-4 h-4 text-cyan-400 mr-2" />
              {isAdmin 
                ? 'Manage and track all your IT assets with AI assistance'
                : 'View your assigned IT assets'
              }
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
            {isAdmin && (
              <>
                <div className="relative z-[10000]" ref={exportMenuRef}>
                  <button 
                    className="btn-secondary backdrop-blur-sm hover:scale-105 transition-all"
                    onClick={() => {
                      const node = exportMenuRef.current;
                      if (node) {
                        const rect = node.getBoundingClientRect();
                        setExportMenuPos({
                          top: rect.bottom + window.scrollY + 8,
                          left: rect.right + window.scrollX - 192, // align with w-48 (12rem)
                        });
                      }
                      setShowExportMenu((v) => !v);
                    }}
                  >
                    <Filter className="w-4 h-4 inline-block mr-1" /> Export
                  </button>
                  
                  {showExportMenu && createPortal(
                    (
                      <div 
                        ref={exportMenuPortalRef}
                        data-export-menu
                        className="fixed w-48 bg-slate-800/90 backdrop-blur-md border border-slate-700/50 rounded-lg shadow-glow z-[999999] animate-fade-down"
                        style={{ top: exportMenuPos.top, left: exportMenuPos.left }}
                      >
                        <div className="py-1">
                          <button 
                            className="flex items-center w-full px-4 py-2 text-sm text-white hover:bg-gradient-to-r hover:from-green-500/20 hover:to-green-700/20 transition-all"
                            onClick={() => handleExport('excel')}
                          >
                            <FileSpreadsheet className="w-4 h-4 mr-2 text-green-400" />
                            Export to Excel
                          </button>
                          <button 
                            className="flex items-center w-full px-4 py-2 text-sm text-white hover:bg-gradient-to-r hover:from-blue-500/20 hover:to-blue-700/20 transition-all"
                            onClick={() => handleExport('docx')}
                          >
                            <FileText className="w-4 h-4 mr-2 text-blue-400" />
                            Export to Word
                          </button>
                        </div>
                      </div>
                    ),
                    document.body
                  )}
                </div>
                <button 
                  className="btn-primary bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 hover:scale-105 transition-all duration-300"
                  onClick={goToAddAssetPage}
                >
                  <Plus className="w-4 h-4 inline-block mr-1" /> Add Asset
                </button>
              </>
            )}
            {/* View All Assets button for non-admins */}
            {!isAdmin && filteredAssets.length > 0 && (
              <button
                className="btn-secondary px-6 py-2 rounded-lg text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/10 transition-all font-semibold"
                onClick={() => setShowAllAssetsView(true)}
              >
                View All Assets
              </button>
            )}
          </div>
        </div>

        {/* Statistics Cards */}
        <div className={`grid grid-cols-1 xs:grid-cols-2 md:grid-cols-${isAdmin ? '4' : '2'} gap-3 sm:gap-6 animate-fade-up`}>
          <div className="glass-morphism p-6 rounded-xl border border-slate-700/30 shadow-glow hover:shadow-glow-intense transition-all duration-300 hover:scale-[1.02]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-400">{isAdmin ? 'Total Assets' : 'My Assets'}</h3>
              <div className="relative">
                <div className="absolute inset-0 bg-cyan-500/20 rounded-full animate-ping opacity-50"></div>
                <Package className="w-5 h-5 text-cyan-400 relative" />
              </div>
            </div>
            <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">{assets.length}</p>
            <p className="text-sm text-green-400 mt-1 flex items-center">
              <Activity className="w-3 h-3 mr-1" /> {isAdmin ? '+12% from last month' : 'Currently assigned'}
            </p>
          </div>
          <div className="glass-morphism p-6 rounded-xl border border-slate-700/30 shadow-glow hover:shadow-glow-intense transition-all duration-300 hover:scale-[1.02]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-400">Using</h3>
              <div className="w-2 h-2 bg-green-400 rounded-full shadow-glow-green"></div>
            </div>
            <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600">
              {assets.filter(asset => asset.status === 'using').length}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              {assets.length > 0 ? Math.round((assets.filter(asset => asset.status === 'using').length / assets.length) * 100) : 0}% of total
            </p>
          </div>
          {isAdmin && (
            <>
              <div className="glass-morphism p-6 rounded-xl border border-slate-700/30 shadow-glow hover:shadow-glow-intense transition-all duration-300 hover:scale-[1.02]">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-slate-400">Free to Use</h3>
                  <div className="w-2 h-2 bg-blue-400 rounded-full shadow-glow-blue"></div>
                </div>
                <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-600">
                  {assets.filter(asset => asset.status === 'free').length}
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  {assets.length > 0 ? Math.round((assets.filter(asset => asset.status === 'free').length / assets.length) * 100) : 0}% of total
                </p>
              </div>
              <div className="glass-morphism p-6 rounded-xl border border-slate-700/30 shadow-glow hover:shadow-glow-intense transition-all duration-300 hover:scale-[1.02]">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-slate-400">Maintenance</h3>
                  <div className="w-2 h-2 bg-yellow-400 rounded-full shadow-glow-yellow"></div>
                </div>
                <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-600">
                  {assets.filter(asset => asset.status === 'maintenance').length}
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  {assets.length > 0 ? Math.round((assets.filter(asset => asset.status === 'maintenance').length / assets.length) * 100) : 0}% of total
                </p>
              </div>
            </>
          )}
        </div>
        
        {/* Categories Panel - Always visible */}
        {(isAdmin || !isAdmin) && (
          <div className="glass-morphism p-4 sm:p-6 rounded-xl border border-slate-700/30 shadow-glow animate-fade-up" style={{ animationDelay: '0.1s' }}>
            <h3 className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-2 sm:mb-4">Asset Categories</h3>
            <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-7 gap-2">
              <div
                className={`glass-morphism-hover p-4 rounded-lg cursor-pointer group transition-all duration-300 hover:scale-105 ${
                  selectedCategory === 'all' ? 'bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/40 shadow-glow-blue' : ''
                }`}
                onClick={() => setSelectedCategory('all')}
              >
                <div className="text-center">
                  <div className="flex justify-center mb-2">
                    <Network className="w-8 h-8 text-cyan-400 drop-shadow-glow-sm" />
                  </div>
                  <h4 className={`text-sm font-medium ${
                    selectedCategory === 'all' ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600' : 'text-white group-hover:text-cyan-400'
                  } transition-colors`}>
                    All
                  </h4>
                </div>
              </div>
              {categories.map((category, index) => (
                <div
                  key={category.id}
                  className={`glass-morphism-hover p-4 rounded-lg cursor-pointer group transition-all duration-300 hover:scale-105 ${
                    selectedCategory === category.id ? 'bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/40 shadow-glow-blue' : ''
                  }`}
                  onClick={() => setSelectedCategory(category.id)}
                  style={getAnimationDelay(index + 1)}
                >
                  <div className="text-center">
                    <div className="flex justify-center mb-2">
                      {category.icon === 'laptop' && <Laptop className="w-8 h-8 text-blue-400 drop-shadow-glow-sm" />}
                      {category.icon === 'smartphone' && <Smartphone className="w-8 h-8 text-green-400 drop-shadow-glow-sm" />}
                      {category.icon === 'tablet' && <Tablet className="w-8 h-8 text-purple-400 drop-shadow-glow-sm" />}
                      {category.icon === 'signal' && <Signal className="w-8 h-8 text-cyan-400 drop-shadow-glow-sm" />}
                      {category.icon === 'car' && <Car className="w-8 h-8 text-orange-400 drop-shadow-glow-sm" />}
                      {category.icon === 'boxes' && <Boxes className="w-8 h-8 text-slate-400 drop-shadow-glow-sm" />}
                    </div>
                    <h4 className={`text-sm font-medium ${
                      selectedCategory === category.id ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600' : 'text-white group-hover:text-cyan-400'
                    } transition-colors`}>
                      {category.name}
                    </h4>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters and Search */}
        {isAdmin && (
          <div className="glass-morphism p-4 sm:p-6 rounded-xl border border-slate-700/30 shadow-glow animate-fade-up" style={{ animationDelay: '0.2s' }}>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-2 lg:space-y-0 gap-2 lg:gap-0">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search assets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field pl-10 w-full bg-slate-800/50 border border-slate-700/50 focus:border-cyan-500/50 focus:ring focus:ring-cyan-500/20 transition-all duration-300"
                />
              </div>
              <div className="flex items-center space-x-4">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="input-field bg-slate-800/50 border border-slate-700/50 focus:border-cyan-500/50 focus:ring focus:ring-cyan-500/20 transition-all duration-300"
                >
                  <option value="all">All Categories</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="input-field bg-slate-800/50 border border-slate-700/50 focus:border-cyan-500/50 focus:ring focus:ring-cyan-500/20 transition-all duration-300"
                >
                  <option value="all">All Status</option>
                  <option value="using">Using</option>
                  <option value="free">Free to Use</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="retired">Retired</option>
                </select>
                <button 
                  className={`btn-secondary backdrop-blur-sm hover:scale-105 transition-all flex items-center space-x-2 bg-gradient-to-r from-slate-700/50 to-slate-800/50 border border-slate-700/50 ${isResetting ? 'animate-pulse' : ''}`}
                  onClick={handleResetFilters}
                  title="Reset Filters"
                  disabled={isResetting}
                >
                  <RotateCcw className={`w-4 h-4 text-cyan-400 ${isResetting ? 'animate-spin' : ''}`} />
                  <span>Reset</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Assets Table or Cards */}
        {isAdmin ? (
          // Admin: Table view
          <div className="glass-morphism rounded-xl overflow-hidden border border-slate-700/30 shadow-glow animate-fade-up" style={{ animationDelay: '0.3s' }}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-slate-800/50 to-slate-900/50 border-b border-white/10">
                  <tr>
                    <th className="text-left py-4 px-6 text-sm font-medium text-slate-300">Asset</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-slate-300">Category</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-slate-300">Status</th>
                    {isAdmin && <th className="text-left py-4 px-6 text-sm font-medium text-slate-300">Assigned To</th>}
                    <th className="text-right py-4 px-6 text-sm font-medium text-slate-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredAssets.map((asset, index) => (
                    <tr 
                      key={asset.id} 
                      className="hover:bg-gradient-to-r hover:from-slate-800/30 hover:to-slate-900/30 transition-colors animate-fade-up"
                      style={getAnimationDelay(index)}
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-5">
                          <div className="flex items-center justify-center">
                            {getCategoryIcon(getCategoryName(asset.categoryId))}
                          </div>
                          <div>
                            <h3 className="text-sm font-medium text-white">{asset.name}</h3>
                            <p className="text-xs text-slate-400">{asset.serialNumber}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm text-slate-300">{getCategoryName(asset.categoryId)}</span>
                      </td>
                      <td className="py-4 px-6">
                        {getStatusBadge(asset.status)}
                      </td>
                      {isAdmin && (
                        <td className="py-4 px-6">
                          <span className="text-sm text-slate-300">{asset.assignee || 'N/A'}</span>
                        </td>
                      )}
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-end space-x-2">
                          <button 
                            className="p-2 rounded-lg glass-morphism-hover text-slate-400 hover:text-white transition-colors hover:scale-110"
                            onClick={() => handleViewAsset(asset)}
                            title="View Asset"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <>
                              <button 
                                className="p-2 rounded-lg glass-morphism-hover text-slate-400 hover:text-green-400 transition-colors hover:scale-110"
                                onClick={() => navigate(`/assets-managment/edit/${asset.id}`)}
                                title="Edit Asset"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button 
                                className="p-2 rounded-lg glass-morphism-hover text-slate-400 hover:text-blue-400 transition-colors hover:scale-110"
                                onClick={() => handleOpenAssignModal(asset)}
                                title="Assign Asset"
                              >
                                <User className="w-4 h-4" />
                              </button>
                              <button 
                                className="p-2 rounded-lg glass-morphism-hover text-slate-400 hover:text-cyan-400 transition-colors hover:scale-110"
                                onClick={() => handleOpenHistoryLog(asset)}
                                title="View Asset Track Log"
                              >
                                <History className="w-4 h-4" />
                              </button>
                              <button 
                                className="p-2 rounded-lg glass-morphism-hover text-slate-400 hover:text-red-400 transition-colors hover:scale-110"
                                onClick={() => handleDeleteAsset(asset.id)}
                                title="Delete Asset"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          // Non-admin: Card view
          <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 mt-4 sm:mt-6 animate-fade-up">
            {filteredAssets.map((asset, index) => (
              <div key={asset.id} className="glass-morphism p-6 rounded-xl border border-slate-700/30 shadow-glow hover:shadow-glow-intense transition-all duration-300 hover:scale-[1.03] flex flex-col items-center relative" style={getAnimationDelay(index)}>
                <div className="mb-4">{getCategoryIcon(getCategoryName(asset.categoryId))}</div>
                <h3 className="text-lg font-semibold text-white mb-1 text-center">{asset.name}</h3>
                <p className="text-xs text-slate-400 mb-2 text-center">Serial: {asset.serialNumber}</p>
                <div className="mb-2">{getStatusBadge(asset.status)}</div>
                <div className="mb-2 text-sm text-slate-300 text-center">Category: {getCategoryName(asset.categoryId)}</div>
                <button
                  className="mt-2 btn-secondary px-4 py-2 rounded-lg text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/10 transition-all"
                  onClick={() => handleViewAsset(asset)}
                  title="View Asset"
                >
                  <Eye className="w-4 h-4 inline-block mr-1" /> View
                </button>
              </div>
            ))}
          </div>
        )}

        {filteredAssets.length === 0 && !loading &&(
          <div className="glass-morphism p-12 rounded-xl text-center border border-slate-700/30 shadow-glow animate-fade-up" style={{ animationDelay: '0.3s' }}>
            <Package className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-slate-400 to-slate-600 mb-2">
              {isAdmin ? 'No assets found' : 'No assets assigned to you'}
            </h3>
            <p className="text-slate-500 mb-6">
              {isAdmin 
                ? 'Try adjusting your search criteria or add a new asset.'
                : 'You don\'t have any assets assigned to you at the moment.'
              }
            </p>
            {isAdmin && (
              <button 
                className="btn-primary bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 hover:scale-105 transition-all duration-300"
                onClick={goToAddAssetPage}
              >
                <Plus className="w-4 h-4 inline-block mr-1" /> Add First Asset
              </button>
            )}
          </div>
        )}

        {isAssignModalOpen && (
          <AssignAssetModal
            asset={selectedAsset}
            onClose={() => setIsAssignModalOpen(false)}
            onAssetAssigned={handleAssetAssigned}
          />
        )}

        {viewingAsset && (
          <AssetView 
            asset={viewingAsset}
            onClose={() => setViewingAsset(null)}
            categories={categories}
          />
        )}

        {/* Modal for viewing all assets in full form view */}
        {showAllAssetsView && (
          <AllAssetsView assets={filteredAssets} user={user} onClose={() => setShowAllAssetsView(false)} />
        )}
      </div>
  );
};

export default AssetsPage;