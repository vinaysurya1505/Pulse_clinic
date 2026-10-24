'use client';

import React from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const colorMap: Record<BadgeVariant, { bg: string; color: string }> = {
  default: { bg: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' },
  success: { bg: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)' },
  warning: { bg: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-warning)' },
  danger: { bg: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)' },
  info: { bg: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-info)' },
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
}

export function Badge({ variant = 'default', children }: BadgeProps) {
  const colors = colorMap[variant];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 10px',
        fontSize: '12px',
        fontWeight: 600,
        borderRadius: 'var(--radius-full)',
        background: colors.bg,
        color: colors.color,
      }}
    >
      {children}
    </span>
  );
}
