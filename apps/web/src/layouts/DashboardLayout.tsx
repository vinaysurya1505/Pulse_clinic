'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import { useStore } from '@/context/StoreContext';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { InaugurationGreetingModal } from '@/components/InaugurationGreetingModal';
import { KeyboardShortcutsModal } from '@/components/KeyboardShortcutsModal';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { activeStore } = useStore();
  const [showGreeting, setShowGreeting] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/auth/signin');
    }
  }, [user, authLoading, router]);

  // Listen to custom event to open greeting from TopBar button
  useEffect(() => {
    const handleOpen = () => setShowGreeting(true);
    window.addEventListener('open-inauguration-greeting', handleOpen);
    return () => window.removeEventListener('open-inauguration-greeting', handleOpen);
  }, []);

  const handleCloseGreeting = () => {
    setShowGreeting(false);
  };

  const handleGlobalShortcuts = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName;
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    if (e.key === '?' && !isInput && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      setShowShortcuts(prev => !prev);
      return;
    }

    if (e.key === 'Escape' && showShortcuts) {
      setShowShortcuts(false);
      return;
    }

    if (e.key === 'F2' && router.pathname !== '/billing/new') {
      e.preventDefault();
      router.push('/billing/new');
      return;
    }

    if (!e.altKey) return;

    const key = e.key.toLowerCase();
    const altRoutes: Record<string, string> = {
      b: '/billing/new',
      m: '/inventory/medicines',
      i: '/inventory/batches',
      h: '/billing/history',
      d: '/dashboard',
      v: '/vault',
    };

    if (altRoutes[key]) {
      e.preventDefault();
      router.push(altRoutes[key]);
    }
  }, [router, showShortcuts]);

  useEffect(() => {
    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [handleGlobalShortcuts]);

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
        Loading New Sanjivani Clinic Console...
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
      <div style={{ flex: 1, marginLeft: 'var(--sidebar-width)', minWidth: 0 }}>
        <TopBar />
        <main
          id="main-content"
          tabIndex={-1}
          style={{
            marginTop: 'var(--topbar-height)',
            padding: 'var(--space-lg)',
            minHeight: `calc(100vh - var(--topbar-height))`,
            outline: 'none',
            overflowX: 'hidden',
          }}
        >
          {children}
        </main>
      </div>

      <InaugurationGreetingModal
        isOpen={showGreeting}
        onClose={handleCloseGreeting}
      />

      <KeyboardShortcutsModal
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
        currentPath={router.pathname}
      />

      {/* Floating shortcut hint */}
      <div
        onClick={() => setShowShortcuts(true)}
        style={{
          position: 'fixed',
          bottom: '16px',
          right: '16px',
          background: '#0f172a',
          color: '#94a3b8',
          padding: '6px 12px',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: 500,
          cursor: 'pointer',
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}
      >
        <span style={{ background: '#334155', padding: '1px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, color: '#e2e8f0' }}>?</span>
        <span>Shortcuts</span>
      </div>
    </div>
  );
}
