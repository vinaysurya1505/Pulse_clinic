'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import { useStore } from '@/context/StoreContext';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { activeStore } = useStore();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/auth/signin');
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#f8fafc',
        color: '#64748b',
        fontSize: '15px',
        fontWeight: 600,
      }}>
        Loading PulseClinic Pharmacy Console...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!activeStore) {
    return null;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: 'var(--sidebar-width)' }}>
        <TopBar />
        <main
          id="main-content"
          tabIndex={-1}
          style={{
            marginTop: 'var(--topbar-height)',
            padding: 'var(--space-lg)',
            minHeight: `calc(100vh - var(--topbar-height))`,
            outline: 'none',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
