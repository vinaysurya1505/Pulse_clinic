'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/context/StoreContext';

interface NavItem {
  label: string;
  href: string;
  icon: string;
  permission?: string;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: '📊' },
  { label: 'New Bill', href: '/billing/new', icon: '🧾' },
  { label: 'Bill History', href: '/billing/history', icon: '📋' },
  { label: 'Medicines', href: '/inventory/medicines', icon: '💊' },
  { label: 'Batches', href: '/inventory/batches', icon: '📦' },
  { label: 'CSV Import', href: '/imports/csv', icon: '📁' },
  { label: 'Purchases', href: '/purchases', icon: '🛒' },
  { label: 'Suppliers', href: '/suppliers', icon: '🏭' },
  { label: 'Doctors', href: '/doctors', icon: '🩺' },
  { label: 'Employees', href: '/employees', icon: '👥', permission: 'employee.read' },
  { label: 'Expenses', href: '/expenses', icon: '💰' },
  { label: 'Reports', href: '/reports/financial', icon: '📈' },
  { label: 'GST Reports', href: '/reports/gst', icon: '🧮' },
  { label: 'Audit Logs', href: '/admin/audit-logs', icon: '🔍', permission: 'audit.read' },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { activeStore } = useStore();

  return (
    <aside
      style={{
        width: collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
        height: '100vh',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width var(--transition-normal)',
        borderRight: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        overflow: 'hidden',
      }}
    >
      {/* Logo */}
      <div
        style={{
          height: 'var(--topbar-height)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 var(--space-md)',
          borderBottom: '1px solid var(--color-border)',
          gap: 'var(--space-sm)',
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 700,
            fontSize: '16px',
            flexShrink: 0,
          }}
        >
          P
        </div>
        {!collapsed && (
          <span style={{ fontWeight: 700, fontSize: '16px', color: 'var(--color-text)' }}>
            PulseClinic
          </span>
        )}
      </div>

      {/* Store indicator */}
      {activeStore && !collapsed && (
        <div
          style={{
            padding: 'var(--space-sm) var(--space-md)',
            fontSize: '12px',
            color: 'var(--color-text-muted)',
            borderBottom: '1px solid var(--color-border-light)',
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: '13px' }}>
            {activeStore.storeName}
          </div>
          <div>{activeStore.role}</div>
        </div>
      )}

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-sm)' }}>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-sm)',
              padding: collapsed ? '10px' : '10px 12px',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-secondary)',
              fontSize: '14px',
              textDecoration: 'none',
              transition: 'var(--transition-fast)',
              justifyContent: collapsed ? 'center' : undefined,
            }}
            title={collapsed ? item.label : undefined}
          >
            <span style={{ fontSize: '18px', flexShrink: 0 }}>{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </Link>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        style={{
          padding: 'var(--space-md)',
          background: 'none',
          border: 'none',
          borderTop: '1px solid var(--color-border)',
          color: 'var(--color-text-muted)',
          fontSize: '18px',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        {collapsed ? '→' : '←'}
      </button>
    </aside>
  );
}
