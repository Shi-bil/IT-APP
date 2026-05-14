import axios from 'axios';
import authService from './authService';
import { readCache, writeCache, invalidatePrefix } from './_cache';

// Ticket management service using HTTP API
export const ticketService = {
  peekAllTickets: () => readCache('tickets:all'),
  peekUserTickets: () => readCache('tickets:mine'),

  // Create a new ticket
  createTicket: async (ticketData) => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await axios.post('/api/tickets', ticketData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      invalidatePrefix('tickets:');
      return { success: true, ticket: res.data.ticket };
    } catch (error) {
      console.error('Create ticket error:', error);
      return { success: false, error: error.message };
    }
  },

  // Get all tickets
  getAllTickets: async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await axios.get('/api/tickets', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = { success: true, tickets: res.data.tickets || [] };
      writeCache('tickets:all', result);
      return result;
    } catch (error) {
      console.error('Get tickets error:', error);
      return { success: false, error: error.response?.data?.error || error.message, tickets: [] };
    }
  },

  // Get tickets for current user
  getUserTickets: async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await axios.get('/api/tickets', {
        params: { mine: 'true' },
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = { success: true, tickets: res.data.tickets || [] };
      writeCache('tickets:mine', result);
      return result;
    } catch (error) {
      console.error('Get user tickets error:', error);
      return { success: false, error: error.response?.data?.error || error.message, tickets: [] };
    }
  },

  // Get ticket by ID
  getTicketById: async (ticketId) => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await axios.get('/api/tickets/get', {
        params: { ticketId },
        headers: { Authorization: `Bearer ${token}` },
      });
      return { success: true, ticket: res.data.ticket };
    } catch (error) {
      console.error('Get ticket error:', error);
      return { success: false, error: error.message };
    }
  },

  // Update ticket
  updateTicket: async (ticketId, ticketData) => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await axios.put('/api/tickets/update', { ticketId, ...ticketData }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      invalidatePrefix('tickets:');
      return { success: true, ticket: res.data.ticket };
    } catch (error) {
      console.error('Update ticket error:', error);
      return { success: false, error: error.message };
    }
  },

  // Assign ticket to a user
  assignTicket: async (ticketId, userId) => {
    try {
      return await ticketService.updateTicket(ticketId, { assignedToUserId: userId, status: 'in-progress' });
    } catch (error) {
      console.error('Assign ticket error:', error);
      return { success: false, error: error.message };
    }
  },

  // Add comment to ticket
  addComment: async (ticketId, commentText) => {
    try {
      const token = localStorage.getItem('auth_token');
      await axios.post('/api/tickets/comments', { ticketId, text: commentText }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return { success: true };
    } catch (error) {
      console.error('Add comment error:', error);
      return { success: false, error: error.message };
    }
  },

  // Get comments for a ticket
  getTicketComments: async (ticketId) => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await axios.get('/api/tickets/comments', {
        params: { ticketId },
        headers: { Authorization: `Bearer ${token}` },
      });
      return { success: true, comments: res.data.comments || [] };
    } catch (error) {
      console.error('Get ticket comments error:', error);
      return { success: false, error: error.response?.data?.error || error.message, comments: [] };
    }
  },

  // Get ticket statistics for dashboard
  getTicketStats: async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await axios.get('/api/tickets/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return { success: true, stats: res.data.stats || { total: 0, open: 0, inProgress: 0, closed: 0 } };
    } catch (error) {
      console.error('Get ticket stats error:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || error.message,
        stats: { total: 0, open: 0, inProgress: 0, closed: 0 }
      };
    }
  },

  // Delete ticket
  deleteTicket: async (ticketId) => {
    try {
      const token = localStorage.getItem('auth_token');
      await axios.post('/api/tickets/delete', { ticketId }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      invalidatePrefix('tickets:');
      return { success: true };
    } catch (error) {
      console.error('Delete ticket error:', error);
      return { success: false, error: error.message };
    }
  }
};

export default ticketService; 