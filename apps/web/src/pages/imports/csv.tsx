'use client';

import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { useStore } from '@/context/StoreContext';
import { apiPost, ApiError } from '@/lib/api';
import { CSVPreviewResult, ImportJob } from '@pulseclinic/types';

const CSV_HEADER_ROW = 'Medicine Name,Form,Rack,Units/Strip,MRP/Strip,Batch #,Expiry,Qty';

const BLANK_TEMPLATE_CSV = `${CSV_HEADER_ROW}
Augmentin 625 Duo,Tablet,Rack B-1,10,205.50,AUG2024A,08/2027,100`;

const SAMPLE_CSV = `${CSV_HEADER_ROW}
Augmentin 625 Duo,Tablet,Rack B-1,10,205.50,AUG2024A,08/2027,100
Dolo 650,Tablet,Rack A-1,15,32.00,DOL2401,11/2027,200
Azithral 500,Tablet,Rack B-2,5,120.00,AZI5001,12/2026,50
Pan 40,Tablet,Rack C-1,15,155.00,PAN409,06/2027,80
Montek LC,Tablet,Rack D-3,10,195.00,MLC881,04/2027,60
Telma 40,Tablet,Rack E-2,15,140.00,TEL400,09/2027,90
Glycomet 500 SR,Tablet,Rack F-1,20,48.00,GLY501,05/2027,150
Ascoril LS Syrup,Syrup,Rack D-1,1,118.00,ASC100,11/2026,40
Betadine 10% Ointment,Ointment,Rack G-2,1,95.00,BET020,01/2028,35
Shelcal 500,Tablet,Rack A-3,15,130.00,SHL500,10/2027,120`;

