'use client';

import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { useStore } from '@/context/StoreContext';
import { useAuth } from '@/context/AuthContext';
import { apiGet, apiGetBlob, ApiError } from '@/lib/api';
import { Gstr1ReportResponse } from '@pulseclinic/types';

export default function GSTReportsPage() {
  const { activeStore } = useStore();
  const { user, loading: authLoading } = useAuth();

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // 1st of current month
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [report, setReport] = useState<Gstr1ReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGstr1 = async () => {
    if (!activeStore || authLoading || !user) return;
    setLoading(true);
    setError(null);

    try {
      const res = await apiGet<{ success: boolean; report: Gstr1ReportResponse }>(
        `/reports/gst/gstr1?startDate=${startDate}&endDate=${endDate}`,
        activeStore.storeId
      );
      if (res.success) {
        setReport(res.report);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to generate GSTR-1 summary.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user && activeStore) {
      fetchGstr1();
    }
  }, [activeStore?.storeId, authLoading, user]);

  const handleDownloadCsv = async () => {
    if (!activeStore) return;
    try {
      const blob = await apiGetBlob(
        `/reports/gst/gstr1/csv?startDate=${startDate}&endDate=${endDate}`,
        activeStore.storeId
      );
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GSTR1_HSN_${startDate}_to_${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert('Failed to download CSV: ' + err.message);
    }
  };

  return (
    <DashboardLayout>
      <Head>
        <title>GSTR-1 Compliance & Tax Return Compiler | New Sanjivani Clinic</title>
      </Head>

      <div style={{ padding: 'var(--space-lg)', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em', margin: 0 }}>
              GSTR-1 Tax Return Compiler
            </h1>
            <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-secondary)', fontSize: 'var(--font-sm)' }}>
              Government-compliant HSN summary table compilation for GST portal upload (DEC-OPEN-01).
            </p>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <button
              id="btn-download-gstr1-csv"
              onClick={handleDownloadCsv}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                background: '#059669',
                color: '#ffffff',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-sm)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              📥 Download GST Portal CSV
            </button>
            <Link
              href="/billing/history"
              style={{
                padding: '8px 14px',
                background: '#ffffff',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text)',
                fontSize: 'var(--font-sm)',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              📋 Bill Register
            </Link>
          </div>
        </div>

        {/* Date Filter Bar */}
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
            onClick={fetchGstr1}
            style={{
              padding: '6px 14px',
              background: 'var(--color-primary)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-xs)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {loading ? 'Compiling...' : 'Generate GSTR-1'}
          </button>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)' }}>
            ⚠️ {error}
          </div>
        )}

        {/* GST KPI Cards */}
        {report && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)' }}>
            <div style={{ background: '#ffffff', padding: 'var(--space-md)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Covered Invoices</div>
              <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--color-text)', marginTop: '4px' }}>
                {report.totalInvoicesCount}
              </div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                GSTIN: {report.gstin}
              </div>
            </div>

            <div style={{ background: '#ffffff', padding: 'var(--space-md)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Total Taxable Value</div>
              <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--color-primary)', marginTop: '4px' }}>
                ₹{(report.totalTaxableValuePaise / 100).toFixed(2)}
              </div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                Net of discounts
              </div>
            </div>

            <div style={{ background: '#ffffff', padding: 'var(--space-md)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Central Tax (CGST)</div>
              <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: '#059669', marginTop: '4px' }}>
                ₹{(report.totalCgstPaise / 100).toFixed(2)}
              </div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                Intra-state output
              </div>
            </div>

            <div style={{ background: '#ffffff', padding: 'var(--space-md)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>State Tax (SGST)</div>
              <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: '#059669', marginTop: '4px' }}>
                ₹{(report.totalSgstPaise / 100).toFixed(2)}
              </div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                Intra-state output
              </div>
            </div>
          </div>
        )}

        {/* HSN Summary Table */}
        <div style={{ background: '#ffffff', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ padding: 'var(--space-md) var(--space-lg)', borderBottom: '1px solid var(--color-border)', background: '#f8fafc' }}>
            <h3 style={{ margin: 0, fontSize: 'var(--font-base)', fontWeight: 700, color: 'var(--color-text)' }}>
              Table 12: HSN-wise Summary of Outward Supplies
            </h3>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-sm)' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>HSN Code</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Description</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>UQC</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>Total Qty</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Total Value</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Taxable Value</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>CGST</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>SGST</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>IGST</th>
                </tr>
              </thead>
              <tbody>
                {!report || report.hsnSummary.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      No taxable outward supplies found in selected date range.
                    </td>
                  </tr>
                ) : (
                  report.hsnSummary.map((hsn, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, fontFamily: 'monospace' }}>
                        {hsn.hsnCode}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                        {hsn.description}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                        {hsn.uqc}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>
                        {hsn.totalQuantity}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        ₹{(hsn.totalValuePaise / 100).toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>
                        ₹{(hsn.taxableValuePaise / 100).toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#059669' }}>
                        ₹{(hsn.cgstPaise / 100).toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#059669' }}>
                        ₹{(hsn.sgstPaise / 100).toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        ₹{(hsn.igstPaise / 100).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
