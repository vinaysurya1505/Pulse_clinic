'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiPost } from '@/lib/api';
import type { SystemRole, NamedPermission } from '@pulseclinic/types';

interface ActiveStore {
  storeId: string;
  storeName: string;
  role: SystemRole;
  permissions: NamedPermission[];
}

interface StoreContextValue {
  activeStore: ActiveStore;
  loading: boolean;
  error: string | null;
  selectStore: (storeId: string) => Promise<boolean>;
  clearStore: () => void;
  hasPermission: (permission: NamedPermission) => boolean;
}

const DEFAULT_PRIMARY_STORE: ActiveStore = {
  storeId: 'pulseclinic-main',
  storeName: 'New Sanjivani Multispeciality Clinic',
  role: 'OWNER',
  permissions: [
    'store.read',
    'store.update',
    'bill.create',
    'bill.read',
    'bill.cancel',
    'bill.refund',
    'inventory.read',
    'inventory.write',
    'inventory.adjust',
    'import.execute',
    'po.create',
    'po.receive',
    'doctor.read',
    'doctor.write',
    'employee.read',
    'employee.write',
    'expense.read',
    'expense.write',
    'report.financial',
    'report.gst',
    'audit.read',
    'supplier.read',
    'supplier.write',
  ],
};

const StoreContext = createContext<StoreContextValue | null>(null);

const STORAGE_KEY = 'pulseclinic_active_store';

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [activeStore, setActiveStore] = useState<ActiveStore>(DEFAULT_PRIMARY_STORE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore active store from localStorage on client mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.storeId) {
          setActiveStore(parsed);
        }
      }
    } catch {
      // Ignore localStorage read errors
    }
  }, []);

  const selectStore = useCallback(async (storeId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiPost<{
        success: boolean;
        activeStore: ActiveStore;
      }>('/auth/select-store', { storeId });

      setActiveStore(response.activeStore);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(response.activeStore));
      } catch {
        // Ignore localStorage write error
      }
      return true;
    } catch {
      // Keep DEFAULT_PRIMARY_STORE active even if API is offline
      setError('Failed to select store.');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearStore = useCallback(() => {
    setActiveStore(DEFAULT_PRIMARY_STORE);
    setError(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  const hasPermission = useCallback(
    (permission: NamedPermission) => {
      return activeStore.permissions.includes(permission);
    },
    [activeStore],
  );

  return (
    <StoreContext.Provider value={{ activeStore, loading, error, selectStore, clearStore, hasPermission }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
