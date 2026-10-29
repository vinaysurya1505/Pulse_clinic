'use client';

import React from 'react';

interface ShortcutItem {
  keys: string;
  action: string;
}

interface ShortcutGroup {
  title: string;
  paths?: string[];
  items: ShortcutItem[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Global Navigation',
    items: [
      { keys: 'F2 / Alt+B', action: 'New Bill' },
      { keys: 'Alt+D', action: 'Dashboard' },
      { keys: 'Alt+M', action: 'Medicines' },
      { keys: 'Alt+I', action: 'Batch Inventory' },
      { keys: 'Alt+H', action: 'Bill History' },
      { keys: 'Alt+V', action: 'Owner Vault' },
      { keys: '?', action: 'Toggle this shortcuts panel' },
    ],
  },
  {
    title: 'Billing Page',
    paths: ['/billing/new'],
    items: [
      { keys: 'F3 / Ctrl+S', action: 'Focus Medicine Search' },
      { keys: '↑ / ↓', action: 'Navigate search results' },
      { keys: 'Enter', action: 'Add selected medicine to cart' },
      { keys: 'Enter (in qty)', action: 'Confirm qty & back to search' },
      { keys: 'Alt+N', action: 'Focus Customer Name' },
      { keys: 'Alt+P', action: 'Focus Customer Phone' },
      { keys: 'Alt+Q', action: 'Focus last item Quantity' },
      { keys: 'F4', action: 'Open Payment' },
      { keys: 'Ctrl+Enter / F10', action: 'Finalize Bill' },
      { keys: 'Escape', action: 'Close dropdowns / modals' },
    ],
  },
  {
    title: 'Medicines Page',
    paths: ['/inventory/medicines'],
    items: [
      { keys: 'Ctrl+A', action: 'Add new medicine row' },
      { keys: 'Enter', action: 'Save row & move to next' },
      { keys: 'Ctrl+S', action: 'Save changes' },
      { keys: 'Escape', action: 'Cancel editing' },
    ],
  },
  {
    title: 'Owner Vault — Cost Editor',
    paths: ['/vault'],
    items: [
      { keys: 'Click cost', action: 'Edit cost price inline' },
      { keys: 'Enter', action: 'Save & move to next row' },
      { keys: 'Tab', action: 'Move to next cost field' },
      { keys: 'Escape', action: 'Cancel editing' },
    ],
  },
];

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPath: string;
}

export function KeyboardShortcutsModal({ isOpen, onClose, currentPath }: KeyboardShortcutsModalProps) {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1200,
        padding: '16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '580px',
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          background: '#ffffff',
          borderRadius: '16px 16px 0 0',
          zIndex: 1,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>Keyboard Shortcuts</h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>Navigate faster without the mouse</p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Kbd>Esc</Kbd> Close
          </button>
        </div>

        {/* Shortcut Groups */}
        <div style={{ padding: '8px 24px 24px 24px' }}>
          {SHORTCUT_GROUPS.map((group, gi) => {
            const isCurrentPage = !group.paths || group.paths.some(p => currentPath.startsWith(p));
            return (
              <div key={gi} style={{ marginTop: gi === 0 ? '8px' : '20px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '10px',
                }}>
                  <h3 style={{
                    margin: 0,
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#0f172a',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    {group.title}
                  </h3>
                  {group.paths && isCurrentPage && (
                    <span style={{
                      background: '#dbeafe',
                      color: '#1e40af',
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}>
                      ACTIVE
                    </span>
                  )}
                </div>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  background: '#f8fafc',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                  opacity: group.paths && !isCurrentPage ? 0.5 : 1,
                }}>
                  {group.items.map((item, ii) => (
                    <div
                      key={ii}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 14px',
                        borderBottom: ii < group.items.length - 1 ? '1px solid #e2e8f0' : 'none',
                        background: '#ffffff',
                      }}
                    >
                      <span style={{ fontSize: '13px', color: '#475569' }}>{item.action}</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {item.keys.split(' / ').map((combo, ci) => (
                          <span key={ci} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                            {ci > 0 && <span style={{ color: '#94a3b8', fontSize: '11px', margin: '0 2px' }}>or</span>}
                            {combo.split('+').map((k, ki) => (
                              <span key={ki} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                {ki > 0 && <span style={{ color: '#94a3b8', fontSize: '10px' }}>+</span>}
                                <Kbd>{k.trim()}</Kbd>
                              </span>
                            ))}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd style={{
      display: 'inline-block',
      padding: '2px 7px',
      background: '#f1f5f9',
      border: '1px solid #cbd5e1',
      borderRadius: '5px',
      fontSize: '11px',
      fontWeight: 700,
      fontFamily: 'inherit',
      color: '#334155',
      boxShadow: '0 1px 0 #cbd5e1',
      lineHeight: '16px',
      minWidth: '20px',
      textAlign: 'center',
    }}>
      {children}
    </kbd>
  );
}
