import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Package, Plus, Search, Filter, MoreHorizontal, Edit, Trash2, Eye, Calendar, Grid3X3, User, Loader2, History, X, ArrowLeft, RotateCcw, FileText, FileSpreadsheet, Zap, Activity, Laptop, Smartphone, Tablet, Signal, Car, Boxes, Network, Upload, AlertTriangle, Download } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { assetService } from '../services/assetService';
import { exportService } from '../services/exportService';
import AssignAssetModal from '../components/AssignAssetModal';
import AssetHistoryList from '../components/AssetHistoryList';
import AssetView from '../components/AssetView';
import { useAuth } from '../contexts/AuthContext';
import logo from '../assets/logo.png';
import AllAssetsView from '../components/AllAssetsView';
import ImportAssetsModal from '../components/ImportAssetsModal';

const AssetsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, hasPermission, isLoading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
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
  const [showImportModal, setShowImportModal] = useState(false);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({ show: false, asset: null });
  const [selectedAssets, setSelectedAssets] = useState([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

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

  // Fetch assets — paint instantly from cache (if any), then refresh from network.
  const fetchAssets = async () => {
    try {
      setError(null);

      // Synchronous cache peek so the first paint shows data immediately,
      // skipping the loading spinner entirely on revisits.
      const cached = isAdmin
        ? assetService.peekAllAssets()
        : assetService.peekUserAssets();
      if (cached?.success && Array.isArray(cached.assets)) {
        setAssets(cached.assets);
        setLoading(false);
      } else {
        setLoading(true);
      }

      const result = isAdmin
        ? await assetService.getAllAssets()
        : await assetService.getUserAssets();

      if (result.success) {
        setAssets(result.assets);
      } else if (!cached) {
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

  // Update search query from URL params
  useEffect(() => {
    const urlSearch = searchParams.get('search');
    if (urlSearch) {
      setSearchQuery(urlSearch);
    }
  }, [searchParams]);

  // Navigate to the asset form page
  const goToAddAssetPage = () => {
    navigate('/assets/new');
  };

  // Handle asset deletion
  const handleDeleteAsset = (asset) => {
    setDeleteConfirmModal({ show: true, asset });
  };

  const confirmDelete = async () => {
    const { asset } = deleteConfirmModal;
    if (!asset) return;

    try {
      const result = await assetService.deleteAsset(asset.id);
      if (result.success) {
        // Refresh the assets list
        fetchAssets();
        setDeleteConfirmModal({ show: false, asset: null });
      } else {
        alert('Failed to delete asset: ' + result.error);
      }
    } catch (err) {
      alert('Failed to delete asset');
      console.error('Delete asset error:', err);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmModal({ show: false, asset: null });
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
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${statusClasses[status]}`}>
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

  // Determine SIM Type based on Plan value
  // If plan contains numbers (like 100, 200, 325) → postpaid
  // If plan is "prepaid" or no numbers → prepaid
  const getSimTypeFromPlan = (plan, existingSimType) => {
    // If simType is already set, use it
    if (existingSimType) return existingSimType;
    
    if (!plan) return null;
    
    const planStr = String(plan).toLowerCase().trim();
    
    // If plan explicitly says "prepaid"
    if (planStr === 'prepaid') return 'prepaid';
    
    // If plan contains numbers (like 100, 200, 325, etc.)
    if (/\d+/.test(planStr)) return 'postpaid';
    
    // Default to prepaid if no numbers found
    return 'prepaid';
  };

  // Filter by category first for statistics
  const categoryFilteredAssets = selectedCategory === 'all' 
    ? assets 
    : assets.filter(asset => asset.categoryId === selectedCategory);

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

  // Then apply additional filters for display and sort alphabetically
  const filteredAssets = categoryFilteredAssets
    .filter(asset => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = !q || (isAdmin ? 
        (asset.name?.toLowerCase() || '').includes(q) ||
        (asset.serialNumber?.toLowerCase() || '').includes(q) ||
        (asset.remark?.toLowerCase() || '').includes(q) : 
        true);
      const matchesStatus = selectedStatus === 'all' || asset.status === selectedStatus;
      
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      // Sort alphabetically by name (case-insensitive)
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

  // Calculate statistics based on category selection
  const categoryStats = {
    total: categoryFilteredAssets.length,
    using: categoryFilteredAssets.filter(asset => asset.status === 'using').length,
    free: categoryFilteredAssets.filter(asset => asset.status === 'free').length,
    maintenance: categoryFilteredAssets.filter(asset => asset.status === 'maintenance').length,
    retired: categoryFilteredAssets.filter(asset => asset.status === 'retired').length,
  };

  // Format assets data for export
  const formatAssetsForExport = () => {
    return filteredAssets.map(asset => {
      const categoryName = getCategoryName(asset.categoryId);
      const isSim = categoryName.toLowerCase() === 'sims';
      const derivedSimType = isSim ? getSimTypeFromPlan(asset.plan, asset.simType) : null;
      
      const baseData = {
        Name: asset.name,
        SerialNumber: asset.serialNumber,
        Category: categoryName,
        Status: asset.status === 'using' ? 'Using' : 
                asset.status === 'free' ? 'Free to Use' : 
                asset.status.charAt(0).toUpperCase() + asset.status.slice(1),
        AssignedTo: asset.status === 'free' ? 'N/A' : (asset.assignee && asset.assignee !== 'N/A' ? asset.assignee : 'N/A'),
      };
      
      // Add SIM-specific fields for SIMs category
      if (isSim) {
        baseData.SimType = derivedSimType ? (derivedSimType === 'postpaid' ? 'Postpaid' : 'Prepaid') : '-';
        baseData.Plan = asset.plan || '-';
      }
      
      baseData.Remark = asset.remark || '-';
      baseData.LastUpdated = new Date(asset.updatedAt).toLocaleDateString();
      
      return baseData;
    });
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

  const handleImportComplete = () => {
    fetchAssets();
  };

  // Selection handlers
  const handleSelectAsset = (assetId) => {
    setSelectedAssets(prev => 
      prev.includes(assetId) 
        ? prev.filter(id => id !== assetId)
        : [...prev, assetId]
    );
  };

  const handleSelectAll = () => {
    if (selectedAssets.length === filteredAssets.length) {
      setSelectedAssets([]);
    } else {
      setSelectedAssets(filteredAssets.map(asset => asset.id));
    }
  };

  const handleBulkDelete = () => {
    if (selectedAssets.length === 0) return;
    setShowBulkDeleteModal(true);
  };

  const confirmBulkDelete = async () => {
    try {
      // Delete all selected assets
      const deletePromises = selectedAssets.map(assetId => 
        assetService.deleteAsset(assetId)
      );
      
      await Promise.all(deletePromises);
      
      // Refresh and reset
      setShowBulkDeleteModal(false);
      setSelectedAssets([]);
      fetchAssets();
    } catch (err) {
      alert('Failed to delete some assets');
      console.error('Bulk delete error:', err);
    }
  };

  const cancelBulkDelete = () => {
    setShowBulkDeleteModal(false);
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
        <div className="flex flex-row items-center justify-between gap-2 sm:gap-4 animate-fade-in">
          <div className="flex-shrink-0 min-w-0">
            <h1 className="text-xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-0.5 sm:mb-2 truncate">
              {isAdmin ? 'Assets' : 'My Assets'}
            </h1>
            <p className="text-slate-400 text-xs sm:text-base truncate">
              {isAdmin ? 'Manage all IT assets' : 'View assigned assets'}
            </p>
          </div>
          <div className="flex flex-row items-center gap-2 sm:gap-3 flex-shrink-0">
            {isAdmin && (
              <>
                <button 
                  className="btn-secondary backdrop-blur-sm hover:scale-105 transition-all text-xs sm:text-sm px-2.5 sm:px-4 py-2 whitespace-nowrap flex-shrink-0"
                  onClick={() => setShowImportModal(true)}
                >
                  <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline-block mr-1" /> <span className="hidden xs:inline">Import</span>
                </button>
                <div className="relative z-[10000] flex-shrink-0" ref={exportMenuRef}>
                  <button 
                    className="btn-secondary backdrop-blur-sm hover:scale-105 transition-all text-xs sm:text-sm px-2.5 sm:px-4 py-2 whitespace-nowrap"
                    onClick={() => {
                      const node = exportMenuRef.current;
                      if (node) {
                        const rect = node.getBoundingClientRect();
                        setExportMenuPos({
                          top: rect.bottom + window.scrollY + 8,
                          left: rect.right + window.scrollX - 192,
                        });
                      }
                      setShowExportMenu((v) => !v);
                    }}
                  >
                    <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline-block mr-1" /> <span className="hidden xs:inline">Export</span>
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
                  className="btn-primary bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 hover:scale-105 transition-all duration-300 text-xs sm:text-sm px-2.5 sm:px-4 py-2 whitespace-nowrap flex-shrink-0"
                  onClick={goToAddAssetPage}
                >
                  <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline-block" /><span className="hidden xs:inline ml-1">Add</span>
                </button>
              </>
            )}
            {!isAdmin && filteredAssets.length > 0 && (
              <button
                className="btn-secondary px-3 sm:px-6 py-2 rounded-lg text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/10 transition-all font-semibold text-xs sm:text-sm whitespace-nowrap flex-shrink-0"
                onClick={() => setShowAllAssetsView(true)}
              >
                View All
              </button>
            )}
          </div>
        </div>

        {/* Statistics Cards - Responsive squares on mobile - Click to filter */}
        <div className={`grid grid-cols-2 sm:grid-cols-2 md:grid-cols-${isAdmin ? '4' : '2'} gap-2 sm:gap-4 animate-fade-up`}>
          {/* Total/My Assets Card */}
          <div 
            onClick={() => setSelectedStatus('all')}
            className={`glass-morphism rounded-lg sm:rounded-xl border shadow-glow hover:shadow-glow-intense transition-all duration-300 hover:scale-[1.02] p-2 sm:p-4 flex flex-row items-center active:scale-95 cursor-pointer group ${
              selectedStatus === 'all' 
                ? 'border-cyan-500/60 ring-2 ring-cyan-500/30 bg-cyan-500/10' 
                : 'border-cyan-500/20'
            }`}
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center bg-gradient-to-r from-cyan-500 to-blue-600 shadow-lg flex-shrink-0">
              <Package className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="flex flex-col items-end flex-1 ml-2 sm:ml-3">
              <span className="text-lg sm:text-xl font-bold text-white">{categoryStats.total}</span>
              <span className="text-[9px] sm:text-xs text-cyan-200/80 uppercase font-medium">
                {selectedCategory === 'all' ? (isAdmin ? 'TOTAL' : 'ASSETS') : getCategoryName(selectedCategory).substring(0, 6).toUpperCase()}
              </span>
            </div>
          </div>

          {/* Using Card */}
          <div 
            onClick={() => setSelectedStatus(selectedStatus === 'using' ? 'all' : 'using')}
            className={`glass-morphism rounded-lg sm:rounded-xl border shadow-glow hover:shadow-glow-intense transition-all duration-300 hover:scale-[1.02] p-2 sm:p-4 flex flex-row items-center active:scale-95 cursor-pointer group ${
              selectedStatus === 'using' 
                ? 'border-green-500/60 ring-2 ring-green-500/30 bg-green-500/10' 
                : 'border-green-500/20'
            }`}
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg flex-shrink-0">
              <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="flex flex-col items-end flex-1 ml-2 sm:ml-3">
              <span className="text-lg sm:text-xl font-bold text-white">{categoryStats.using}</span>
              <span className="text-[9px] sm:text-xs text-green-200/80 uppercase font-medium">USING</span>
            </div>
          </div>

          {isAdmin && (
            <>
              {/* Free to Use Card */}
              <div 
                onClick={() => setSelectedStatus(selectedStatus === 'free' ? 'all' : 'free')}
                className={`glass-morphism rounded-lg sm:rounded-xl border shadow-glow hover:shadow-glow-intense transition-all duration-300 hover:scale-[1.02] p-2 sm:p-4 flex flex-row items-center active:scale-95 cursor-pointer group ${
                  selectedStatus === 'free' 
                    ? 'border-blue-500/60 ring-2 ring-blue-500/30 bg-blue-500/10' 
                    : 'border-blue-500/20'
                }`}
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center bg-gradient-to-r from-blue-500 to-indigo-600 shadow-lg flex-shrink-0">
                  <Package className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="flex flex-col items-end flex-1 ml-2 sm:ml-3">
                  <span className="text-lg sm:text-xl font-bold text-white">{categoryStats.free}</span>
                  <span className="text-[9px] sm:text-xs text-blue-200/80 uppercase font-medium">FREE</span>
                </div>
              </div>

              {/* Maintenance Card */}
              <div 
                onClick={() => setSelectedStatus(selectedStatus === 'maintenance' ? 'all' : 'maintenance')}
                className={`glass-morphism rounded-lg sm:rounded-xl border shadow-glow hover:shadow-glow-intense transition-all duration-300 hover:scale-[1.02] p-2 sm:p-4 flex flex-row items-center active:scale-95 cursor-pointer group ${
                  selectedStatus === 'maintenance' 
                    ? 'border-yellow-500/60 ring-2 ring-yellow-500/30 bg-yellow-500/10' 
                    : 'border-yellow-500/20'
                }`}
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center bg-gradient-to-r from-yellow-500 to-amber-600 shadow-lg flex-shrink-0">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="flex flex-col items-end flex-1 ml-2 sm:ml-3">
                  <span className="text-lg sm:text-xl font-bold text-white">{categoryStats.maintenance}</span>
                  <span className="text-[9px] sm:text-xs text-yellow-200/80 uppercase font-medium">MAINT.</span>
                </div>
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

        {/* Bulk Actions Bar */}
        {isAdmin && selectedAssets.length > 0 && (
          <div className="glass-morphism p-4 rounded-xl border border-cyan-500/30 shadow-glow animate-fade-in">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-cyan-400 font-bold">{selectedAssets.length}</span>
                </div>
                <div>
                  <p className="text-white font-semibold">{selectedAssets.length} asset{selectedAssets.length > 1 ? 's' : ''} selected</p>
                  <p className="text-slate-400 text-sm">Choose an action to perform</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 w-full sm:w-auto">
                <button
                  onClick={() => setSelectedAssets([])}
                  className="btn-secondary backdrop-blur-sm hover:scale-105 transition-all flex-1 sm:flex-none"
                >
                  Clear Selection
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="btn-primary bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 hover:scale-105 transition-all duration-300 flex items-center justify-center space-x-2 flex-1 sm:flex-none"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Selected</span>
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
                    {isAdmin && (
                      <th className="text-left py-4 px-2 md:px-3 text-sm font-medium text-slate-300 w-8 md:w-10">
                        <input
                          type="checkbox"
                          checked={selectedAssets.length === filteredAssets.length && filteredAssets.length > 0}
                          onChange={handleSelectAll}
                          className="w-3.5 h-3.5 md:w-4 md:h-4 text-cyan-500 focus:ring-cyan-500 rounded cursor-pointer checkbox-table-select"
                          title="Select All"
                        />
                      </th>
                    )}
                    <th className="text-left py-4 px-3 text-sm font-medium text-slate-300 w-[320px]">Asset</th>
                    <th className="text-left py-4 px-3 text-sm font-medium text-slate-300 w-[100px]">Category</th>
                    <th className="text-left py-4 px-3 text-sm font-medium text-slate-300 w-[110px]">Status</th>
                    {isAdmin && <th className="text-left py-4 px-3 text-sm font-medium text-slate-300">Assigned To</th>}
                    <th className="text-left py-4 px-3 text-sm font-medium text-slate-300">Remark</th>
                    <th className="text-right py-4 px-3 text-sm font-medium text-slate-300 w-[180px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredAssets.map((asset, index) => {
                    const isSelected = selectedAssets.includes(asset.id);
                    return (
                      <tr 
                        key={asset.id} 
                        className={`hover:bg-gradient-to-r hover:from-slate-800/30 hover:to-slate-900/30 transition-colors animate-fade-up ${
                          isSelected ? 'bg-cyan-500/10 border-l-2 border-cyan-500' : ''
                        }`}
                        style={getAnimationDelay(index)}
                      >
                        {isAdmin && (
                          <td className="py-3 px-2 md:px-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleSelectAsset(asset.id)}
                              className="w-3.5 h-3.5 md:w-4 md:h-4 text-cyan-500 focus:ring-cyan-500 rounded cursor-pointer checkbox-table-select"
                            />
                          </td>
                        )}
                        <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center flex-shrink-0">
                            {getCategoryIcon(getCategoryName(asset.categoryId))}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-medium text-white">{highlightSearch(asset.name, searchQuery)}</h3>
                            <p className="text-xs text-slate-400">{highlightSearch(asset.serialNumber, searchQuery)}</p>
                            {getCategoryName(asset.categoryId).toLowerCase() === 'sims' && (
                              (() => {
                                const derivedSimType = getSimTypeFromPlan(asset.plan, asset.simType);
                                return derivedSimType || asset.plan ? (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {derivedSimType && (
                                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${
                                        derivedSimType === 'postpaid' 
                                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                                          : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                      }`}>
                                        {derivedSimType === 'postpaid' ? 'Postpaid' : 'Prepaid'}
                                      </span>
                                    )}
                                    {derivedSimType === 'postpaid' && asset.plan && (
                                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 whitespace-nowrap">
                                        {asset.plan}
                                      </span>
                                    )}
                                  </div>
                                ) : null;
                              })()
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-sm text-slate-300 whitespace-nowrap">{getCategoryName(asset.categoryId)}</span>
                      </td>
                      <td className="py-3 px-3">
                        {getStatusBadge(asset.status)}
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-3">
                          <span className="text-sm text-slate-300">
                            {asset.status === 'free' ? 'N/A' : (asset.assignee && asset.assignee !== 'N/A' ? asset.assignee : 'N/A')}
                          </span>
                        </td>
                      )}
                      <td className="py-3 px-3">
                        <span className="text-sm text-slate-400 max-w-[200px] truncate block" title={asset.remark || ''}>
                          {highlightSearch(asset.remark || '-', searchQuery)}
                        </span>
                      </td>
                      <td className="py-3 px-3">
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
                                onClick={() => navigate(`/assets/edit/${asset.id}`)}
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
                                onClick={() => handleDeleteAsset(asset)}
                                title="Delete Asset"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
                {getCategoryName(asset.categoryId).toLowerCase() === 'sims' && (asset.simType || asset.plan) && (
                  <div className="flex flex-wrap justify-center gap-1 mb-2">
                    {asset.simType && (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        asset.simType === 'postpaid' 
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                          : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                      }`}>
                        {asset.simType === 'postpaid' ? 'Postpaid' : 'Prepaid'}
                      </span>
                    )}
                    {asset.simType === 'postpaid' && asset.plan && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                        {asset.plan}
                      </span>
                    )}
                  </div>
                )}
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

        {/* Import Assets Modal */}
        {showImportModal && (
          <ImportAssetsModal 
            onClose={() => setShowImportModal(false)}
            onImportComplete={handleImportComplete}
            categories={categories}
          />
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmModal.show && deleteConfirmModal.asset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm animate-fade-in p-4">
            <div className="glass-morphism bg-slate-900/95 border border-red-500/30 rounded-xl shadow-2xl w-full max-w-md p-6 animate-fade-up">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-red-400">Delete Asset?</h2>
              </div>
              
              <div className="mb-6">
                <p className="text-slate-300 mb-2">
                  Are you sure you want to delete <span className="font-semibold text-white">"{deleteConfirmModal.asset.name}"</span>?
                </p>
                {deleteConfirmModal.asset.serialNumber && (
                  <p className="text-sm text-slate-400 mb-2">
                    Serial Number: {deleteConfirmModal.asset.serialNumber}
                  </p>
                )}
                <p className="text-slate-400 text-sm">
                  This action cannot be undone. All asset data and history will be permanently removed.
                </p>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button 
                  type="button"
                  className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-all duration-200 hover:scale-105"
                  onClick={cancelDelete}
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-medium transition-all duration-200 hover:scale-105 shadow-glow-error"
                  onClick={confirmDelete}
                >
                  Delete Asset
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Delete Confirmation Modal */}
        {showBulkDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm animate-fade-in p-4">
            <div className="glass-morphism bg-slate-900/95 border border-red-500/30 rounded-xl shadow-2xl w-full max-w-md p-6 animate-fade-up">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-red-400">Delete Multiple Assets?</h2>
              </div>
              
              <div className="mb-6">
                <p className="text-slate-300 mb-2">
                  Are you sure you want to delete <span className="font-semibold text-white">{selectedAssets.length} asset{selectedAssets.length > 1 ? 's' : ''}</span>?
                </p>
                <div className="bg-slate-800/50 rounded-lg p-3 mb-3 max-h-48 overflow-y-auto">
                  <p className="text-sm text-slate-400 mb-2">Selected assets:</p>
                  <ul className="space-y-1">
                    {filteredAssets
                      .filter(asset => selectedAssets.includes(asset.id))
                      .map(asset => (
                        <li key={asset.id} className="text-sm text-slate-300 flex items-center space-x-2">
                          <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                          <span>{asset.name}</span>
                          {asset.serialNumber && (
                            <span className="text-slate-500">({asset.serialNumber})</span>
                          )}
                        </li>
                      ))
                    }
                  </ul>
                </div>
                <p className="text-slate-400 text-sm">
                  This action cannot be undone. All selected assets and their history will be permanently removed.
                </p>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button 
                  type="button"
                  className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-all duration-200 hover:scale-105"
                  onClick={cancelBulkDelete}
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-medium transition-all duration-200 hover:scale-105 shadow-glow-error"
                  onClick={confirmBulkDelete}
                >
                  Delete {selectedAssets.length} Asset{selectedAssets.length > 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
  );
};

export default AssetsPage;