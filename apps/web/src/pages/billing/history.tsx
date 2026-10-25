'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { useStore } from '@/context/StoreContext';
import { useAuth } from '@/context/AuthContext';
import { apiGet, ApiError } from '@/lib/api';
import { InvoiceRecord } from '@pulseclinic/types';
import { ApprovalRequestModal } from '@/components/billing/ApprovalRequestModal';

interface InvoicesResponse {
  success: boolean;
  invoices: InvoiceRecord[];
  nextCursor?: string;
}

export default function BillingHistoryPage() {
  const { activeStore } = useStore();
  const { user, loading: authLoading } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'FINALIZED' | 'REFUNDED' | 'CANCELLED'>('ALL');
  const [dateRange, setDateRange] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');

  // Drawer / Detail View
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<'DETAILS' | 'THERMAL' | 'A4'>('DETAILS');

  // Approval Request Modal (Prompt 17 & 18)
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [invoiceToRefund, setInvoiceToRefund] = useState<InvoiceRecord | null>(null);

  // Fetch Invoices from API
  const fetchInvoices = async () => {
    if (!activeStore || authLoading || !user) return;
    setLoading(true);
    setError(null);
    try {
      let url = '/bills?limit=100';
      if (statusFilter !== 'ALL') {
        url += `&status=${statusFilter}`;
      }
      if (searchQuery.trim()) {
        url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      }

      const res = await apiGet<InvoicesResponse>(url, activeStore.storeId);
      if (res.success) {
        setInvoices(res.invoices || []);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to load invoice history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user && activeStore) {
      fetchInvoices();
    }
  }, [activeStore?.storeId, statusFilter, authLoading, user]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchInvoices();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter by Date Range Client-side
  const filteredInvoices = useMemo(() => {
    let result = invoices;

    if (dateRange !== 'ALL') {
      const now = new Date();
      result = result.filter((inv) => {
        const invDate = new Date(inv.createdAt);
        if (dateRange === 'TODAY') {
          return (
            invDate.getDate() === now.getDate() &&
            invDate.getMonth() === now.getMonth() &&
            invDate.getFullYear() === now.getFullYear()
          );
        } else if (dateRange === 'WEEK') {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return invDate >= sevenDaysAgo;
        } else if (dateRange === 'MONTH') {
          return (
            invDate.getMonth() === now.getMonth() &&
            invDate.getFullYear() === now.getFullYear()
          );
        }
        return true;
      });
    }

    return result;
  }, [invoices, dateRange]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalCount = filteredInvoices.length;
    const totalNetSalesPaise = filteredInvoices
      .filter((inv) => inv.status === 'FINALIZED')
      .reduce((sum, inv) => sum + (inv.netPayablePaise || 0), 0);
    const totalTaxPaise = filteredInvoices
      .filter((inv) => inv.status === 'FINALIZED')
      .reduce((sum, inv) => sum + (inv.taxTotalPaise || 0), 0);

    const now = new Date();
    const todayCount = filteredInvoices.filter((inv) => {
      const d = new Date(inv.createdAt);
      return (
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      );
    }).length;

    return {
      totalCount,
      totalNetSalesRupees: (totalNetSalesPaise / 100).toFixed(2),
      totalTaxRupees: (totalTaxPaise / 100).toFixed(2),
      todayCount,
    };
  }, [filteredInvoices]);

  const openInvoiceDetails = (inv: InvoiceRecord, tab: 'DETAILS' | 'THERMAL' | 'A4' = 'DETAILS') => {
    setSelectedInvoice(inv);
    setDetailTab(tab);
    setIsDetailDrawerOpen(true);
  };

  const closeInvoiceDetails = () => {
    setIsDetailDrawerOpen(false);
    setSelectedInvoice(null);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <DashboardLayout>
      <Head>
        <title>Bill History & GST Register | PulseClinic</title>
      </Head>

      <div style={{ padding: 'var(--space-lg)', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        {/* Page Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em', margin: 0 }}>
              Bill Register & Invoices
            </h1>
            <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-secondary)', fontSize: 'var(--font-sm)' }}>
              Complete GST sales audit history, sequential invoice ledger, and thermal receipts.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <button
              onClick={fetchInvoices}
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
              🔄 Refresh
            </button>
            <Link
              href="/billing/new"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
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
              + New POS Bill (F2)
            </Link>
          </div>
        </div>

        {/* Metric Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-md)' }}>
          <div style={{ background: '#ffffff', padding: 'var(--space-md)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Bills Generated
            </div>
            <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--color-text)', marginTop: '4px' }}>
              {metrics.totalCount}
            </div>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              {metrics.todayCount} created today
            </div>
          </div>

          <div style={{ background: '#ffffff', padding: 'var(--space-md)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Net Sales
            </div>
            <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: '#059669', marginTop: '4px' }}>
              ₹{metrics.totalNetSalesRupees}
            </div>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              Round-off applied
            </div>
          </div>

          <div style={{ background: '#ffffff', padding: 'var(--space-md)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              GST Output Tax
            </div>
            <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: '#2563eb', marginTop: '4px' }}>
              ₹{metrics.totalTaxRupees}
            </div>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              CGST + SGST / IGST collected
            </div>
          </div>

          <div style={{ background: '#ffffff', padding: 'var(--space-md)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Avg Bill Value
            </div>
            <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--color-text)', marginTop: '4px' }}>
              ₹{metrics.totalCount > 0 ? (parseFloat(metrics.totalNetSalesRupees) / metrics.totalCount).toFixed(2) : '0.00'}
            </div>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              Per customer transaction
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div style={{ background: '#ffffff', padding: 'var(--space-md)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Search Box */}
          <div style={{ flex: '1 1 300px', position: 'relative' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}>
              🔍
            </span>
            <input
              type="text"
              placeholder="Search by invoice number (INV-...), customer name, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-sm)',
                outline: 'none',
                background: '#ffffff',
                color: 'var(--color-text)',
              }}
            />
          </div>

          {/* Status Filters */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginRight: '4px' }}>
              Status:
            </span>
            {(['ALL', 'FINALIZED', 'REFUNDED', 'CANCELLED'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 'var(--font-xs)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: statusFilter === st ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                  background: statusFilter === st ? '#eff6ff' : '#ffffff',
                  color: statusFilter === st ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Date Range Filters */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginRight: '4px' }}>
              Period:
            </span>
            {(['ALL', 'TODAY', 'WEEK', 'MONTH'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDateRange(d)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-xs)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: dateRange === d ? '1px solid #0f172a' : '1px solid var(--color-border)',
                  background: dateRange === d ? '#0f172a' : '#ffffff',
                  color: dateRange === d ? '#ffffff' : 'var(--color-text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                {d === 'ALL' ? 'All' : d === 'TODAY' ? 'Today' : d === 'WEEK' ? '7 Days' : 'This Month'}
              </button>
            ))}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Invoices Table */}
        <div style={{ background: '#ffffff', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-sm)' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Invoice #</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Date & Time</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Customer</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Prescriber</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Items</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Payment Mode</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Net Amount</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      Loading invoice records...
                    </td>
                  </tr>
                ) : filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      <div style={{ fontSize: '32px', marginBottom: '8px' }}>🧾</div>
                      <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: 'var(--font-base)' }}>
                        No invoices found
                      </div>
                      <div style={{ fontSize: 'var(--font-xs)', marginTop: '4px' }}>
                        Generate your first bill in POS Terminal to see it recorded here.
                      </div>
                      <Link
                        href="/billing/new"
                        style={{
                          display: 'inline-block',
                          marginTop: '16px',
                          padding: '8px 16px',
                          background: 'var(--color-primary)',
                          color: '#ffffff',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 'var(--font-xs)',
                          fontWeight: 600,
                          textDecoration: 'none',
                        }}
                      >
                        Go to Cashier POS (F2)
                      </Link>
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => {
                    const dateFormatted = new Date(inv.createdAt).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <tr
                        key={inv.id}
                        style={{
                          borderBottom: '1px solid var(--color-border)',
                          transition: 'background 0.1s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                      >
                        {/* Invoice Number */}
                        <td style={{ padding: '14px 16px', fontWeight: 700, fontFamily: 'monospace' }}>
                          <span
                            onClick={() => openInvoiceDetails(inv, 'DETAILS')}
                            style={{
                              color: 'var(--color-primary)',
                              cursor: 'pointer',
                              background: '#eff6ff',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              border: '1px solid #bfdbfe',
                            }}
                          >
                            {inv.invoiceNumber}
                          </span>
                        </td>

                        {/* Date */}
                        <td style={{ padding: '14px 16px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                          {dateFormatted}
                        </td>

                        {/* Customer */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                            {inv.customer?.name || 'Walk-in Guest'}
                          </div>
                          {inv.customer?.phone && (
                            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
                              📱 {inv.customer.phone}
                            </div>
                          )}
                        </td>

                        {/* Doctor */}
                        <td style={{ padding: '14px 16px' }}>
                          {inv.doctorName ? (
                            <span style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: '4px', fontSize: 'var(--font-xs)', fontWeight: 500 }}>
                              🩺 {inv.doctorName}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)' }}>
                              OTC (No Prescriber)
                            </span>
                          )}
                        </td>

                        {/* Items */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 600 }}>{inv.items?.length || 0} items</span>
                            {inv.hasScheduleH && (
                              <span
                                title="Contains Schedule H / Prescription drugs"
                                style={{
                                  background: '#fffbeb',
                                  color: '#b45309',
                                  border: '1px solid #fde68a',
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  padding: '1px 5px',
                                  borderRadius: '3px',
                                }}
                              >
                                SCHED H
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Payment Modes */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {inv.paymentModes?.map((pm, idx) => (
                              <span
                                key={idx}
                                style={{
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  background: pm.mode === 'CASH' ? '#ecfdf5' : pm.mode === 'UPI' ? '#eff6ff' : '#f5f3ff',
                                  color: pm.mode === 'CASH' ? '#047857' : pm.mode === 'UPI' ? '#1d4ed8' : '#6d28d9',
                                  border: `1px solid ${pm.mode === 'CASH' ? '#a7f3d0' : pm.mode === 'UPI' ? '#bfdbfe' : '#ddd6fe'}`,
                                }}
                              >
                                {pm.mode}: ₹{(pm.amountPaise / 100).toFixed(2)}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Net Amount */}
                        <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, fontSize: 'var(--font-base)', color: 'var(--color-text)' }}>
                          ₹{((inv.netPayablePaise || 0) / 100).toFixed(2)}
                        </td>

                        {/* Status */}
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <span
                            style={{
                              padding: '4px 10px',
                              borderRadius: 'var(--radius-full)',
                              fontSize: '11px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
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

                        {/* Actions */}
                        <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                            <button
                              id={`btn-view-${inv.invoiceNumber}`}
                              onClick={() => openInvoiceDetails(inv, 'DETAILS')}
                              style={{
                                padding: '5px 10px',
                                background: '#f8fafc',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: 'var(--font-xs)',
                                fontWeight: 600,
                                color: 'var(--color-text)',
                                cursor: 'pointer',
                              }}
                            >
                              View
                            </button>
                            <button
                              id={`btn-receipt-${inv.invoiceNumber}`}
                              onClick={() => openInvoiceDetails(inv, 'THERMAL')}
                              style={{
                                padding: '5px 10px',
                                background: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: 'var(--font-xs)',
                                fontWeight: 600,
                                color: 'var(--color-primary)',
                                cursor: 'pointer',
                              }}
                            >
                              🖨️ Receipt
                            </button>
                            {inv.status === 'FINALIZED' && (
                              <button
                                id={`btn-refund-${inv.invoiceNumber}`}
                                onClick={() => {
                                  setInvoiceToRefund(inv);
                                  setIsApprovalModalOpen(true);
                                }}
                                style={{
                                  padding: '5px 10px',
                                  background: '#fff1f2',
                                  border: '1px solid #fecdd3',
                                  borderRadius: 'var(--radius-sm)',
                                  fontSize: 'var(--font-xs)',
                                  fontWeight: 600,
                                  color: '#e11d48',
                                  cursor: 'pointer',
                                }}
                              >
                                ↩️ Refund
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Invoice Detail Drawer / Modal */}
        {isDetailDrawerOpen && selectedInvoice && (
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
              zIndex: 1000,
              padding: 'var(--space-md)',
            }}
            onClick={closeInvoiceDetails}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: 'var(--radius-xl)',
                width: '100%',
                maxWidth: '850px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: 'var(--shadow-xl)',
                border: '1px solid var(--color-border)',
                overflow: 'hidden',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Top Header */}
              <div
                style={{
                  padding: 'var(--space-md) var(--space-lg)',
                  borderBottom: '1px solid var(--color-border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#f8fafc',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 style={{ margin: 0, fontSize: 'var(--font-lg)', fontWeight: 700, color: 'var(--color-text)', fontFamily: 'monospace' }}>
                      {selectedInvoice.invoiceNumber}
                    </h2>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: '#dcfce7',
                        color: '#15803d',
                      }}
                    >
                      {selectedInvoice.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    Issued on {new Date(selectedInvoice.createdAt).toLocaleString('en-IN')} • Store: {activeStore?.storeName || 'PulseClinic Pharmacy'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {/* Tab Selector */}
                  <div style={{ display: 'flex', background: '#e2e8f0', padding: '3px', borderRadius: 'var(--radius-md)' }}>
                    <button
                      onClick={() => setDetailTab('DETAILS')}
                      style={{
                        padding: '4px 10px',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--font-xs)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: detailTab === 'DETAILS' ? '#ffffff' : 'transparent',
                        color: detailTab === 'DETAILS' ? 'var(--color-text)' : 'var(--color-text-secondary)',
                      }}
                    >
                      Itemized Audit
                    </button>
                    <button
                      onClick={() => setDetailTab('THERMAL')}
                      style={{
                        padding: '4px 10px',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--font-xs)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: detailTab === 'THERMAL' ? '#ffffff' : 'transparent',
                        color: detailTab === 'THERMAL' ? 'var(--color-text)' : 'var(--color-text-secondary)',
                      }}
                    >
                      80mm Receipt
                    </button>
                  </div>

                  <button
                    onClick={closeInvoiceDetails}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '18px',
                      cursor: 'pointer',
                      color: 'var(--color-text-muted)',
                      padding: '4px',
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div style={{ padding: 'var(--space-lg)', overflowY: 'auto', flex: 1 }}>
                {detailTab === 'DETAILS' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    {/* Meta info boxes */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)' }}>
                      <div style={{ background: '#f8fafc', padding: 'var(--space-sm) var(--space-md)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Customer Details</div>
                        <div style={{ fontWeight: 600, color: 'var(--color-text)', marginTop: '2px' }}>
                          {selectedInvoice.customer?.name || 'Walk-in Customer'}
                        </div>
                        {selectedInvoice.customer?.phone && (
                          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)' }}>
                            Phone: {selectedInvoice.customer.phone}
                          </div>
                        )}
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          State Code: {selectedInvoice.customer?.stateCode || '29'}
                        </div>
                      </div>

                      <div style={{ background: '#f8fafc', padding: 'var(--space-sm) var(--space-md)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Prescribing Doctor</div>
                        <div style={{ fontWeight: 600, color: 'var(--color-text)', marginTop: '2px' }}>
                          {selectedInvoice.doctorName ? `Dr. ${selectedInvoice.doctorName}` : 'Over The Counter (OTC)'}
                        </div>
                        {selectedInvoice.prescriptionNumber && (
                          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)' }}>
                            Rx #: {selectedInvoice.prescriptionNumber}
                          </div>
                        )}
                        {selectedInvoice.hasScheduleH && (
                          <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 600, marginTop: '2px' }}>
                            ⚠️ Schedule H Drug Dispensed
                          </div>
                        )}
                      </div>

                      <div style={{ background: '#f8fafc', padding: 'var(--space-sm) var(--space-md)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Biller & Audit</div>
                        <div style={{ fontWeight: 600, color: 'var(--color-text)', marginTop: '2px' }}>
                          Cashier ID: {selectedInvoice.billerUid}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          Calc Version: v{selectedInvoice.calculationVersion}
                        </div>
                      </div>
                    </div>

                    {/* Line Items Table */}
                    <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-xs)' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                            <th style={{ padding: '8px 12px' }}>Medicine</th>
                            <th style={{ padding: '8px 12px' }}>Batch</th>
                            <th style={{ padding: '8px 12px', textAlign: 'center' }}>Qty</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right' }}>Price</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right' }}>Disc %</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right' }}>Taxable</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right' }}>GST</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right' }}>Line Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedInvoice.items?.map((it, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                              <td style={{ padding: '8px 12px', fontWeight: 600 }}>{it.medicineName}</td>
                              <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{it.batchNumber || it.batchId}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'center' }}>{it.quantityUnits}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }}>₹{(it.unitPricePaise / 100).toFixed(2)}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }}>{((it.discountBps || 0) / 100).toFixed(1)}%</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }}>₹{(it.taxablePaise / 100).toFixed(2)}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }}>{((it.gstRateBps || 0) / 100).toFixed(0)}%</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>₹{(it.lineTotalPaise / 100).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Tax & Financial Summary Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                      {/* Payment modes breakdown */}
                      <div style={{ background: '#f8fafc', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                        <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                          Split Payment Breakdown
                        </div>
                        {selectedInvoice.paymentModes?.map((pm, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 'var(--font-sm)', borderBottom: '1px dashed #e2e8f0' }}>
                            <span style={{ fontWeight: 600 }}>{pm.mode}</span>
                            <span>₹{(pm.amountPaise / 100).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Financial Totals */}
                      <div style={{ background: '#f8fafc', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: 'var(--font-sm)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--color-text-secondary)' }}>Gross Total:</span>
                          <span>₹{(selectedInvoice.grossTotalPaise / 100).toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--color-text-secondary)' }}>Total Discount:</span>
                          <span style={{ color: '#059669' }}>-₹{(selectedInvoice.totalDiscountPaise / 100).toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--color-text-secondary)' }}>Taxable Value:</span>
                          <span>₹{(selectedInvoice.taxableTotalPaise / 100).toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--color-text-secondary)' }}>CGST:</span>
                          <span>₹{(selectedInvoice.cgstTotalPaise / 100).toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--color-text-secondary)' }}>SGST:</span>
                          <span>₹{(selectedInvoice.sgstTotalPaise / 100).toFixed(2)}</span>
                        </div>
                        {selectedInvoice.roundOffPaise !== 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--color-text-secondary)' }}>Round-off:</span>
                            <span>{selectedInvoice.roundOffPaise > 0 ? `+₹${(selectedInvoice.roundOffPaise / 100).toFixed(2)}` : `-₹${(Math.abs(selectedInvoice.roundOffPaise) / 100).toFixed(2)}`}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--color-border)', paddingTop: '6px', marginTop: '4px', fontWeight: 700, fontSize: 'var(--font-base)', color: 'var(--color-primary)' }}>
                          <span>Net Payable:</span>
                          <span>₹{(selectedInvoice.netPayablePaise / 100).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {detailTab === 'THERMAL' && (
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <div
                      id="thermal-receipt-container"
                      className="printable-receipt-card"
                      style={{
                        width: '320px',
                        background: '#ffffff',
                        border: '1px dashed #cbd5e1',
                        borderRadius: 'var(--radius-sm)',
                        padding: '16px',
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        color: '#0f172a',
                        boxShadow: 'var(--shadow-sm)',
                      }}
                    >
                      {/* Thermal Receipt Header */}
                      <div style={{ textAlign: 'center', borderBottom: '1px dashed #94a3b8', paddingBottom: '8px', marginBottom: '8px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 700 }}>{activeStore?.storeName || 'PulseClinic Pharmacy'}</div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>GSTIN: 29AABCU9603R1ZM • Reg: DL-2024-KA-8492</div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>No. 42, 100ft Ring Road, Indiranagar, Bengaluru</div>
                      </div>

                      {/* Meta */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span>Inv: {selectedInvoice.invoiceNumber}</span>
                        <span>{new Date(selectedInvoice.createdAt).toLocaleDateString('en-IN')}</span>
                      </div>
                      <div style={{ marginBottom: '6px' }}>
                        Cust: {selectedInvoice.customer?.name || 'Walk-in'} {selectedInvoice.customer?.phone ? `(${selectedInvoice.customer.phone})` : ''}
                      </div>
                      {selectedInvoice.doctorName && (
                        <div style={{ marginBottom: '6px', color: '#1e3a8a' }}>
                          Doc: Dr. {selectedInvoice.doctorName}
                        </div>
                      )}

                      {/* Items */}
                      <div style={{ borderTop: '1px dashed #94a3b8', borderBottom: '1px dashed #94a3b8', padding: '6px 0', margin: '6px 0' }}>
                        {selectedInvoice.items?.map((it, idx) => (
                          <div key={idx} style={{ marginBottom: '4px' }}>
                            <div style={{ fontWeight: 600 }}>{it.medicineName}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                              <span>
                                {it.quantityUnits} x ₹{(it.unitPricePaise / 100).toFixed(2)}
                              </span>
                              <span style={{ fontWeight: 700, color: '#0f172a' }}>
                                ₹{(it.lineTotalPaise / 100).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Financial Totals */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Subtotal:</span>
                          <span>₹{(selectedInvoice.taxableTotalPaise / 100).toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Total GST:</span>
                          <span>₹{(selectedInvoice.taxTotalPaise / 100).toFixed(2)}</span>
                        </div>
                        {selectedInvoice.roundOffPaise !== 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Round-off:</span>
                            <span>{selectedInvoice.roundOffPaise > 0 ? `+₹${(selectedInvoice.roundOffPaise / 100).toFixed(2)}` : `-₹${(Math.abs(selectedInvoice.roundOffPaise) / 100).toFixed(2)}`}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #94a3b8', paddingTop: '4px', fontWeight: 700, fontSize: '13px' }}>
                          <span>GRAND TOTAL:</span>
                          <span>₹{(selectedInvoice.netPayablePaise / 100).toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Payment modes */}
                      <div style={{ borderTop: '1px dashed #94a3b8', marginTop: '6px', paddingTop: '6px' }}>
                        {selectedInvoice.paymentModes?.map((pm, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Paid via {pm.mode}:</span>
                            <span>₹{(pm.amountPaise / 100).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Footer */}
                      <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '10px', color: '#64748b' }}>
                        Thank You For Your Visit! Get Well Soon.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer Actions */}
              <div
                style={{
                  padding: 'var(--space-md) var(--space-lg)',
                  borderTop: '1px solid var(--color-border)',
                  background: '#f8fafc',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
                  Press Esc to close window
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {selectedInvoice.status === 'FINALIZED' && (
                    <button
                      onClick={() => {
                        setInvoiceToRefund(selectedInvoice);
                        setIsApprovalModalOpen(true);
                      }}
                      style={{
                        padding: '8px 16px',
                        background: '#fff1f2',
                        color: '#e11d48',
                        border: '1px solid #fecdd3',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--font-sm)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      ↩️ Request Refund
                    </button>
                  )}
                  <button
                    onClick={handlePrint}
                    style={{
                      padding: '8px 16px',
                      background: 'var(--color-primary)',
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
                    🖨️ Print Receipt
                  </button>
                  <button
                    onClick={closeInvoiceDetails}
                    style={{
                      padding: '8px 16px',
                      background: '#ffffff',
                      color: 'var(--color-text)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--font-sm)',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Approval Code & Refund Execution Modal (Prompt 17 & 18) */}
        {isApprovalModalOpen && invoiceToRefund && activeStore && (
          <ApprovalRequestModal
            invoice={invoiceToRefund}
            storeId={activeStore.storeId}
            onClose={() => {
              setIsApprovalModalOpen(false);
              setInvoiceToRefund(null);
            }}
            onRefundSuccess={() => {
              setIsApprovalModalOpen(false);
              setInvoiceToRefund(null);
              setIsDetailDrawerOpen(false);
              setSelectedInvoice(null);
              fetchInvoices();
            }}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
