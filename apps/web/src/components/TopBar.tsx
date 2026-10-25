'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useStore } from '@/context/StoreContext';
import { apiGet } from '@/lib/api';
import { StoreSwitcher } from './StoreSwitcher';
import { NotificationDrawer } from './NotificationDrawer';

export function TopBar() {
  const { user, signOut } = useAuth();
  const { activeStore } = useStore();
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnread = async () => {
    if (!activeStore) return;
    try {
      const res = await apiGet<{ success: boolean; unreadCount: number }>('/notifications?limit=10', activeStore.storeId);
      if (res.success) {
        setUnreadCount(res.unreadCount || 0);
      }
    } catch {
      // Ignore background notification check errors
    }
  };

  useEffect(() => {
    fetchUnread();
  }, [activeStore?.storeId]);

  return (
    <>
      <header
        className="glass"
        style={{
          height: 'var(--topbar-height)',
          position: 'fixed',
          top: 0,
          right: 0,
          left: 'var(--sidebar-width)',
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 var(--space-lg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
          {activeStore && (
            <button
              onClick={() => setShowSwitcher(true)}
              style={{
                background: 'var(--color-primary-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {activeStore.storeName}
              <span style={{ fontSize: '10px' }}>▼</span>
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
          {/* Inauguration Wishes Button */}
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('open-inauguration-greeting'));
              }
            }}
            title="View Grand Inauguration Wishes & Brotherly Photo"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
              border: '1px solid #fcd34d',
              borderRadius: '20px',
              padding: '5px 12px',
              fontSize: '12px',
              fontWeight: 700,
              color: '#92400e',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 1px 3px rgba(180, 83, 9, 0.1)',
            }}
          >
            <span>🎉</span>
            <span>26th Oct Inauguration</span>
          </button>

          {/* Notifications */}
          <button
            onClick={() => setShowNotifications(true)}
            aria-label="Open notifications"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              position: 'relative',
              padding: '6px',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
            }}
          >
            🔔
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '2px',
                  right: '2px',
                  background: '#ef4444',
                  color: '#ffffff',
                  fontSize: '10px',
                  fontWeight: 700,
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* User Menu */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                background: 'none',
                border: 'none',
                padding: '4px',
                borderRadius: 'var(--radius-full)',
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 'var(--radius-full)',
                  background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              >
                {user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
              </div>
            </button>

            {showUserMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '8px',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--glass-shadow)',
                  padding: 'var(--space-sm)',
                  minWidth: '200px',
                  zIndex: 50,
                }}
              >
                <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border-light)' }}>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>{user?.displayName}</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{user?.email}</div>
                </div>
                <button
                  onClick={() => { setShowUserMenu(false); signOut(); }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    background: 'none',
                    border: 'none',
                    fontSize: '14px',
                    color: 'var(--color-danger)',
                    borderRadius: 'var(--radius-sm)',
                    marginTop: '4px',
                  }}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {showSwitcher && <StoreSwitcher onClose={() => setShowSwitcher(false)} />}
      {showNotifications && (
        <NotificationDrawer
          onClose={() => setShowNotifications(false)}
          onNotificationsUpdated={fetchUnread}
        />
      )}
    </>
  );
}