export default function CSVImportPage() {
  const { activeStore } = useStore();
  const [csvContent, setCsvContent] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  // Preview State
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<CSVPreviewResult | null>(null);

  // Commit & Progress State
  const [commitLoading, setCommitLoading] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [completedJob, setCompletedJob] = useState<ImportJob | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setPreviewResult(null);
    setCompletedJob(null);
    setPreviewError(null);
    setCommitError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
      executePreview(text);
    };
    reader.readAsText(file);
  };

  const handleLoadSample = () => {
    setFileName('sample-sanjivani-medicines.csv');
    setCsvContent(SAMPLE_CSV);
    setPreviewResult(null);
    setCompletedJob(null);
    setPreviewError(null);
    setCommitError(null);
    executePreview(SAMPLE_CSV);
  };

  const executePreview = async (textToPreview: string) => {
    if (!activeStore) return;
    setPreviewLoading(true);
    setPreviewError(null);

    try {
      const res = await apiPost<{ success: boolean; preview: CSVPreviewResult }>(
        `/imports/csv/preview`,
        { csvContent: textToPreview },
        activeStore.storeId
      );
      if (res.success) {
        setPreviewResult(res.preview);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setPreviewError(err.message);
      } else {
        setPreviewError('Failed to parse and preview CSV.');
      }
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCommitImport = async () => {
    if (!activeStore || !csvContent) return;

    setCommitLoading(true);
    setCommitError(null);

    try {
      const res = await apiPost<{ success: boolean; job: ImportJob }>(
        `/imports/csv/commit`,
        { csvContent },
        activeStore.storeId
      );
      if (res.success) {
        setCompletedJob(res.job);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setCommitError(err.message);
      } else {
        setCommitError('Import execution failed.');
      }
    } finally {
      setCommitLoading(false);
    }
  };

  const downloadBlankTemplate = () => {
    const blob = new Blob([BLANK_TEMPLATE_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'sanjivani_medicine_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadSampleTemplate = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'sanjivani_medicine_sample_with_data.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadErrorLog = () => {
    if (!previewResult || previewResult.validationErrors.length === 0) return;
    const errorRows = previewResult.validationErrors.map((err) => ({
      Row: err.rowNumber,
      Field: err.field || 'General',
      Message: `"${err.message.replace(/"/g, '""')}"`,
    }));

    const headerLine = 'Row,Field,Error Description\n';
    const csvData =
      headerLine + errorRows.map((e) => `${e.Row},${e.Field},${e.Message}`).join('\n');

    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'import-validation-errors.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <DashboardLayout>
      <Head>
        <title>Dynamic CSV Inventory Import | New Sanjivani Clinic</title>
        <meta name="description" content="Dynamic write-budget CSV bulk import for medicines and batches with pre-ingestion validation." />
      </Head>

      <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #10b981, #06b6d4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
            }}>
              📁
            </div>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Dynamic CSV Inventory Import Engine
              </h1>
              <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>
                Bulk ingest formulations and batches with write-budget chunking (ADR-013), string paise precision, and SHA-256 idempotency.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <Link
              href="/inventory/medicines"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 16px',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#475569',
                textDecoration: 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <span>← Medicine Catalog</span>
            </Link>
            <button
              onClick={handleLoadSample}
              id="load-sample-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                backgroundColor: '#6366f1',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(99, 102, 241, 0.25)',
                transition: 'all 0.15s ease'
              }}
            >
              <span>🧪 Quick Load 10 Samples</span>
            </button>
          </div>
        </div>

        {/* Template Download & Field Guide Card */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '24px 28px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ maxWidth: '640px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '22px' }}>📥</span>
                <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Standard CSV Template for Bulk Medicine Registration
                </h2>
              </div>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '6px 0 0 0', lineHeight: 1.5 }}>
                Download our pre-structured template, feed your medicine formulations & inventory batches accordingly, and upload below for instant bulk registration.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={downloadBlankTemplate}
                id="download-blank-template-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #2563eb',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#2563eb',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>📄 Blank Template</span>
              </button>

              <button
                type="button"
                onClick={downloadSampleTemplate}
                id="download-sample-template-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  backgroundColor: '#2563eb',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#ffffff',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>📋 Sample with Data (10 Rows)</span>
              </button>

              <button
                type="button"
                onClick={() => setShowGuide((prev) => !prev)}
                id="toggle-guide-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 14px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{showGuide ? 'Hide Format Guide ▴' : 'View Format Guide ▾'}</span>
              </button>
            </div>
          </div>

          {/* Collapsible Format Guide */}
          {showGuide && (
            <div style={{
              marginTop: '4px',
              padding: '18px',
              backgroundColor: '#f8fafc',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              overflowX: 'auto',
            }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '10px' }}>
                CSV Columns & Field Reference:
              </div>
              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #cbd5e1', color: '#64748b' }}>
                    <th style={{ padding: '8px 12px' }}>Header Name</th>
                    <th style={{ padding: '8px 12px' }}>Required?</th>
                    <th style={{ padding: '8px 12px' }}>Format / Description</th>
                    <th style={{ padding: '8px 12px' }}>Sample Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>Medicine Name</td>
                    <td style={{ padding: '8px 12px', color: '#dc2626', fontWeight: 700 }}>Mandatory</td>
                    <td style={{ padding: '8px 12px' }}>Brand / trade name of the medicine</td>
                    <td style={{ padding: '8px 12px', color: '#2563eb' }}>Augmentin 625 Duo</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>Form</td>
                    <td style={{ padding: '8px 12px', color: '#64748b' }}>Optional</td>
                    <td style={{ padding: '8px 12px' }}>Tablet, Syrup, Capsule, Ointment, Injection (default: Tablet)</td>
                    <td style={{ padding: '8px 12px', color: '#2563eb' }}>Tablet</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>Rack</td>
                    <td style={{ padding: '8px 12px', color: '#64748b' }}>Optional</td>
                    <td style={{ padding: '8px 12px' }}>Pharmacy shelf / bin location</td>
                    <td style={{ padding: '8px 12px', color: '#2563eb' }}>Rack B-1</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>Units/Strip</td>
                    <td style={{ padding: '8px 12px', color: '#64748b' }}>Optional</td>
                    <td style={{ padding: '8px 12px' }}>Number of units per strip/pack (default: 10)</td>
                    <td style={{ padding: '8px 12px', color: '#2563eb' }}>10</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>MRP/Strip</td>
                    <td style={{ padding: '8px 12px', color: '#d97706', fontWeight: 600 }}>Required if Batch given</td>
                    <td style={{ padding: '8px 12px' }}>Maximum Retail Price per strip in Rupees</td>
                    <td style={{ padding: '8px 12px', color: '#2563eb' }}>205.50</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>Batch #</td>
                    <td style={{ padding: '8px 12px', color: '#64748b' }}>Optional</td>
                    <td style={{ padding: '8px 12px' }}>Batch number for inventory</td>
                    <td style={{ padding: '8px 12px', color: '#2563eb' }}>AUG2024A</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>Expiry</td>
                    <td style={{ padding: '8px 12px', color: '#d97706', fontWeight: 600 }}>Required if Batch given</td>
                    <td style={{ padding: '8px 12px' }}>Accepts MM/YYYY, MM-YYYY, DD/MM/YYYY, YYYY-MM-DD</td>
                    <td style={{ padding: '8px 12px', color: '#2563eb' }}>08/2027</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>Qty</td>
                    <td style={{ padding: '8px 12px', color: '#64748b' }}>Optional</td>
                    <td style={{ padding: '8px 12px' }}>Stock quantity in base units (default: 1)</td>
                    <td style={{ padding: '8px 12px', color: '#2563eb' }}>100</td>
                  </tr>
                </tbody>
              </table>
              <div style={{ marginTop: '12px', padding: '10px 14px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: '12px', color: '#1e40af', fontWeight: 600 }}>
                  Bulk Update Support: If a medicine with the same name already exists, it will be updated instead of creating a duplicate. Existing batches with the same batch number will get stock added.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Upload Card / Dropzone */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '32px',
          border: '2px dashed #cbd5e1',
          textAlign: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          position: 'relative'
        }}>
          <div style={{ fontSize: '44px', marginBottom: '12px' }}>📊</div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
            {fileName ? `Loaded: ${fileName}` : 'Upload your Pharmacy Inventory CSV'}
          </h2>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '6px auto 18px auto', maxWidth: '520px' }}>
            Upload standard pharmacy CSV. Files are automatically analyzed with pre-ingestion validation before database write.
          </p>

          <label
            htmlFor="csv-file-input"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 22px',
              backgroundColor: '#0f172a',
              color: '#ffffff',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.15s ease'
            }}
          >
            <span>Browse CSV File</span>
          </label>
          <input
            id="csv-file-input"
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </div>

        {/* Loading Spinner */}
        {previewLoading && (
          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            padding: '32px',
            textAlign: 'center',
            border: '1px solid #e2e8f0',
            color: '#64748b'
          }}>
            <div style={{ display: 'inline-block', width: 28, height: 28, border: '3px solid #cbd5e1', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
            <div style={{ marginTop: '12px', fontSize: '15px', fontWeight: 600 }}>Analyzing CSV columns & calculating SHA-256 checksum...</div>
          </div>
        )}

        {/* Preview Error */}
        {previewError && (
          <div style={{
            background: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: '10px',
            padding: '16px',
            color: '#b91c1c',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span>⚠️</span> {previewError}
          </div>
        )}

        {/* Commit Error */}
        {commitError && (
          <div style={{
            background: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: '10px',
            padding: '16px',
            color: '#b91c1c',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span>⛔</span> {commitError}
          </div>
        )}

        {/* Completed Job Result Banner */}
        {completedJob && completedJob.status === 'FAILED' ? (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '16px',
            padding: '28px',
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.08)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                backgroundColor: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontSize: '20px',
                fontWeight: 700
              }}>
                ✕
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#991b1b', margin: 0 }}>
                  Bulk Ingestion Failed (Job ID: {completedJob.id})
                </h3>
                <p style={{ fontSize: '14px', color: '#b91c1c', margin: '4px 0 0 0' }}>
                  {completedJob.errorCount} row errors occurred. Zero records were saved to the catalog.
                </p>
              </div>
            </div>

            {completedJob.errors && completedJob.errors.length > 0 && (
              <div style={{ marginTop: '16px', maxHeight: '200px', overflowY: 'auto', background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #fca5a5' }}>
                <div style={{ fontWeight: 600, fontSize: '13px', color: '#991b1b', marginBottom: '6px' }}>Error Details:</div>
                {completedJob.errors.slice(0, 10).map((err, i) => (
                  <div key={i} style={{ fontSize: '12px', color: '#7f1d1d', margin: '3px 0' }}>
                    • Row #{err.rowNumber}: {err.message}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '14px', marginTop: '20px' }}>
              <button
                onClick={() => setCompletedJob(null)}
                style={{
                  padding: '9px 18px',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                ← Back to Upload & Retry
              </button>
            </div>
          </div>
        ) : completedJob ? (
          <div style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '16px',
            padding: '28px',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.08)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                backgroundColor: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontSize: '20px',
                fontWeight: 700
              }}>
                ✓
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#14532d', margin: 0 }}>
                  Bulk Ingestion Successfully Executed! (Job ID: {completedJob.id})
                </h3>
                <p style={{ fontSize: '14px', color: '#166534', margin: '4px 0 0 0' }}>
                  Processed {completedJob.processedRows} rows — {completedJob.createdCount || 0} new medicines created, {completedJob.updatedCount || 0} existing medicines updated.
                  {completedJob.errorCount > 0 && ` (${completedJob.errorCount} errors)`}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '14px', marginTop: '20px' }}>
              <Link
                href="/inventory/medicines"
                style={{
                  padding: '9px 18px',
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  textDecoration: 'none'
                }}
              >
                View in Medicine Catalog →
              </Link>
              <Link
                href="/inventory/batches"
                style={{
                  padding: '9px 18px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #bbf7d0',
                  color: '#15803d',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  textDecoration: 'none'
                }}
              >
                View in Batch Inventory →
              </Link>
            </div>
          </div>
        ) : null}

        {/* Pre-Ingestion Data Grid Preview */}
        {previewResult && !completedJob && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Stat Summary Row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px'
            }}>
              <div style={{
                background: '#ffffff',
                borderRadius: '12px',
                padding: '16px 20px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Total Rows Detected</div>
                <div style={{ fontSize: '26px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                  {previewResult.totalRows}
                </div>
              </div>

              <div style={{
                background: '#ffffff',
                borderRadius: '12px',
                padding: '16px 20px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Valid Formulations</div>
                <div style={{ fontSize: '26px', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>
                  {previewResult.validRowsCount}
                </div>
                <div style={{ fontSize: '12px', color: '#10b981', marginTop: '2px', fontWeight: 500 }}>Ready to commit</div>
              </div>

              <div style={{
                background: '#ffffff',
                borderRadius: '12px',
                padding: '16px 20px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>New Medicines</div>
                <div style={{ fontSize: '26px', fontWeight: 700, color: '#2563eb', marginTop: '4px' }}>
                  {previewResult.createdCount || 0}
                </div>
                <div style={{ fontSize: '12px', color: '#2563eb', marginTop: '2px', fontWeight: 500 }}>Will be created</div>
              </div>

              <div style={{
                background: '#ffffff',
                borderRadius: '12px',
                padding: '16px 20px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Existing Updates</div>
                <div style={{ fontSize: '26px', fontWeight: 700, color: '#f59e0b', marginTop: '4px' }}>
                  {previewResult.updatedCount || 0}
                </div>
                <div style={{ fontSize: '12px', color: '#f59e0b', marginTop: '2px', fontWeight: 500 }}>Will be updated</div>
              </div>

              <div style={{
                background: '#ffffff',
                borderRadius: '12px',
                padding: '16px 20px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Errors</div>
                <div style={{ fontSize: '26px', fontWeight: 700, color: previewResult.errorRowsCount > 0 ? '#ef4444' : '#64748b', marginTop: '4px' }}>
                  {previewResult.errorRowsCount}
                </div>
                <div style={{ fontSize: '12px', color: previewResult.errorRowsCount > 0 ? '#ef4444' : '#64748b', marginTop: '2px', fontWeight: 500 }}>
                  {previewResult.errorRowsCount > 0 ? 'Action required' : 'Zero errors'}
                </div>
              </div>
            </div>

            {/* Validation Errors Box if any */}
            {previewResult.validationErrors.length > 0 && (
              <div style={{
                background: '#fff1f2',
                borderRadius: '12px',
                padding: '20px',
                border: '1px solid #fecdd3'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#9f1239', margin: 0 }}>
                    ⚠️ {previewResult.validationErrors.length} Row(s) Contain Schema Errors
                  </h3>
                  <button
                    onClick={downloadErrorLog}
                    style={{
                      padding: '6px 14px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #fda4af',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#be123c',
                      cursor: 'pointer'
                    }}
                  >
                    Download Error CSV
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '14px' }}>
                  {previewResult.validationErrors.slice(0, 5).map((err, idx) => (
                    <div key={idx} style={{ fontSize: '13px', color: '#881337' }}>
                      • <strong>Row {err.rowNumber}</strong>: {err.message} (Field: {err.field || 'general'})
                    </div>
                  ))}
                  {previewResult.validationErrors.length > 5 && (
                    <div style={{ fontSize: '12px', color: '#9f1239', fontStyle: 'italic', marginTop: '4px' }}>
                      + {previewResult.validationErrors.length - 5} more error rows. Download the Error CSV log to inspect all rows.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Preview Table */}
            <div style={{
              background: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#f8fafc'
              }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    Data Grid Preview (Sample First {previewResult.samplePreview.length} Rows)
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>
                    Inspect parsed values before executing chunked ingestion.
                  </p>
                </div>

                <button
                  onClick={handleCommitImport}
                  disabled={commitLoading || previewResult.validRowsCount === 0}
                  id="commit-import-btn"
                  style={{
                    padding: '10px 24px',
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: commitLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
                    opacity: commitLoading ? 0.7 : 1
                  }}
                >
                  {commitLoading ? 'Ingesting Chunks...' : `Commit Ingest (${previewResult.validRowsCount} Rows)`}
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '880px' }}>
                  <thead>
                    <tr style={{
                      backgroundColor: '#f8fafc',
                      borderBottom: '1px solid #e2e8f0',
                      color: '#475569',
                      fontSize: '12px',
                      fontWeight: 700,
                      textTransform: 'uppercase'
                    }}>
                      <th style={{ padding: '12px 16px' }}>Row</th>
                      <th style={{ padding: '12px 16px' }}>Action</th>
                      <th style={{ padding: '12px 16px' }}>Medicine Name</th>
                      <th style={{ padding: '12px 16px' }}>Form</th>
                      <th style={{ padding: '12px 16px' }}>Rack</th>
                      <th style={{ padding: '12px 16px' }}>Units/Strip</th>
                      <th style={{ padding: '12px 16px' }}>MRP/Strip</th>
                      <th style={{ padding: '12px 16px' }}>Batch #</th>
                      <th style={{ padding: '12px 16px' }}>Expiry</th>
                      <th style={{ padding: '12px 16px' }}>Qty</th>
                    </tr>
                  </thead>
                  <tbody style={{ fontSize: '13px', color: '#1e293b' }}>
                    {previewResult.samplePreview.map((item, idx) => (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: idx === previewResult.samplePreview.length - 1 ? 'none' : '1px solid #f1f5f9'
                        }}
                      >
                        <td style={{ padding: '12px 16px', color: '#64748b' }}>#{item.rowNumber as number}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: (item.action as string) === 'UPDATE' ? '#fef3c7' : '#dbeafe',
                            color: (item.action as string) === 'UPDATE' ? '#92400e' : '#1e40af',
                          }}>
                            {(item.action as string) === 'UPDATE' ? 'UPDATE' : 'NEW'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>
                          {item.brandName as string}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#475569' }}>{item.dosageForm as string}</td>
                        <td style={{ padding: '12px 16px', color: '#475569' }}>{(item.rackLocation as string) || '—'}</td>
                        <td style={{ padding: '12px 16px', color: '#0f172a', fontWeight: 600 }}>{item.stripSize as number}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                          {item.mrp ? `₹${item.mrp}` : '—'}
                        </td>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{(item.batchNumber as string) || '—'}</td>
                        <td style={{ padding: '12px 16px' }}>{(item.expiryDate as string) || '—'}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{item.qty as string}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
