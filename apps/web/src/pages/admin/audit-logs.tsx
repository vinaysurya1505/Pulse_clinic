'use client';

import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { useStore } from '@/context/StoreContext';
import { useAuth } from '@/context/AuthContext';
import { apiGet, ApiError } from '@/lib/api';
import { AuditLogEntry } from '@pulseclinic/types';

interface AuditLogsResponse {
  success: boolean;
  logs: AuditLogEntry[];
  totalCount: number;
}

const ACTION_FILTERS: { label: string; value: string }[] = [
  { label: 'All Actions', value: 'ALL' },
  { label: 'Refunds & Approvals', value: 'INVOICE_REFUNDED' },
  { label: 'Bill Finalized', value: 'BILL_FINALIZED' },
  { label: 'Stock Adjustments', value: 'STOCK_ADJUSTMENT' },
  { label: 'Expenses', value: 'EXPENSE_RECORDED' },
  { label: 'Daily Closings', value: 'DAILY_CLOSING_EXECUTED' },
  { label: 'Logins & Auth', value: 'AUTH_LOGIN' },
];

export default function AuditLogsPage() {
  const { activeStore } = useStore();
  const { user, loading: authLoading } = useAuth();

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // JSON Explorer Modal
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);

  const fetchLogs = async () => {
    if (!activeStore || authLoading || !user) return;
    setLoading(true);
    setError(null);

    try {
      let url = '/audit-logs?limit=50';
      if (selectedAction !== 'ALL') {
        url += `&action=${selectedAction}`;
      }

      const res = await apiGet<AuditLogsResponse>(url, activeStore.storeId);
      if (res.success) {
        setLogs(res.logs || []);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user && activeStore) {
      fetchLogs();
    }
  }, [activeStore?.storeId, selectedAction, authLoading, user]);

  return (
    <DashboardLayout>
      <Head>
        <title>Audit Logs & Security Explorer | New Sanjivani Clinic</title>
      </Head>

      <div style={{ padding: 'var(--space-lg)', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em', margin: 0 }}>
              Audit Explorer & Security Events
            </h1>
            <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-secondary)', fontSize: 'var(--font-sm)' }}>
              Immutable forensic audit trail for sensitive administrative, financial, and inventory transactions.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <button
              onClick={fetchLogs}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                background: '#ffffff',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text)',
                fontSize: 'var(--font-sm)',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              🔄 Refresh Logs
            </button>
          </div>
        </div>

        {/* Action Filter Pills */}
        <div style={{ background: '#ffffff', padding: 'var(--space-md)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginRight: '4px' }}>
            Filter by Action:
          </span>
          {ACTION_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setSelectedAction(f.value)}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--font-xs)',
                fontWeight: 600,
                cursor: 'pointer',
                border: selectedAction === f.value ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                background: selectedAction === f.value ? '#eff6ff' : '#ffffff',
                color: selectedAction === f.value ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Audit Log Table */}
        <div style={{ background: '#ffffff', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-sm)' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Timestamp</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Action Event</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Actor UID</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Summary</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Payload</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      Loading audit logs...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      No audit events recorded for selected filter.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                        {new Date(log.createdAt).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            fontFamily: 'monospace',
                            background:
                              log.action.includes('REFUND') || log.action.includes('APPROVAL')
                                ? '#fef3c7'
                                : log.action.includes('FINALIZED')
                                ? '#ecfdf5'
                                : '#f1f5f9',
                            color:
                              log.action.includes('REFUND') || log.action.includes('APPROVAL')
                                ? '#b45309'
                                : log.action.includes('FINALIZED')
                                ? '#047857'
                                : '#1e293b',
                            border: '1px solid var(--color-border)',
                          }}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
                        {log.actorUid.slice(0, 12)}...
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--color-text)' }}>
                        {log.summary}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        {log.payload ? (
                          <button
                            onClick={() => setSelectedEntry(log)}
                            style={{
                              padding: '4px 10px',
                              background: '#eff6ff',
                              border: '1px solid #bfdbfe',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: 'var(--font-xs)',
                              fontWeight: 600,
                              color: 'var(--color-primary)',
                              cursor: 'pointer',
                            }}
                          >
                            Inspect JSON
                          </button>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)' }}>None</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* JSON Payload Explorer Modal */}
        {selectedEntry && (
          <div
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
              zIndex: 1100,
              padding: 'var(--space-md)',
            }}
            onClick={() => setSelectedEntry(null)}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: 'var(--radius-xl)',
                width: '100%',
                maxWidth: '600px',
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: 'var(--shadow-xl)',
                border: '1px solid var(--color-border)',
                overflow: 'hidden',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: 'var(--space-md) var(--space-lg)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 'var(--font-base)', fontWeight: 700, color: 'var(--color-text)', fontFamily: 'monospace' }}>
                    {selectedEntry.action}
                  </h3>
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    Event ID: {selectedEntry.id} • {new Date(selectedEntry.createdAt).toLocaleString('en-IN')}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedEntry(null)}
                  style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--color-text-muted)' }}
                >
                  ✕
                </button>
              </div>

              <div style={{ padding: 'var(--space-lg)', overflowY: 'auto', flex: 1 }}>
                <pre
                  style={{
                    background: '#f8fafc',
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    color: '#0f172a',
                    whiteSpace: 'pre-wrap',
                    margin: 0,
                  }}
                >
                  {JSON.stringify(selectedEntry.payload || {}, null, 2)}
                </pre>
              </div>

              <div style={{ padding: 'var(--space-md) var(--space-lg)', borderTop: '1px solid var(--color-border)', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setSelectedEntry(null)}
                  style={{ padding: '8px 16px', background: '#ffffff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', fontWeight: 600, cursor: 'pointer' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
