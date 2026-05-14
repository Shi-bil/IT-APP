import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import vpsService from '../services/vpsService';
import subscriptionService from '../services/subscriptionService';
import objectStorageService from '../services/objectStorageService';
import { expandDueDates, findPaymentForMonth } from '../components/PaymentCalendar';
import { useAuth } from './AuthContext';

const PaymentsContext = createContext();

export const usePayments = () => {
  const ctx = useContext(PaymentsContext);
  if (!ctx) throw new Error('usePayments must be used within a PaymentsProvider');
  return ctx;
};

const countUnpaidThisMonth = (items) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  let unpaid = 0;
  for (const item of items) {
    const dueDates = expandDueDates(item, year);
    const dueThisMonth = dueDates.find((d) => d.getFullYear() === year && d.getMonth() === month);
    if (!dueThisMonth) continue;
    if (!findPaymentForMonth(item, dueThisMonth)) unpaid += 1;
  }
  return unpaid;
};

export const PaymentsProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [unpaidCount, setUnpaidCount] = useState(0);

  const refreshUnpaidCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      // Force fresh data so the polling interval actually refreshes the cache
      // for everyone — without { force: true } we'd just keep reading our own
      // last cached response.
      const [vpsRes, subRes, storageRes] = await Promise.all([
        vpsService.getAllVps({ force: true }),
        subscriptionService.getAllSubscriptions({ force: true }),
        objectStorageService.getAll({ force: true }),
      ]);
      const vpsList = vpsRes.success ? vpsRes.vps || [] : [];
      const subsList = subRes.success ? subRes.subscriptions || [] : [];
      const storageList = storageRes.success ? storageRes.items || [] : [];
      setUnpaidCount(countUnpaidThisMonth([...vpsList, ...subsList, ...storageList]));
    } catch (err) {
      console.error('Failed to fetch unpaid payment count:', err);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setUnpaidCount(0);
      return undefined;
    }
    refreshUnpaidCount();
    const interval = setInterval(refreshUnpaidCount, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, refreshUnpaidCount]);

  return (
    <PaymentsContext.Provider value={{ unpaidCount, refreshUnpaidCount }}>
      {children}
    </PaymentsContext.Provider>
  );
};

export default PaymentsContext;
