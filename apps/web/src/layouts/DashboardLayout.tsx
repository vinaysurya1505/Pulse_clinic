'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import { useStore } from '@/context/StoreContext';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { InaugurationGreetingModal } from '@/components/InaugurationGreetingModal';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { activeStore } = useStore();
  const [showGreeting, setShowGreeting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/auth/signin');
    }
  }, [user, authLoading, router]);

  // Show greeting pop up on login / session
  useEffect(() => {
    if (user && activeStore && typeof window !== 'undefined') {
      const dismissed = sessionStorage.getItem('inauguration_greeting_dismissed') === 'true';
      if (!dismissed) {
        setShowGreeting(true);
      }
    }
  }, [user, activeStore]);

  // Listen to custom event to re-open greeting from TopBar anytime
  useEffect(() => {
    const handleOpen = () => setShowGreeting(true);
    window.addEventListener('open-inauguration-greeting', handleOpen);
    return () => window.removeEventListener('open-inauguration-greeting', handleOpen);
  }, []);

  const handleCloseGreeting = () => {
    setShowGreeting(false);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('inauguration_greeting_dismissed', 'true');
    }
  };

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
    </div>
  );
}
