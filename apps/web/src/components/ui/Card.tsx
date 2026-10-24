'use client';

import React from 'react';

interface CardProps {
  children: React.ReactNode;
  glass?: boolean;
  padding?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export function Card({ children, glass, padding = 'var(--space-lg)', style, onClick }: CardProps) {
  return (
    <div
      className={glass ? 'glass' : undefined}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      style={{
        background: glass ? undefined : 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        padding,
        border: glass ? undefined : '1px solid var(--color-border)',
        cursor: onClick ? 'pointer' : undefined,
        transition: 'var(--transition-fast)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
