'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/context/StoreContext';
import { apiGet, apiPut, apiPost } from '@/lib/api';
import { StoreNotification } from '@pulseclinic/types';

interface NotificationDrawerProps {
  onClose: () => void;
  onNotificationsUpdated?: () => void;
}

export function NotificationDrawer({ onClose, onNotificationsUpdated }: NotificationDrawerProps) {
  const { activeStore } = useStore();
  const [notifications, setNotifications] = useState<StoreNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = async () => {
    if (!activeStore) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<{ success: boolean; notifications: StoreNotification[]; unreadCount: number }>(
        '/notifications?limit=30',
        activeStore.storeId
      );
      if (res.success) {
        setNotifications(res.notifications || []);
        if (onNotificationsUpdated) onNotificationsUpdated();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [activeStore?.storeId]);

  const handleMarkAsRead = async (id: string) => {
    if (!activeStore) return;
    try {
      await apiPut(`/notifications/${id}/read`, {}, activeStore.storeId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      if (onNotificationsUpdated) onNotificationsUpdated();
    } catch (err: any) {
      console.error('Failed to mark read', err);
    }
  };

  const handleRunScan = async () => {
    if (!activeStore) return;
    setScanning(true);
    setError(null);
    try {
      await apiPost(
        `/jobs/cron/daily-check?storeId=${activeStore.storeId}`,
        {},
        activeStore.storeId
      );
      await fetchNotifications();
    } catch (err: any) {
      setError('Scan failed: ' + (err.message || 'Error executing scheduled check'));
    } finally {
      setScanning(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      {/* Backdrop */}
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.4)' }}
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '420px',
          height: '100vh',
          background: '#ffffff',
          borderLeft: '1px solid var(--color-border)',
          boxShadow: '-8px 0 24px rgba(0, 0, 0, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1201,
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Store Notifications & Alerts"
      >
        {/* Drawer Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--color-border)',
            background: '#f8fafc',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>
                Notifications & Alerts
              </h2>
              {unreadCount > 0 && (
                <span
                  style={{
                    background: '#ef4444',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '12px',
                  }}
                >
                  {unreadCount} new
                </span>
              )}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              Low stock, near-expiry, and scheduled warnings
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close notifications"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Action Bar */}
        <div
          style={{
            padding: '10px 20px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#ffffff',
          }}
        >
          <button
            onClick={handleRunScan}
            disabled={scanning}
            style={{
              padding: '6px 12px',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 'var(--radius-md)',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--color-primary)',
              cursor: scanning ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {scanning ? '⏳ Scanning Batches...' : '⚡ Run Stock & Expiry Check'}
          </button>

          <button
            onClick={fetchNotifications}
            style={{
              padding: '6px 10px',
              background: '#ffffff',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: '12px',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
            }}
          >
            🔄 Refresh
          </button>
        </div>

        {error && (
          <div style={{ margin: '12px 20px', padding: '10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '12px' }}>
            {error}
          </div>
        )}

        {/* Notifications List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)', fontSize: '13px' }}>
              Loading alerts...
            </div>
          ) : notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--color-text-muted)' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎉</div>
              <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '14px' }}>All caught up!</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>No pending low-stock or near-expiry alerts.</div>
            </div>
          ) : (
            notifications.map((item) => {
              const isLowStock = item.type === 'LOW_STOCK';
              const isNearExpiry = item.type === 'NEAR_EXPIRY';

              return (
                <div
                  key={item.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: item.isRead ? '1px solid var(--color-border)' : '1px solid #fca5a5',
                    background: item.isRead ? '#ffffff' : '#fff5f5',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: isLowStock ? '#fee2e2' : isNearExpiry ? '#fef3c7' : '#e0e7ff',
                          color: isLowStock ? '#b91c1c' : isNearExpiry ? '#b45309' : '#3730a3',
                        }}
                      >
                        {item.type}
                      </span>
                      {!item.isRead && (
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }} />
                      )}
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      {new Date(item.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text)', marginTop: '6px' }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px', lineHeight: 1.4 }}>
                    {item.message}
                  </div>

                  {!item.isRead && (
                    <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => handleMarkAsRead(item.id)}
                        style={{
                          padding: '4px 8px',
                          background: '#ffffff',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: 'var(--color-text-secondary)',
                          cursor: 'pointer',
                        }}
                      >
                        Mark as Read
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}
