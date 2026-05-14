import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Ticket, Plus, Search, Filter, MoreHorizontal, Edit, Eye, MessageSquare, Clock, User, AlertTriangle, X, Check, Trash2, ArrowDownUp, CheckCircle, Timer } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTickets } from '../contexts/TicketContext';
import ticketService from '../services/ticketService';

const TicketsPage = () => {
  const { user } = useAuth();
  const { refreshTicketCount } = useTickets();
  const [searchParams] = useSearchParams();
  const isAdmin = user?.role === 'admin';
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    openCount: 0,
    inProgressCount: 0,
    resolvedCount: 0,
    resolvedToday: 0,
    avgResolutionTime: 0
  });
  
  // State for ticket details modal
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [modalMode, setModalMode] = useState('view'); // 'view', 'edit', or 'comment'
  const [ticketComments, setTicketComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [editedTicket, setEditedTicket] = useState({});
  
  // Form state for creating a new ticket
  const [newTicket, setNewTicket] = useState({
    title: '',
    description: '',
      category: 'Hardware',
    priority: 'medium',
    dueDate: ''
  });


  // Add state for delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [ticketToDelete, setTicketToDelete] = useState(null);

  // Add state for comment loading
  const [commentLoading, setCommentLoading] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  // Add state for sort dropdown
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [createdSort, setCreatedSort] = useState('newest'); // 'newest' or 'oldest'
  const sortDropdownRef = useRef(null);

  // Load tickets and stats on component mount
  useEffect(() => {
    fetchTickets();
    fetchStats();
  }, [isAdmin]);

  // Update search query from URL params
  useEffect(() => {
    const urlSearch = searchParams.get('search');
    if (urlSearch) {
      setSearchQuery(urlSearch);
    }
  }, [searchParams]);

  // Fetch tickets based on user role — paint instantly from cache when available.
  const fetchTickets = async () => {
    try {
      setError(null);

      const cached = isAdmin
        ? ticketService.peekAllTickets()
        : ticketService.peekUserTickets();
      if (cached?.success && Array.isArray(cached.tickets)) {
        setTickets(cached.tickets);
        setLoading(false);
      } else {
        setLoading(true);
      }

      const result = isAdmin
        ? await ticketService.getAllTickets()
        : await ticketService.getUserTickets();

      if (result.success) {
        setTickets(result.tickets || []);
      } else if (!cached) {
        console.error("Failed to fetch tickets:", result.error);
        setError(result.error || 'Failed to fetch tickets');
        setTickets([]);
      }
    } catch (err) {
      console.error('Fetch tickets error:', err);
      setError('Failed to fetch tickets');
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch ticket statistics
  const fetchStats = async () => {
    try {
      const result = await ticketService.getTicketStats();
      if (result.success) {
        setStats(result.stats || {
          openCount: 0,
          inProgressCount: 0,
          resolvedCount: 0,
          resolvedToday: 0,
          avgResolutionTime: 0
        });
      } else {
        console.error('Failed to fetch stats:', result.error);
      }
    } catch (err) {
      console.error('Fetch stats error:', err);
    }
  };

  // Handle input changes for new ticket form
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewTicket(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Handle input changes for edited ticket form
  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditedTicket(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle ticket creation
  const handleCreateTicket = async (e) => {
    e.preventDefault();
    
    try {
      const result = await ticketService.createTicket(newTicket);
      
      if (result.success) {
        // Reset form and close modal
        setNewTicket({
          title: '',
          description: '',
          category: 'Hardware',
    priority: 'medium',
          dueDate: ''
        });
        setShowCreateModal(false);
        
        // Refresh tickets and stats
        fetchTickets();
        fetchStats();
        refreshTicketCount(); // Update sidebar badge immediately
      } else {
        alert('Failed to create ticket: ' + result.error);
      }
    } catch (err) {
      alert('Failed to create ticket');
      console.error('Create ticket error:', err);
    }
  };
  
  // Handle viewing ticket details
  const handleViewTicket = async (ticket) => {
    setSelectedTicket(ticket);
    setModalMode('view');
    setShowTicketModal(true);
    
    try {
      // Fetch comments for this ticket
      const result = await ticketService.getTicketComments(ticket.id);
      if (result.success) {
        setTicketComments(result.comments || []);
      } else {
        setTicketComments([]);
      }
    } catch (err) {
      console.error('Fetch comments error:', err);
      setTicketComments([]);
    }
  };
  
  // Handle editing ticket
  const handleEditTicket = (ticket) => {
    setSelectedTicket(ticket);
    setEditedTicket({
      title: ticket.title,
      description: ticket.description,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status, // Status will be included but not shown to non-admins
      dueDate: ticket.dueDate ? new Date(ticket.dueDate).toISOString().split('T')[0] : '',
    });
    setModalMode('edit');
    setShowTicketModal(true);
  };
  
  // Handle commenting on ticket
  const handleCommentTicket = (ticket) => {
    setSelectedTicket(ticket);
    setModalMode('comment');
    setShowTicketModal(true);
    setCommentLoading(true);
    // Fetch comments for this ticket
    ticketService.getTicketComments(ticket.id)
      .then(result => {
        if (result.success) {
          setTicketComments(result.comments || []);
        } else {
          setTicketComments([]);
        }
      })
      .catch(err => {
        console.error('Fetch comments error:', err);
        setTicketComments([]);
      })
      .finally(() => setCommentLoading(false));
  };
  
  // Handle submitting a comment
  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setSubmittingComment(true);
    try {
      const result = await ticketService.addComment(selectedTicket.id, newComment);
      if (result.success) {
        setNewComment(''); // Clear input
        // Refresh comments
        setCommentLoading(true);
        const commentsResult = await ticketService.getTicketComments(selectedTicket.id);
        if (commentsResult.success) {
          setTicketComments(commentsResult.comments || []);
        } else {
          setTicketComments([]);
        }
        setCommentLoading(false);
      }
    } catch (err) {
      console.error('Submit comment error:', err);
      setCommentLoading(false);
    } finally {
      setSubmittingComment(false);
    }
  };
  
  // Handle saving edited ticket
  const handleSaveTicket = async (e) => {
    e.preventDefault();
    
    try {
      // Create a copy of the edited ticket data
      const ticketData = { ...editedTicket };
      
      // Remove status field for non-admin users
      if (!isAdmin) {
        delete ticketData.status;
      }
      
      const result = await ticketService.updateTicket(selectedTicket.id, ticketData);
      
      if (result.success) {
        // Close modal
        setShowTicketModal(false);
        
        // Refresh tickets and stats
        fetchTickets();
        fetchStats();
        refreshTicketCount(); // Update sidebar badge immediately
      } else {
        alert('Failed to update ticket: ' + result.error);
      }
    } catch (err) {
      alert('Failed to update ticket');
      console.error('Update ticket error:', err);
    }
  };
  
  // Handle closing the ticket modal
  const handleCloseTicketModal = () => {
    setShowTicketModal(false);
    setSelectedTicket(null);
    setTicketComments([]);
    setNewComment('');
    setEditedTicket({});
  };

  // Handle status change directly from the list
  const handleStatusChange = async (ticketId, newStatus) => {
    try {
      const result = await ticketService.updateTicket(ticketId, { status: newStatus });
      
      if (result.success) {
        // Refresh tickets and stats
        fetchTickets();
        fetchStats();
        refreshTicketCount(); // Update sidebar badge immediately
      } else {
        alert('Failed to update ticket status: ' + result.error);
      }
    } catch (err) {
      alert('Failed to update ticket status');
      console.error('Update ticket status error:', err);
    }
  };
  
  // Cycle through statuses: open -> in-progress -> resolved -> open
  const handleStatusCycle = async (ticketId, currentStatus) => {
    const statusCycle = {
      'open': 'in-progress',
      'in-progress': 'resolved',
      'resolved': 'open'
    };
    
    const nextStatus = statusCycle[currentStatus] || 'open';
    await handleStatusChange(ticketId, nextStatus);
  };

  // Show delete confirmation modal
  const handleDeleteTicket = (ticketId) => {
    setTicketToDelete(ticketId);
    setShowDeleteModal(true);
  };

  // Confirm delete
  const confirmDeleteTicket = async () => {
    if (!ticketToDelete) return;
    try {
      const result = await ticketService.deleteTicket(ticketToDelete);
      if (result.success) {
        fetchTickets();
        fetchStats();
        refreshTicketCount(); // Update sidebar badge immediately
      } else {
        alert('Failed to delete ticket: ' + result.error);
      }
    } catch (err) {
      alert('Failed to delete ticket');
      console.error('Delete ticket error:', err);
    } finally {
      setShowDeleteModal(false);
      setTicketToDelete(null);
    }
  };

  // Cancel delete
  const cancelDeleteTicket = () => {
    setShowDeleteModal(false);
    setTicketToDelete(null);
  };

  const getPriorityBadge = (priority) => {
    const priorityClasses = {
      low: 'priority-low',
      medium: 'priority-medium',
      high: 'priority-high',
      critical: 'priority-critical',
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${priorityClasses[priority]}`}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </span>
    );
  };

  const getStatusBadge = (status) => {
    const statusClasses = {
      open: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      'in-progress': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
      resolved: 'bg-green-500/20 text-green-300 border-green-500/30',
      closed: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${statusClasses[status]}`}>
        {status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
      </span>
    );
  };

  const getInitials = (fullname) => {
    if (!fullname) return 'U';
    
    // Split the fullname and get initials from up to two parts
    const nameParts = fullname.split(' ');
    if (nameParts.length === 1) {
      return nameParts[0].charAt(0).toUpperCase();
    } else {
      return `${nameParts[0].charAt(0)}${nameParts[nameParts.length - 1].charAt(0)}`.toUpperCase();
    }
  };

  const formatTimeAgo = (date) => {
    if (!date) return '';
    
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
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
      return new Date(date).toLocaleDateString();
    }
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

  // Filter tickets based on search and filters
  const filteredTickets = (tickets || []).filter(ticket => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = !q ||
      ticket.title?.toLowerCase().includes(q) ||
      ticket.description?.toLowerCase().includes(q) ||
      ticket.category?.toLowerCase().includes(q);
    const matchesPriority = selectedPriority === 'all' || ticket.priority === selectedPriority;
    const matchesStatus = selectedStatus === 'all' || ticket.status === selectedStatus;
    
    return matchesSearch && matchesPriority && matchesStatus;
  });

  // Handle sort dropdown outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target)) {
        setShowSortDropdown(false);
      }
    }
    if (showSortDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSortDropdown]);

  // Handle sort change
  const handleSortChange = (sort) => {
    setCreatedSort(sort);
    setShowSortDropdown(false);
  };

  // Sort tickets by created time
  const sortedTickets = [...filteredTickets].sort((a, b) => {
    if (createdSort === 'newest') {
      return new Date(b.createdAt) - new Date(a.createdAt);
    } else {
      return new Date(a.createdAt) - new Date(b.createdAt);
    }
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-row items-center justify-between gap-2 sm:gap-4 animate-fade-in">
        <div className="flex-shrink-0 min-w-0">
          <h1 className="text-xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-0.5 sm:mb-2 truncate">Tickets</h1>
          <p className="text-slate-400 text-xs sm:text-base truncate">
            {isAdmin ? 'Manage support requests' : 'Your support tickets'}
          </p>
        </div>
        <div className="flex flex-row items-center gap-2 sm:gap-3 flex-shrink-0">
          {isAdmin && (
            <div className="relative z-[10000]" ref={sortDropdownRef}>
              <button 
                className="btn-secondary flex items-center gap-1.5 sm:gap-2 backdrop-blur-sm hover:scale-105 transition-all text-xs sm:text-sm px-2.5 sm:px-4 py-2"
                onClick={() => setShowSortDropdown((v) => !v)}
              >
                <ArrowDownUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">Sort</span>
              </button>
              {showSortDropdown && (
                <div className="absolute right-0 mt-2 w-48 glass-morphism rounded-lg shadow-glow z-[10001] animate-fade-down">
                  <div className="p-2">
                    <div className="text-xs text-slate-400 mb-2">Created Time</div>
                    <button
                      className={`w-full text-left px-3 py-2 rounded hover:bg-white/10 ${createdSort === 'newest' ? 'bg-blue-500/10 text-blue-400' : 'text-slate-300'}`}
                      onClick={() => handleSortChange('newest')}
                    >
                      Newest First
                    </button>
                    <button
                      className={`w-full text-left px-3 py-2 rounded hover:bg-white/10 ${createdSort === 'oldest' ? 'bg-blue-500/10 text-blue-400' : 'text-slate-300'}`}
                      onClick={() => handleSortChange('oldest')}
                    >
                      Oldest First
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          <button 
            className="btn-primary bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 hover:scale-105 transition-all duration-300 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-2.5 sm:px-4 py-2 whitespace-nowrap"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden xs:inline">New Ticket</span><span className="xs:hidden">New</span>
          </button>
        </div>
      </div>

      {/* Statistics Cards - Compact horizontal layout - Admin view - Click to filter */}
      {isAdmin && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 animate-fade-up">
          {/* Open Tickets Card */}
          <div 
            onClick={() => setSelectedStatus(selectedStatus === 'open' ? 'all' : 'open')}
            className={`glass-morphism rounded-lg sm:rounded-xl border shadow-glow hover:shadow-glow-intense transition-all duration-300 hover:scale-[1.02] p-2 sm:p-4 flex flex-row items-center active:scale-95 cursor-pointer group ${
              selectedStatus === 'open' 
                ? 'border-orange-500/60 ring-2 ring-orange-500/30 bg-orange-500/10' 
                : 'border-orange-500/20'
            }`}
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center bg-gradient-to-r from-orange-500 to-red-600 shadow-lg flex-shrink-0">
              <Ticket className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="flex flex-col items-end flex-1 ml-2 sm:ml-3">
              <span className="text-lg sm:text-xl font-bold text-white">{stats.openCount}</span>
              <span className="text-[9px] sm:text-xs text-orange-200/80 uppercase font-medium">OPEN</span>
            </div>
          </div>

          {/* In Progress Card */}
          <div 
            onClick={() => setSelectedStatus(selectedStatus === 'in-progress' ? 'all' : 'in-progress')}
            className={`glass-morphism rounded-lg sm:rounded-xl border shadow-glow hover:shadow-glow-intense transition-all duration-300 hover:scale-[1.02] p-2 sm:p-4 flex flex-row items-center active:scale-95 cursor-pointer group ${
              selectedStatus === 'in-progress' 
                ? 'border-yellow-500/60 ring-2 ring-yellow-500/30 bg-yellow-500/10' 
                : 'border-yellow-500/20'
            }`}
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center bg-gradient-to-r from-yellow-500 to-amber-600 shadow-lg flex-shrink-0">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="flex flex-col items-end flex-1 ml-2 sm:ml-3">
              <span className="text-lg sm:text-xl font-bold text-white">{stats.inProgressCount}</span>
              <span className="text-[9px] sm:text-xs text-yellow-200/80 uppercase font-medium">PROGRESS</span>
            </div>
          </div>

          {/* Resolved Today Card */}
          <div 
            onClick={() => setSelectedStatus(selectedStatus === 'resolved' ? 'all' : 'resolved')}
            className={`glass-morphism rounded-lg sm:rounded-xl border shadow-glow hover:shadow-glow-intense transition-all duration-300 hover:scale-[1.02] p-2 sm:p-4 flex flex-row items-center active:scale-95 cursor-pointer group ${
              selectedStatus === 'resolved' 
                ? 'border-green-500/60 ring-2 ring-green-500/30 bg-green-500/10' 
                : 'border-green-500/20'
            }`}
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg flex-shrink-0">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="flex flex-col items-end flex-1 ml-2 sm:ml-3">
              <span className="text-lg sm:text-xl font-bold text-white">{stats.resolvedToday}</span>
              <span className="text-[9px] sm:text-xs text-green-200/80 uppercase font-medium">DONE</span>
            </div>
          </div>

          {/* Avg Resolution Card - Shows all when clicked */}
          <div 
            onClick={() => setSelectedStatus('all')}
            className={`glass-morphism rounded-lg sm:rounded-xl border shadow-glow hover:shadow-glow-intense transition-all duration-300 hover:scale-[1.02] p-2 sm:p-4 flex flex-row items-center active:scale-95 cursor-pointer group ${
              selectedStatus === 'all' 
                ? 'border-cyan-500/60 ring-2 ring-cyan-500/30 bg-cyan-500/10' 
                : 'border-cyan-500/20'
            }`}
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center bg-gradient-to-r from-cyan-500 to-blue-600 shadow-lg flex-shrink-0">
              <Timer className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="flex flex-col items-end flex-1 ml-2 sm:ml-3">
              <span className="text-lg sm:text-xl font-bold text-white">{stats.avgResolutionTime}h</span>
              <span className="text-[9px] sm:text-xs text-cyan-200/80 uppercase font-medium">AVG</span>
            </div>
          </div>
        </div>
      )}

      {/* Employee ticket stats - Compact horizontal layout - Click to filter */}
      {!isAdmin && (
        <div className="grid grid-cols-3 gap-2 sm:gap-4 animate-fade-up">
          {/* Your Open Tickets Card */}
          <div 
            onClick={() => setSelectedStatus(selectedStatus === 'open' ? 'all' : 'open')}
            className={`glass-morphism rounded-lg sm:rounded-xl border shadow-glow hover:shadow-glow-intense transition-all duration-300 hover:scale-[1.02] p-2 sm:p-4 flex flex-row items-center active:scale-95 cursor-pointer group ${
              selectedStatus === 'open' 
                ? 'border-orange-500/60 ring-2 ring-orange-500/30 bg-orange-500/10' 
                : 'border-orange-500/20'
            }`}
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center bg-gradient-to-r from-orange-500 to-red-600 shadow-lg flex-shrink-0">
              <Ticket className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="flex flex-col items-end flex-1 ml-2 sm:ml-3">
              <span className="text-lg sm:text-xl font-bold text-white">{stats.openCount}</span>
              <span className="text-[9px] sm:text-xs text-orange-200/80 uppercase font-medium">OPEN</span>
            </div>
          </div>

          {/* In Progress Card */}
          <div 
            onClick={() => setSelectedStatus(selectedStatus === 'in-progress' ? 'all' : 'in-progress')}
            className={`glass-morphism rounded-lg sm:rounded-xl border shadow-glow hover:shadow-glow-intense transition-all duration-300 hover:scale-[1.02] p-2 sm:p-4 flex flex-row items-center active:scale-95 cursor-pointer group ${
              selectedStatus === 'in-progress' 
                ? 'border-yellow-500/60 ring-2 ring-yellow-500/30 bg-yellow-500/10' 
                : 'border-yellow-500/20'
            }`}
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center bg-gradient-to-r from-yellow-500 to-amber-600 shadow-lg flex-shrink-0">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="flex flex-col items-end flex-1 ml-2 sm:ml-3">
              <span className="text-lg sm:text-xl font-bold text-white">{stats.inProgressCount}</span>
              <span className="text-[9px] sm:text-xs text-yellow-200/80 uppercase font-medium">PROGRESS</span>
            </div>
          </div>

          {/* Resolved Card */}
          <div 
            onClick={() => setSelectedStatus(selectedStatus === 'resolved' ? 'all' : 'resolved')}
            className={`glass-morphism rounded-lg sm:rounded-xl border shadow-glow hover:shadow-glow-intense transition-all duration-300 hover:scale-[1.02] p-2 sm:p-4 flex flex-row items-center active:scale-95 cursor-pointer group ${
              selectedStatus === 'resolved' 
                ? 'border-green-500/60 ring-2 ring-green-500/30 bg-green-500/10' 
                : 'border-green-500/20'
            }`}
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg flex-shrink-0">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="flex flex-col items-end flex-1 ml-2 sm:ml-3">
              <span className="text-lg sm:text-xl font-bold text-white">{stats.resolvedCount}</span>
              <span className="text-[9px] sm:text-xs text-green-200/80 uppercase font-medium">DONE</span>
            </div>
          </div>
        </div>
      )}

      {/* Create Ticket Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="glass-morphism rounded-xl w-full max-w-xs sm:max-w-md md:max-w-2xl max-h-[90vh] overflow-y-auto p-2 sm:p-4 md:p-8">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-white">Create New Ticket</h3>
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form className="space-y-4" onSubmit={handleCreateTicket}>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Title</label>
                  <input 
                    type="text" 
                    name="title"
                    value={newTicket.title}
                    onChange={handleInputChange}
                    className="input-field w-full" 
                    placeholder="Brief description of the issue" 
                    required
                  />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                  <textarea 
                    name="description"
                    value={newTicket.description}
                    onChange={handleInputChange}
                    className="input-field w-full h-24" 
                    placeholder="Detailed description of the issue"
                    required
                  ></textarea>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Category</label>
                    <select 
                      name="category"
                      value={newTicket.category}
                      onChange={handleInputChange}
                      className="input-field w-full"
                    >
                      <option value="Hardware">Hardware</option>
                      <option value="Software">Software</option>
                      <option value="Network">Network</option>
                      <option value="Access">Access</option>
                      <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Priority</label>
                    <select 
                      name="priority"
                      value={newTicket.priority}
                      onChange={handleInputChange}
                      className="input-field w-full"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Due Date (Optional)</label>
                    <input 
                      type="date" 
                      name="dueDate"
                      value={newTicket.dueDate}
                      onChange={handleInputChange}
                      className="input-field w-full" 
                    />
              </div>
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <button 
                type="button" 
                className="btn-secondary"
                    onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary">Submit Ticket</button>
            </div>
          </form>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="glass-morphism p-6 rounded-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search tickets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pl-10 w-full"
            />
          </div>
          <div className="flex items-center space-x-4">
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="input-field"
            >
              <option value="all">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="input-field"
              size="1"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="in-progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="glass-morphism p-12 rounded-xl text-center border border-slate-700/30 shadow-glow animate-pulse">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 bg-cyan-500/20 rounded-full animate-ping"></div>
            <Ticket className="w-16 h-16 text-cyan-400 mx-auto relative animate-spin" />
          </div>
          <h3 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-2">Loading tickets...</h3>
          <p className="text-slate-500">Please wait while AI processes your data</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="glass-morphism p-6 rounded-xl bg-red-500/10 border border-red-500/30 shadow-glow-error animate-fade-in">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <h3 className="text-xl font-semibold text-red-400 mb-2">Error loading tickets</h3>
          <p className="text-slate-500 mb-6">{error}</p>
          <button 
            className="btn-primary bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 hover:scale-105 transition-all duration-300"
            onClick={fetchTickets}
          >
            Retry
          </button>
        </div>
      )}

      {/* Tickets Table */}
      {!loading && !error && (
      <div className="glass-morphism rounded-xl overflow-hidden animate-fade-up" style={{ animationDelay: '0.2s' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Ticket</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Priority</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Created</th>
                {isAdmin && (
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Created By</th>
                )}
                <th className="px-6 py-4 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedTickets.length > 0 ? (
                sortedTickets.map((ticket, index) => {
                  const getAnimationDelay = (i) => ({ animationDelay: `${i * 0.05}s` });
                  return (
                    <tr key={ticket.id} className="border-b border-white/5 hover:bg-white/5 animate-fade-up" style={getAnimationDelay(index)}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-white">{highlightSearch(ticket.title, searchQuery)}</div>
                          <div className="text-sm text-slate-400">{highlightSearch(ticket.category, searchQuery)}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getPriorityBadge(ticket.priority)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(ticket.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                        {formatTimeAgo(ticket.createdAt)}
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 flex items-center justify-center text-xs text-white font-medium">
                                {getInitials(ticket.createdBy?.fullname)}
                            </div>
                            <div className="ml-3">
                                <div className="text-sm font-medium text-white">{ticket.createdBy?.fullname}</div>
                                <div className="text-sm text-slate-400">{ticket.createdBy?.department}</div>
                            </div>
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <div className="flex items-center justify-center space-x-2">
                            {/* Status Change Button - only for admins - cycles through statuses on click */}
                            {isAdmin && (
                              <button 
                                className="px-3 py-1.5 rounded-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 text-xs font-medium border shadow-sm"
                                onClick={() => handleStatusCycle(ticket.id, ticket.status)}
                                title={`Click to change status: ${ticket.status === 'open' ? 'Open → In Progress' : ticket.status === 'in-progress' ? 'In Progress → Resolved' : 'Resolved → Open'}`}
                                style={{
                                  color: 
                                    ticket.status === 'open' ? '#60a5fa' : 
                                    ticket.status === 'in-progress' ? '#fbbf24' : 
                                    ticket.status === 'resolved' ? '#4ade80' : 
                                    '#94a3b8',
                                  borderColor:
                                    ticket.status === 'open' ? '#3b82f6' : 
                                    ticket.status === 'in-progress' ? '#eab308' : 
                                    ticket.status === 'resolved' ? '#22c55e' : 
                                    '#64748b',
                                  backgroundColor:
                                    ticket.status === 'open' ? 'rgba(59, 130, 246, 0.1)' : 
                                    ticket.status === 'in-progress' ? 'rgba(234, 179, 8, 0.1)' : 
                                    ticket.status === 'resolved' ? 'rgba(34, 197, 94, 0.1)' : 
                                    'rgba(148, 163, 184, 0.1)'
                                }}
                              >
                                <div className="w-2 h-2 rounded-full" 
                                  style={{
                                    backgroundColor: 
                                      ticket.status === 'open' ? '#3b82f6' : 
                                      ticket.status === 'in-progress' ? '#eab308' : 
                                      ticket.status === 'resolved' ? '#22c55e' : 
                                      '#94a3b8'
                                  }}
                                />
                                <span className="whitespace-nowrap">
                                  {ticket.status === 'open' ? 'Open' : 
                                   ticket.status === 'in-progress' ? 'In Progress' : 
                                   ticket.status === 'resolved' ? 'Resolved' :
                                   'Closed'}
                                </span>
                              </button>
                            )}
                            {/* View, Edit, Comment, Delete - rest of actions */}
                            <button 
                              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                              onClick={() => handleViewTicket(ticket)}
                              title="View ticket details"
                            >
                            <Eye className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                              <button 
                                className="p-1 rounded-lg hover:bg-green-500/20 text-green-400 hover:text-white transition-colors"
                                onClick={() => handleEditTicket(ticket)}
                                title="Edit ticket"
                              >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                            <button 
                              className="p-1 rounded-lg hover:bg-orange-500/20 text-orange-400 hover:text-white transition-colors"
                              onClick={() => handleCommentTicket(ticket)}
                              title="Add comment"
                            >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                            {/* Delete button - admins can delete any ticket, users can only delete their own */}
                            {(isAdmin || (!isAdmin && user?.id === ticket.createdBy?.id)) && (
                              <button
                                className="p-1 rounded-lg hover:bg-red-500/20 text-red-400 hover:text-white transition-colors"
                                onClick={() => handleDeleteTicket(ticket.id)}
                                title="Delete ticket"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="px-6 py-10 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <AlertTriangle className="w-10 h-10 text-slate-500 mb-3" />
                      <p className="text-slate-400">No tickets found matching your criteria</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}
      
      {/* Ticket Detail/Edit/Comment Modal */}
      {showTicketModal && selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 animate-fade-in p-2 sm:p-4">
          <div className="glass-morphism bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-xs sm:max-w-md md:max-w-3xl max-h-[90vh] overflow-auto relative p-2 sm:p-4 md:p-8 animate-fade-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
                {modalMode === 'view' && 'Ticket Details'}
                {modalMode === 'edit' && 'Edit Ticket'}
                {modalMode === 'comment' && 'Ticket Comments'}
              </h3>
              <button 
                onClick={handleCloseTicketModal}
                className="p-1 rounded-lg glass-morphism-hover text-slate-400 hover:text-red-400 transition-colors hover:scale-110"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* View Mode */}
            {modalMode === 'view' && (
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <h2 className="text-lg font-medium text-white">{selectedTicket.title}</h2>
                  <div className="flex items-center gap-3">
                    {getPriorityBadge(selectedTicket.priority)}
                    {getStatusBadge(selectedTicket.status)}
                  </div>
                </div>
                
                <div className="glass-morphism p-4 rounded-lg">
                  <p className="text-slate-300 whitespace-pre-wrap">{selectedTicket.description}</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-400">Category</p>
                    <p className="text-white">{selectedTicket.category}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Created</p>
                    <p className="text-white">{new Date(selectedTicket.createdAt).toLocaleString()}</p>
                  </div>
                  {selectedTicket.createdBy && (
                    <div>
                      <p className="text-sm text-slate-400">Created By</p>
                      <p className="text-white">
                        {selectedTicket.createdBy.fullname}
                        {selectedTicket.createdBy.department && (
                          <span className="text-sm text-slate-400 ml-2">({selectedTicket.createdBy.department})</span>
                        )}
                      </p>
                    </div>
                  )}
                  {selectedTicket.dueDate && (
                    <div>
                      <p className="text-sm text-slate-400">Due Date</p>
                      <p className="text-white">{new Date(selectedTicket.dueDate).toLocaleDateString()}</p>
                    </div>
                  )}
                  {selectedTicket.assignedTo && (
                    <div>
                      <p className="text-sm text-slate-400">Assigned To</p>
                      <p className="text-white">
                        {selectedTicket.assignedTo.fullname}
                        {selectedTicket.assignedTo.department && (
                          <span className="text-sm text-slate-400 ml-2">({selectedTicket.assignedTo.department})</span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
                
                {selectedTicket.resolution && (
                  <div>
                    <p className="text-sm text-slate-400 mb-1">Resolution</p>
                    <div className="glass-morphism p-4 rounded-lg">
                      <p className="text-slate-300">{selectedTicket.resolution}</p>
                    </div>
                  </div>
                )}
                
                <div className="pt-4">
                  <h4 className="text-md font-medium text-white mb-3">Comments</h4>
                  {commentLoading ? (
                    <div className="text-center py-4 text-slate-400">Loading comments...</div>
                  ) : ticketComments.length > 0 ? (
                    <div className="space-y-4">
                      {ticketComments.map(comment => (
                        <div key={comment.id} className="glass-morphism p-4 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center">
                              <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 flex items-center justify-center text-xs text-white font-medium mr-2">
                                {getInitials(comment.createdBy?.fullname)}
                              </div>
                              <div>
                                <span className="text-sm font-medium text-white">{comment.createdBy?.fullname}</span>
                                {comment.createdBy?.department && (
                                  <span className="text-xs text-slate-400 ml-2">({comment.createdBy?.department})</span>
                                )}
                              </div>
                            </div>
                            <span className="text-xs text-slate-400">{new Date(comment.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-slate-300">{comment.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-center py-4">No comments yet</p>
                  )}
                  
                  <form onSubmit={handleSubmitComment} className="mt-4">
                    <div className="flex flex-col gap-3">
                      <textarea
                        placeholder="Add your comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="input-field w-full h-24"
                        required
                        disabled={submittingComment}
                      ></textarea>
                      <div className="flex justify-end space-x-3">
                        <button 
                          type="button" 
                          className="btn-secondary"
                          onClick={handleCloseTicketModal}
                          disabled={submittingComment}
                        >
                          Cancel
                        </button>
                        <button type="submit" className="btn-primary" disabled={submittingComment}>
                          {submittingComment ? 'Submitting...' : 'Submit Comment'}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            )}
            
            {/* Edit Mode */}
            {modalMode === 'edit' && (
              <form onSubmit={handleSaveTicket} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Title</label>
                  <input 
                    type="text" 
                    name="title"
                    value={editedTicket.title}
                    onChange={handleEditInputChange}
                    className="input-field w-full" 
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                  <textarea 
                    name="description"
                    value={editedTicket.description}
                    onChange={handleEditInputChange}
                    className="input-field w-full h-24" 
                    required
                  ></textarea>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Category</label>
                    <select 
                      name="category"
                      value={editedTicket.category}
                      onChange={handleEditInputChange}
                      className="input-field w-full"
                    >
                      <option value="Hardware">Hardware</option>
                      <option value="Software">Software</option>
                      <option value="Network">Network</option>
                      <option value="Access">Access</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Priority</label>
                    <select 
                      name="priority"
                      value={editedTicket.priority}
                      onChange={handleEditInputChange}
                      className="input-field w-full"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  {isAdmin && (
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Status</label>
                      <select 
                        name="status"
                        value={editedTicket.status}
                        onChange={handleEditInputChange}
                        className="input-field w-full"
                      >
                        <option value="open">Open</option>
                        <option value="in-progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Due Date (Optional)</label>
                  <input 
                    type="date" 
                    name="dueDate"
                    value={editedTicket.dueDate || ''}
                    onChange={handleEditInputChange}
                    className="input-field w-full" 
                  />
                </div>
                {editedTicket.status === 'resolved' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Resolution</label>
                    <textarea 
                      name="resolution"
                      value={editedTicket.resolution || ''}
                      onChange={handleEditInputChange}
                      className="input-field w-full h-24" 
                      placeholder="Describe how the issue was resolved"
                    ></textarea>
                  </div>
                )}
                <div className="flex justify-end space-x-3 pt-2">
                  <button 
                    type="button" 
                    className="btn-secondary"
                    onClick={handleCloseTicketModal}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">Save Changes</button>
                </div>
              </form>
            )}
            
            {/* Comment Mode */}
            {modalMode === 'comment' && (
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <h2 className="text-lg font-medium text-white">{selectedTicket.title}</h2>
                  <div className="flex items-center gap-3">
                    {getPriorityBadge(selectedTicket.priority)}
                    {getStatusBadge(selectedTicket.status)}
                  </div>
                </div>
                
                <div className="glass-morphism p-4 rounded-lg">
                  <p className="text-slate-300 whitespace-pre-wrap">{selectedTicket.description}</p>
                </div>
                
                <div className="pt-4">
                  <h4 className="text-md font-medium text-white mb-3">Comments</h4>
                  {commentLoading ? (
                    <div className="text-center py-4 text-slate-400">Loading comments...</div>
                  ) : ticketComments.length > 0 ? (
                    <div className="space-y-4">
                      {ticketComments.map(comment => (
                        <div key={comment.id} className="glass-morphism p-4 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center">
                              <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 flex items-center justify-center text-xs text-white font-medium mr-2">
                                {getInitials(comment.createdBy?.fullname)}
                              </div>
                              <span className="text-sm font-medium text-white">{comment.createdBy?.fullname}</span>
                            </div>
                            <span className="text-xs text-slate-400">{new Date(comment.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-slate-300">{comment.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-center py-4">No comments yet</p>
                  )}
                  
                  <form onSubmit={handleSubmitComment} className="mt-4">
                    <div className="flex flex-col gap-3">
                      <textarea
                        placeholder="Add your comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="input-field w-full h-24"
                        required
                        disabled={submittingComment}
                      ></textarea>
                      <div className="flex justify-end space-x-3">
                        <button 
                          type="button" 
                          className="btn-secondary"
                          onClick={handleCloseTicketModal}
                          disabled={submittingComment}
                        >
                          Cancel
                        </button>
                        <button type="submit" className="btn-primary" disabled={submittingComment}>
                          {submittingComment ? 'Submitting...' : 'Submit Comment'}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="glass-morphism rounded-xl w-full max-w-md p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Delete Ticket?</h3>
            <p className="text-slate-300 mb-6">Are you sure you want to delete this ticket? This action cannot be undone.</p>
            <div className="flex justify-center space-x-4">
              <button
                className="btn-secondary"
                onClick={cancelDeleteTicket}
              >
                Cancel
              </button>
              <button
                className="btn-primary bg-red-500 hover:bg-red-600 border-none"
                onClick={confirmDeleteTicket}
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

export default TicketsPage;