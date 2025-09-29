import Parse from '../config/parseConfig';

// Ticket management service using Parse
export const ticketService = {
  // Create a new ticket
  createTicket: async (ticketData) => {
    try {
      const Ticket = Parse.Object.extend('Ticket');
      const ticket = new Ticket();
      
      // Set basic ticket properties
      ticket.set('title', ticketData.title);
      ticket.set('description', ticketData.description);
      ticket.set('category', ticketData.category);
      ticket.set('priority', ticketData.priority);
      ticket.set('status', 'open'); // Default status is open
      
      // Set tags if provided
      if (ticketData.tags && Array.isArray(ticketData.tags)) {
        ticket.set('tags', ticketData.tags);
      }
      
      // Set due date if provided
      if (ticketData.dueDate) {
        ticket.set('dueDate', new Date(ticketData.dueDate));
      }
      
      // Set created by current user
      const currentUser = Parse.User.current();
      if (currentUser) {
        ticket.set('createdBy', currentUser);
      }
      
      // Save the ticket
      const savedTicket = await ticket.save();
      
      return {
        success: true,
        ticket: {
          id: savedTicket.id,
          title: savedTicket.get('title'),
          description: savedTicket.get('description'),
          category: savedTicket.get('category'),
          priority: savedTicket.get('priority'),
          status: savedTicket.get('status'),
          tags: savedTicket.get('tags') || [],
          dueDate: savedTicket.get('dueDate'),
          createdAt: savedTicket.createdAt,
          updatedAt: savedTicket.updatedAt
        }
      };
    } catch (error) {
      console.error('Create ticket error:', error);
      return { success: false, error: error.message };
    }
  },

  // Get all tickets
  getAllTickets: async () => {
    try {
      // Use the cloud function to get tickets with user info
      const results = await Parse.Cloud.run('getTicketsWithUserInfo');
      console.log("Tickets with user info from cloud function:", results);
      
      return {
        success: true,
        tickets: results
      };
    } catch (error) {
      console.error('Get tickets error:', error);
      return { success: false, error: error.message };
    }
  },

  // Get tickets for current user
  getUserTickets: async () => {
    try {
      const currentUser = Parse.User.current();
      if (!currentUser) {
        return { success: false, error: 'User not authenticated' };
      }

      // Use the cloud function to get user tickets with user info
      const tickets = await Parse.Cloud.run('getUserTicketsWithUserInfo');
      console.log("User tickets with info from cloud function:", tickets);
      
      return {
        success: true,
        tickets
      };
    } catch (error) {
      console.error('Get user tickets error:', error);
      return { success: false, error: error.message };
    }
  },

  // Get ticket by ID
  getTicketById: async (ticketId) => {
    try {
      // Use the cloud function to get ticket details with user info
      const ticket = await Parse.Cloud.run('getTicketByIdWithUserInfo', { ticketId });
      console.log("Ticket with user info from cloud function:", ticket);
      
      return {
        success: true,
        ticket
      };
    } catch (error) {
      console.error('Get ticket error:', error);
      return { success: false, error: error.message };
    }
  },

  // Update ticket
  updateTicket: async (ticketId, ticketData) => {
    try {
      const Ticket = Parse.Object.extend('Ticket');
      const query = new Parse.Query(Ticket);
      const ticket = await query.get(ticketId);
      
      // Update ticket properties
      if (ticketData.title !== undefined) {
        ticket.set('title', ticketData.title);
      }
      
      if (ticketData.description !== undefined) {
        ticket.set('description', ticketData.description);
      }
      
      if (ticketData.category !== undefined) {
        ticket.set('category', ticketData.category);
      }
      
      if (ticketData.priority !== undefined) {
        ticket.set('priority', ticketData.priority);
      }
      
      if (ticketData.status !== undefined) {
        ticket.set('status', ticketData.status);
      }
      
      if (ticketData.tags !== undefined) {
        ticket.set('tags', ticketData.tags);
      }
      
      if (ticketData.dueDate !== undefined) {
        ticket.set('dueDate', ticketData.dueDate ? new Date(ticketData.dueDate) : null);
      }
      
      if (ticketData.resolution !== undefined) {
        ticket.set('resolution', ticketData.resolution);
      }
      
      // Save the updated ticket
      const savedTicket = await ticket.save();
      
      return {
        success: true,
        ticket: {
          id: savedTicket.id,
          title: savedTicket.get('title'),
          description: savedTicket.get('description'),
          category: savedTicket.get('category'),
          priority: savedTicket.get('priority'),
          status: savedTicket.get('status'),
          tags: savedTicket.get('tags') || [],
          dueDate: savedTicket.get('dueDate'),
          resolution: savedTicket.get('resolution'),
          createdAt: savedTicket.createdAt,
          updatedAt: savedTicket.updatedAt
        }
      };
    } catch (error) {
      console.error('Update ticket error:', error);
      return { success: false, error: error.message };
    }
  },

  // Assign ticket to a user
  assignTicket: async (ticketId, userId) => {
    try {
      const Ticket = Parse.Object.extend('Ticket');
      const query = new Parse.Query(Ticket);
      const ticket = await query.get(ticketId);
      
      // Create a pointer to the User object
      const userPointer = Parse.User.createWithoutData(userId);
      
      // Update ticket properties
      ticket.set('assignedTo', userPointer);
      ticket.set('status', 'in-progress');
      
      await ticket.save();
      
      return { success: true };
    } catch (error) {
      console.error('Assign ticket error:', error);
      return { success: false, error: error.message };
    }
  },

  // Add comment to ticket
  addComment: async (ticketId, commentText) => {
    try {
      const TicketComment = Parse.Object.extend('TicketComment');
      const comment = new TicketComment();
  
      // Correct pointer creation
      const Ticket = Parse.Object.extend('Ticket');
      const ticketPointer = new Ticket();
      ticketPointer.id = ticketId;
      comment.set('ticket', ticketPointer);
  
      comment.set('text', commentText);
  
      const currentUser = Parse.User.current();
      if (currentUser) {
        comment.set('createdBy', currentUser);
      }
  
      await comment.save();
      return { success: true };
    } catch (error) {
      console.error('Add comment error:', error);
      return { success: false, error: error.message };
    }
  },

  // Get comments for a ticket
  getTicketComments: async (ticketId) => {
    try {
      // Use the cloud function to get comments with user info
      const comments = await Parse.Cloud.run('getTicketCommentsWithUserInfo', { ticketId });
      console.log("Comments with user info from cloud function:", comments);
      
      return {
        success: true,
        comments
      };
    } catch (error) {
      console.error('Get ticket comments error:', error);
      return { success: false, error: error.message };
    }
  },

  // Get ticket statistics for dashboard
  getTicketStats: async () => {
    try {
      const stats = await Parse.Cloud.run('getTicketStats');
      return {
        success: true,
        stats
      };
    } catch (error) {
      console.error('Get ticket stats error:', error);
      return { success: false, error: error.message };
    }
  },

  // Delete ticket
  deleteTicket: async (ticketId) => {
    try {
      const Ticket = Parse.Object.extend('Ticket');
      const query = new Parse.Query(Ticket);
      const ticket = await query.get(ticketId);
      await ticket.destroy();
      return { success: true };
    } catch (error) {
      console.error('Delete ticket error:', error);
      return { success: false, error: error.message };
    }
  }
};

export default ticketService; 