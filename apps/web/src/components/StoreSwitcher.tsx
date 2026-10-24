'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useStore } from '@/context/StoreContext';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';

interface StoreSwitcherProps {
  onClose: () => void;
}

export function StoreSwitcher({ onClose }: StoreSwitcherProps) {
  const { memberships } = useAuth();
  const { selectStore, activeStore } = useStore();

  const handleSelect = async (storeId: string) => {
    await selectStore(storeId);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Switch store"
    >
      <div
        style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-xl)',
          width: '100%',
          maxWidth: '480px',
          maxHeight: '80vh',
          overflow: 'auto',
          margin: 'var(--space-md)',
        }}
      >
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: 'var(--space-lg)' }}>
          Switch Store
        </h2>

        {memberships.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-xl)' }}>
            No active store memberships found. Contact your administrator or create a new store.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {memberships.map((m) => (
              <Card
                key={m.storeId}
                onClick={() => handleSelect(m.storeId)}
                padding="var(--space-md)"
                style={{
                  border: activeStore?.storeId === m.storeId
                    ? '2px solid var(--color-primary)'
                    : '1px solid var(--color-border)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '15px' }}>{m.storeName}</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      {m.storeId}
                    </div>
                  </div>
                  <Badge variant={activeStore?.storeId === m.storeId ? 'success' : 'default'}>
                    {m.role}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            marginTop: 'var(--space-lg)',
            width: '100%',
            padding: '10px',
            background: 'none',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            fontSize: '14px',
            color: 'var(--color-text-secondary)',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
