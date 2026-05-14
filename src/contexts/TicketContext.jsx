import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import ticketService from '../services/ticketService';
import { useAuth } from './AuthContext';

const TicketContext = createContext();

export const useTickets = () => {
  const context = useContext(TicketContext);
  if (!context) {
    throw new Error('useTickets must be used within a TicketProvider');
  }
  return context;
};

export const TicketProvider = ({ children }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [ticketCount, setTicketCount] = useState(0);

  // Fetch ticket count (open tickets for badge)
  const refreshTicketCount = useCallback(async () => {
    if (!isAdmin) return;
    
    try {
      const result = await ticketService.getTicketStats();
      if (result.success && result.stats) {
        setTicketCount(result.stats.openCount || 0);
      }
    } catch (err) {
      console.error('Failed to fetch ticket count:', err);
    }
  }, [isAdmin]);

  // Initial fetch and polling
  useEffect(() => {
    if (isAdmin) {
      refreshTicketCount();
      
      // Refresh count every 30 seconds as fallback
      const interval = setInterval(refreshTicketCount, 30000);
      return () => clearInterval(interval);
    }
  }, [isAdmin, refreshTicketCount]);

  const value = {
    ticketCount,
    refreshTicketCount
  };

  return (
    <TicketContext.Provider value={value}>
      {children}
    </TicketContext.Provider>
  );
};

export default TicketContext;

