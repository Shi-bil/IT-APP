import React, { useState, useEffect, useRef } from 'react';
import { Ticket, Plus, Search, Filter, MoreHorizontal, Edit, Eye, MessageSquare, Clock, User, AlertTriangle, X, Check, ChevronDown, Trash2, ArrowDownUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ticketService from '../services/ticketService';

const TicketsPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [searchQuery, setSearchQuery] = useState('');
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

  // Add state for status dropdown
  const [statusDropdownOpen, setStatusDropdownOpen] = useState({});
  const dropdownRef = useRef({});

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

  // Fetch tickets based on user role
  const fetchTickets = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let result;
      if (isAdmin) {
        result = await ticketService.getAllTickets();
      } else {
        result = await ticketService.getUserTickets();
      }
      
      if (result.success) {
        console.log("Tickets data in component:", result.tickets);
        if (result.tickets.length > 0) {
          console.log("First ticket createdBy:", result.tickets[0].createdBy);
        }
        setTickets(result.tickets);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to fetch tickets');
      console.error('Fetch tickets error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch ticket statistics
  const fetchStats = async () => {
    try {
      const result = await ticketService.getTicketStats();
      if (result.success) {
        setStats(result.stats);
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
        setTicketComments(result.comments);
      }
    } catch (err) {
      console.error('Fetch comments error:', err);
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
          setTicketComments(result.comments);
        }
      })
      .catch(err => {
        console.error('Fetch comments error:', err);
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
          setTicketComments(commentsResult.comments);
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
        // Close dropdown
        setStatusDropdownOpen(prev => ({
          ...prev,
          [ticketId]: false
        }));
        
        // Refresh tickets and stats
        fetchTickets();
        fetchStats();
      } else {
        alert('Failed to update ticket status: ' + result.error);
      }
    } catch (err) {
      alert('Failed to update ticket status');
      console.error('Update ticket status error:', err);
    }
  };
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      Object.keys(statusDropdownOpen).forEach(ticketId => {
        if (statusDropdownOpen[ticketId] && 
            dropdownRef.current[ticketId] && 
            !dropdownRef.current[ticketId].contains(event.target)) {
          setStatusDropdownOpen(prev => ({
            ...prev,
            [ticketId]: false
          }));
        }
      });
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [statusDropdownOpen]);
  
  // Toggle status dropdown
  const toggleStatusDropdown = (ticketId) => {
    setStatusDropdownOpen(prev => ({
      ...prev,
      [ticketId]: !prev[ticketId]
    }));
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

  // Filter tickets based on search and filters
  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         ticket.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         ticket.category.toLowerCase().includes(searchQuery.toLowerCase());
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 animate-fade-in">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-1 sm:mb-2">Support Tickets</h1>
          <p className="text-slate-400 text-sm sm:text-base">
            {isAdmin 
              ? 'Track and manage all IT support requests' 
              : 'Track and submit your support tickets'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {isAdmin && (
            <div className="relative z-[10000]" ref={sortDropdownRef}>
              <button 
                className="btn-secondary flex items-center gap-2 backdrop-blur-sm hover:scale-105 transition-all"
                onClick={() => setShowSortDropdown((v) => !v)}
              >
                <ArrowDownUp className="w-4 h-4" />
                Sort
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
            className="btn-primary bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 hover:scale-105 transition-all duration-300 flex items-center gap-2"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus className="w-4 h-4" />
            New Ticket
          </button>
        </div>
      </div>

      {/* Statistics Cards - Only visible to admins */}
      {isAdmin && (
        <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 animate-fade-up">
          <div className="glass-morphism p-6 rounded-xl border border-slate-700/30 shadow-glow hover:shadow-glow-intense transition-all duration-300 hover:scale-[1.02]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-400">Open Tickets</h3>
              <Ticket className="w-5 h-5 text-orange-400" />
            </div>
            <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-600">{stats.openCount}</p>
            <p className="text-sm text-orange-400 mt-1">Needs attention</p>
          </div>
          <div className="glass-morphism p-6 rounded-xl border border-slate-700/30 shadow-glow hover:shadow-glow-intense transition-all duration-300 hover:scale-[1.02]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-400">In Progress</h3>
              <Clock className="w-5 h-5 text-yellow-400" />
            </div>
            <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-600">{stats.inProgressCount}</p>
            <p className="text-sm text-slate-400 mt-1">Being worked on</p>
          </div>
          <div className="glass-morphism p-6 rounded-xl border border-slate-700/30 shadow-glow hover:shadow-glow-intense transition-all duration-300 hover:scale-[1.02]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-400">Resolved Today</h3>
              <div className="w-2 h-2 bg-green-400 rounded-full shadow-glow-green"></div>
            </div>
            <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600">{stats.resolvedToday}</p>
            <p className="text-sm text-green-400 mt-1">Recently completed</p>
          </div>
          <div className="glass-morphism p-6 rounded-xl border border-slate-700/30 shadow-glow hover:shadow-glow-intense transition-all duration-300 hover:scale-[1.02]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-400">Avg Resolution</h3>
              <Clock className="w-5 h-5 text-cyan-400" />
            </div>
            <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">{stats.avgResolutionTime}h</p>
            <p className="text-sm text-green-400 mt-1">Average time to resolve</p>
          </div>
        </div>
      )}

      {/* Employee ticket stats */}
      {!isAdmin && (
        <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6 animate-fade-up">
          <div className="glass-morphism p-6 rounded-xl border border-slate-700/30 shadow-glow hover:shadow-glow-intense transition-all duration-300 hover:scale-[1.02]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-400">Your Open Tickets</h3>
              <Ticket className="w-5 h-5 text-orange-400" />
            </div>
            <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-600">{stats.openCount}</p>
          </div>
          <div className="glass-morphism p-6 rounded-xl border border-slate-700/30 shadow-glow hover:shadow-glow-intense transition-all duration-300 hover:scale-[1.02]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-400">In Progress</h3>
              <Clock className="w-5 h-5 text-yellow-400" />
            </div>
            <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-600">{stats.inProgressCount}</p>
          </div>
          <div className="glass-morphism p-6 rounded-xl border border-slate-700/30 shadow-glow hover:shadow-glow-intense transition-all duration-300 hover:scale-[1.02]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-400">Resolved</h3>
              <div className="w-2 h-2 bg-green-400 rounded-full shadow-glow-green"></div>
            </div>
            <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600">{stats.resolvedCount}</p>
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
                          <div className="text-sm font-medium text-white">{ticket.title}</div>
                          <div className="text-sm text-slate-400">{ticket.category}</div>
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
                            {/* Status Change Dropdown - only for admins */}
                            {isAdmin && (
                              <div className="relative" ref={el => dropdownRef.current[ticket.id] = el}>
                                <button 
                                  className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors flex items-center"
                                  onClick={() => toggleStatusDropdown(ticket.id)}
                                  title="Change status"
                                >
                                  <div className="w-2 h-2 rounded-full mr-1" 
                                    style={{
                                      backgroundColor: 
                                        ticket.status === 'open' ? '#3b82f6' : 
                                        ticket.status === 'in-progress' ? '#eab308' : 
                                        ticket.status === 'resolved' ? '#22c55e' : 
                                        '#94a3b8'
                                    }}
                                  />
                                  <ChevronDown className="w-3 h-3" />
                                </button>
                                {statusDropdownOpen[ticket.id] && (
                                  <div className="absolute right-0 mt-1 w-40 glass-morphism rounded-lg shadow-lg overflow-hidden z-10">
                                    <div className="py-1">
                                      <button
                                        className={`flex items-center w-full px-4 py-2 text-sm ${ticket.status === 'open' ? 'text-blue-400' : 'text-slate-300'} hover:bg-white/10`}
                                        onClick={() => handleStatusChange(ticket.id, 'open')}
                                      >
                                        <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                                        Open
                                        {ticket.status === 'open' && <Check className="w-4 h-4 ml-auto" />}
                                      </button>
                                      <button
                                        className={`flex items-center w-full px-4 py-2 text-sm ${ticket.status === 'in-progress' ? 'text-yellow-400' : 'text-slate-300'} hover:bg-white/10`}
                                        onClick={() => handleStatusChange(ticket.id, 'in-progress')}
                                      >
                                        <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></div>
                                        In Progress
                                        {ticket.status === 'in-progress' && <Check className="w-4 h-4 ml-auto" />}
                                      </button>
                                      <button
                                        className={`flex items-center w-full px-4 py-2 text-sm ${ticket.status === 'resolved' ? 'text-green-400' : 'text-slate-300'} hover:bg-white/10`}
                                        onClick={() => handleStatusChange(ticket.id, 'resolved')}
                                      >
                                        <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                                        Resolved
                                        {ticket.status === 'resolved' && <Check className="w-4 h-4 ml-auto" />}
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
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
            <AlertTriangle className="w-18 h-18 text-red-400 mx-auto mb-4" />
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