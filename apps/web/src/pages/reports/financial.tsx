'use client';

import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { useStore } from '@/context/StoreContext';
import { useAuth } from '@/context/AuthContext';
import { apiGet, ApiError } from '@/lib/api';
import { FinancialReportResponse } from '@pulseclinic/types';

export default function FinancialReportPage() {
  const { activeStore } = useStore();
  const { user, loading: authLoading } = useAuth();

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [report, setReport] = useState<FinancialReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFinancial = async () => {
    if (!activeStore || authLoading || !user) return;
    setLoading(true);
    setError(null);

    try {
      const res = await apiGet<{ success: boolean; report: FinancialReportResponse }>(
        `/reports/financial?startDate=${startDate}&endDate=${endDate}`,
        activeStore.storeId
      );
      if (res.success) {
        setReport(res.report);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to compile financial report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user && activeStore) {
      fetchFinancial();
    }
  }, [activeStore?.storeId, authLoading, user]);

  return (
    <DashboardLayout>
      <Head>
        <title>Financial Sales & Tax Report | PulseClinic</title>
      </Head>

      <div style={{ padding: 'var(--space-lg)', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em', margin: 0 }}>
              Financial Performance & Tax Slabs
            </h1>
            <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-secondary)', fontSize: 'var(--font-sm)' }}>
              Comprehensive revenue audit, GST tax slab contributions, payment splits, and net operating profit.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <Link
              href="/reports/gst"
              style={{
                padding: '8px 16px',
                background: 'var(--color-primary)',
                color: '#ffffff',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-sm)',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              🧮 GSTR-1 Return Portal
            </Link>
          </div>
        </div>

        {/* Date Filters */}
        <div style={{ background: '#ffffff', padding: 'var(--space-md)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-sm)' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-sm)' }}
            />
          </div>

          <button
            onClick={fetchFinancial}
            style={{
              padding: '6px 14px',
              background: '#0f172a',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-xs)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {loading ? 'Compiling...' : 'Run Financial Audit'}
          </button>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Financial KPI Cards */}
        {report && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-md)' }}>
            <div style={{ background: '#ffffff', padding: 'var(--space-md)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Net Sales Revenue</div>
              <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: '#059669', marginTop: '4px' }}>
                ₹{(report.netSalesPaise / 100).toFixed(2)}
              </div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                {report.invoiceCount} finalized sales bills
              </div>
            </div>

            <div style={{ background: '#ffffff', padding: 'var(--space-md)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>GST Output Collected</div>
              <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: '#2563eb', marginTop: '4px' }}>
                ₹{(report.totalTaxPaise / 100).toFixed(2)}
              </div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                Total tax liability
              </div>
            </div>

            <div style={{ background: '#ffffff', padding: 'var(--space-md)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Discounts & Refunds</div>
              <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: '#d97706', marginTop: '4px' }}>
                ₹{((report.totalDiscountsPaise + report.totalRefundsPaise) / 100).toFixed(2)}
              </div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                {report.refundCount} refund returns
              </div>
            </div>

            <div style={{ background: '#ffffff', padding: 'var(--space-md)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Net Operating Margin</div>
              <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: report.netProfitPaise >= 0 ? '#059669' : '#dc2626', marginTop: '4px' }}>
                ₹{(report.netProfitPaise / 100).toFixed(2)}
              </div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                After ₹{(report.totalExpensesPaise / 100).toFixed(2)} expenses
              </div>
            </div>
          </div>
        )}

        {/* Tax Slab Breakdown Table */}
        {report && (
          <div style={{ background: '#ffffff', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ padding: 'var(--space-md) var(--space-lg)', borderBottom: '1px solid var(--color-border)', background: '#f8fafc' }}>
              <h3 style={{ margin: 0, fontSize: 'var(--font-base)', fontWeight: 700, color: 'var(--color-text)' }}>
                GST Tax Slab Distribution
              </h3>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-sm)' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                  <th style={{ padding: '10px 16px', fontWeight: 600 }}>GST Rate</th>
                  <th style={{ padding: '10px 16px', fontWeight: 600, textAlign: 'right' }}>Taxable Sales (INR)</th>
                  <th style={{ padding: '10px 16px', fontWeight: 600, textAlign: 'right' }}>Tax Amount (INR)</th>
                </tr>
              </thead>
              <tbody>
                {report.taxSlabBreakdown.map((slab) => (
                  <tr key={slab.gstRateBps} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700 }}>
                      {(slab.gstRateBps / 100).toFixed(0)}% GST
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      ₹{(slab.taxablePaise / 100).toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#059669' }}>
                      ₹{(slab.taxPaise / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
