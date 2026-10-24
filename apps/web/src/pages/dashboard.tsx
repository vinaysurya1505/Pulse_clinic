'use client';

import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import { useStore } from '@/context/StoreContext';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { apiGet, apiPost, ApiError } from '@/lib/api';
import { InvoiceRecord } from '@pulseclinic/types';

interface DashboardMetrics {
  todaySalesPaise: number;
  todayTaxPaise: number;
  todayRefundsPaise: number;
  todayExpensesPaise: number;
  todayNetRevenuePaise: number;
  todayInvoiceCount: number;
  lowStockItemsCount: number;
  expiringSoonItemsCount: number;
  recentInvoices: InvoiceRecord[];
  isDayClosed: boolean;
  summaryDate: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { activeStore } = useStore();

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Daily Closing Modal
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [closingNotes, setClosingNotes] = useState('');
  const [closingSubmitting, setClosingSubmitting] = useState(false);
  const [closingError, setClosingError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/auth/signin');
    }
  }, [user, authLoading, router]);

  const fetchDashboardMetrics = async () => {
    if (!activeStore || authLoading || !user) return;
    setLoading(true);
    setError(null);

    try {
      const res = await apiGet<{ success: boolean; metrics: DashboardMetrics }>(
        '/dashboard',
        activeStore.storeId
      );
      if (res.success) {
        setMetrics(res.metrics);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user && activeStore) {
      fetchDashboardMetrics();
    }
  }, [activeStore?.storeId, authLoading, user]);

  const handleExecuteDailyClosing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore) return;

    setClosingSubmitting(true);
    setClosingError(null);

    try {
      const res = await apiPost<{ success: boolean; message: string }>(
        '/dashboard/daily-closing',
        { notes: closingNotes.trim() || undefined },
        activeStore.storeId
      );

      if (res.success) {
        setIsClosingModalOpen(false);
        setClosingNotes('');
        alert('Daily register successfully closed and locked.');
        fetchDashboardMetrics();
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) setClosingError(err.message);
      else setClosingError('Failed to execute daily closing.');
    } finally {
      setClosingSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8fafc', color: '#64748b', fontSize: '15px', fontWeight: 600 }}>
        Loading PulseClinic Pharmacy Console...
      </div>
    );
  }

  if (!user) return null;

  return (
    <DashboardLayout>
      <Head>
        <title>Dashboard | PulseClinic</title>
      </Head>

      <div style={{ padding: 'var(--space-lg)', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em', margin: 0 }}>
              Store Operations Dashboard
            </h1>
            <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-secondary)', fontSize: 'var(--font-sm)' }}>
              Real-time sales revenue, inventory health, and daily register summary for {activeStore.storeName}.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            {metrics?.isDayClosed ? (
              <span style={{ padding: '6px 12px', borderRadius: 'var(--radius-full)', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', fontSize: 'var(--font-xs)', fontWeight: 700 }}>
                🔒 DAY REGISTER LOCKED
              </span>
            ) : (
              <button
                id="btn-daily-closing"
                onClick={() => {
                  setClosingError(null);
                  setIsClosingModalOpen(true);
                }}
                style={{
                  padding: '8px 16px',
                  background: '#d97706',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-sm)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                🔒 Execute Daily Closing
              </button>
            )}

            <button
              onClick={fetchDashboardMetrics}
              style={{
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
              🔄 Refresh
            </button>

            <Link
              href="/billing/new"
              style={{
                padding: '8px 16px',
                background: 'var(--color-primary)',
                color: '#ffffff',
                borderRadius: 'var(--radius-md)',
                fontWeight: 600,
                fontSize: 'var(--font-sm)',
                textDecoration: 'none',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              + New Bill (F2)
            </Link>
          </div>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Executive KPI Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-md)' }}>
          {/* Card 1: Today's Net Revenue */}
          <div style={{ background: '#ffffff', padding: 'var(--space-md)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Today&apos;s Net Revenue
            </div>
            <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: '#059669', marginTop: '4px' }}>
              ₹{metrics ? ((metrics.todayNetRevenuePaise || 0) / 100).toFixed(2) : '0.00'}
            </div>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              Sales minus refunds & expenses
            </div>
          </div>

          {/* Card 2: Today's Bills */}
          <div style={{ background: '#ffffff', padding: 'var(--space-md)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Today&apos;s Invoices
            </div>
            <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--color-text)', marginTop: '4px' }}>
              {metrics?.todayInvoiceCount || 0}
            </div>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              Gross Sales: ₹{metrics ? ((metrics.todaySalesPaise || 0) / 100).toFixed(2) : '0.00'}
            </div>
          </div>

          {/* Card 3: Low Stock Alerts */}
          <div style={{ background: '#ffffff', padding: 'var(--space-md)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Low Stock Batches
            </div>
            <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: metrics && metrics.lowStockItemsCount > 0 ? '#d97706' : '#059669', marginTop: '4px' }}>
              {metrics?.lowStockItemsCount || 0}
            </div>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              Batches with &le; 20 units
            </div>
          </div>

          {/* Card 4: Expiring Soon */}
          <div style={{ background: '#ffffff', padding: 'var(--space-md)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Near Expiry (90 Days)
            </div>
            <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: metrics && metrics.expiringSoonItemsCount > 0 ? '#dc2626' : '#059669', marginTop: '4px' }}>
              {metrics?.expiringSoonItemsCount || 0}
            </div>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              Requires FEFO clearance
            </div>
          </div>
        </div>

        {/* Quick Launchpad */}
        <div style={{ background: '#ffffff', padding: 'var(--space-md) var(--space-lg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
          <h2 style={{ fontSize: 'var(--font-sm)', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 var(--space-sm) 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Quick Operations Launchpad
          </h2>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
            <Link
              href="/billing/new"
              style={{ padding: '8px 14px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-xs)', fontWeight: 600, textDecoration: 'none' }}
            >
              🧾 Cashier POS Terminal (F2)
            </Link>
            <Link
              href="/billing/history"
              style={{ padding: '8px 14px', background: '#f8fafc', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-xs)', fontWeight: 600, textDecoration: 'none' }}
            >
              📋 Bill History & Receipts
            </Link>
            <Link
              href="/expenses"
              style={{ padding: '8px 14px', background: '#f8fafc', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-xs)', fontWeight: 600, textDecoration: 'none' }}
            >
              💰 Expenses & Cash Drawer
            </Link>
            <Link
              href="/inventory/medicines"
              style={{ padding: '8px 14px', background: '#f8fafc', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-xs)', fontWeight: 600, textDecoration: 'none' }}
            >
              💊 Medicine Catalogue
            </Link>
            <Link
              href="/inventory/batches"
              style={{ padding: '8px 14px', background: '#f8fafc', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-xs)', fontWeight: 600, textDecoration: 'none' }}
            >
              📦 Batch FEFO Stock
            </Link>
            <Link
              href="/imports/csv"
              style={{ padding: '8px 14px', background: '#f8fafc', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-xs)', fontWeight: 600, textDecoration: 'none' }}
            >
              📁 CSV Inventory Ingestion
            </Link>
          </div>
        </div>

        {/* Recent Invoices Table */}
        <div style={{ background: '#ffffff', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ padding: 'var(--space-md) var(--space-lg)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 'var(--font-base)', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
              Recent Store Invoices
            </h2>
            <Link
              href="/billing/history"
              style={{ fontSize: 'var(--font-xs)', color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}
            >
              View All Invoices &rarr;
            </Link>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-sm)' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                  <th style={{ padding: '10px 16px', fontWeight: 600 }}>Invoice #</th>
                  <th style={{ padding: '10px 16px', fontWeight: 600 }}>Time</th>
                  <th style={{ padding: '10px 16px', fontWeight: 600 }}>Customer</th>
                  <th style={{ padding: '10px 16px', fontWeight: 600 }}>Items</th>
                  <th style={{ padding: '10px 16px', fontWeight: 600, textAlign: 'right' }}>Net Payable</th>
                  <th style={{ padding: '10px 16px', fontWeight: 600, textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      Loading recent invoices...
                    </td>
                  </tr>
                ) : !metrics?.recentInvoices || metrics.recentInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      No invoices recorded today.
                    </td>
                  </tr>
                ) : (
                  metrics.recentInvoices.map((inv) => (
                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, fontFamily: 'monospace' }}>
                        <Link href="/billing/history" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)' }}>
                        {new Date(inv.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                        {inv.customer?.name || 'Walk-in Guest'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {inv.items?.length || 0} items
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>
                        ₹{((inv.netPayablePaise || 0) / 100).toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-full)',
                            fontSize: '11px',
                            fontWeight: 700,
                            background:
                              inv.status === 'FINALIZED'
                                ? '#dcfce7'
                                : inv.status === 'REFUNDED'
                                ? '#fef3c7'
                                : '#fee2e2',
                            color:
                              inv.status === 'FINALIZED'
                                ? '#15803d'
                                : inv.status === 'REFUNDED'
                                ? '#b45309'
                                : '#b91c1c',
                          }}
                        >
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Daily Closing */}
        {isClosingModalOpen && (
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
            onClick={() => setIsClosingModalOpen(false)}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: 'var(--radius-xl)',
                width: '100%',
                maxWidth: '480px',
                padding: 'var(--space-lg)',
                boxShadow: 'var(--shadow-xl)',
                border: '1px solid var(--color-border)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: '0 0 var(--space-md) 0', fontSize: 'var(--font-lg)', fontWeight: 700, color: 'var(--color-text)' }}>
                🔒 Confirm Daily Register Closing
              </h3>

              {closingError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '8px 12px', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-xs)', marginBottom: 'var(--space-md)' }}>
                  ⚠️ {closingError}
                </div>
              )}

              <form onSubmit={handleExecuteDailyClosing} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)' }}>
                    <span>Closing Date:</span>
                    <span style={{ fontWeight: 600 }}>{metrics?.summaryDate || new Date().toISOString().split('T')[0]}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                    <span>Today&apos;s Gross Sales:</span>
                    <span>₹{metrics ? ((metrics.todaySalesPaise || 0) / 100).toFixed(2) : '0.00'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626', marginTop: '2px' }}>
                    <span>Today&apos;s Expenses:</span>
                    <span>-₹{metrics ? ((metrics.todayExpensesPaise || 0) / 100).toFixed(2) : '0.00'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #cbd5e1', paddingTop: '6px', marginTop: '6px', fontWeight: 700, color: '#059669' }}>
                    <span>Net Day Revenue:</span>
                    <span>₹{metrics ? ((metrics.todayNetRevenuePaise || 0) / 100).toFixed(2) : '0.00'}</span>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                    Closing Audit Notes (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. End of day accounts reconciled"
                    value={closingNotes}
                    onChange={(e) => setClosingNotes(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-sm)', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
                  <button
                    type="button"
                    onClick={() => setIsClosingModalOpen(false)}
                    style={{ padding: '8px 16px', background: '#ffffff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={closingSubmitting}
                    style={{ padding: '8px 16px', background: '#d97706', color: '#ffffff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {closingSubmitting ? 'Closing Day...' : 'Lock & Save Summary'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
