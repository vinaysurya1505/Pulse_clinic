'use client';

import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { useStore } from '@/context/StoreContext';
import { apiPost, ApiError } from '@/lib/api';
import { CSVPreviewResult, ImportJob } from '@pulseclinic/types';

const SAMPLE_CSV = `Brand Name,Generic Name,Category,Dosage Form,Strength,Pack Size,Allow Loose Sales,Drug Schedule,GST %,HSN,Rack Location,Batch Number,Expiry Date,MRP,Cost Price,Initial Stock
Augmentin 625 Duo,Amoxicillin + Clavulanic Acid,Antibiotics & Anti-infectives,Tablet,625mg,10,TRUE,H1,12,3004,Rack B-1,AUG2024A,2027-08-31,205.50,145.00,100
Dolo 650,Paracetamol,Analgesics & Antipyretics,Tablet,650mg,15,TRUE,NONE,12,3004,Rack A-1,DOL2401,2027-11-30,32.00,22.50,200
Azithral 500,Azithromycin,Antibiotics & Anti-infectives,Tablet,500mg,5,FALSE,H,12,3004,Rack B-2,AZI5001,2026-12-31,120.00,85.00,50
Pan 40,Pantoprazole,Gastrointestinal,Tablet,40mg,15,TRUE,H,12,3004,Rack C-1,PAN409,2027-06-30,155.00,105.00,80
Montek LC,Montelukast + Levocetirizine,Respiratory & Anti-allergic,Tablet,10mg/5mg,10,TRUE,H,12,3004,Rack D-3,MLC881,2027-04-30,195.00,135.00,60
Telma 40,Telmisartan,Cardiovascular & Antihypertensive,Tablet,40mg,15,TRUE,H,12,3004,Rack E-2,TEL400,2027-09-30,140.00,98.00,90
Glycomet 500 SR,Metformin Hydrochloride,Antidiabetic,Tablet,500mg,20,TRUE,H,12,3004,Rack F-1,GLY501,2027-05-31,48.00,32.00,150
Ascoril LS Syrup,Ambroxol + Levosalbutamol,Respiratory & Anti-allergic,Syrup,100ml,1,FALSE,H,12,3004,Rack D-1,ASC100,2026-11-30,118.00,82.00,40
Betadine 10% Ointment,Povidone Iodine,Dermatological,Ointment,20gm,1,FALSE,NONE,12,3004,Rack G-2,BET020,2028-01-31,95.00,65.00,35
Shelcal 500,Calcium + Vitamin D3,Vitamins & Supplements,Tablet,500mg,15,TRUE,NONE,12,3004,Rack A-3,SHL500,2027-10-31,130.00,90.00,120`;

export default function CSVImportPage() {
  const { activeStore } = useStore();
  const [csvContent, setCsvContent] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);

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
    setFileName('sample-pulseclinic-medicines.csv');
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

  const downloadSampleTemplate = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'pulseclinic-medicines-template.csv');
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
        <title>Dynamic CSV Inventory Import | PulseClinic</title>
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

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={downloadSampleTemplate}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#334155',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <span>📥 Download CSV Template</span>
            </button>
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
              <span>🧪 Load 10 Sample Medicines</span>
            </button>
          </div>
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

        {/* Completed Job Success Banner */}
        {completedJob && (
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
                  Processed {completedJob.processedRows} rows in chunks of 25. Created {completedJob.successCount} formulary records with zero transaction failures.
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
        )}

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
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Schema Errors</div>
                <div style={{ fontSize: '26px', fontWeight: 700, color: previewResult.errorRowsCount > 0 ? '#ef4444' : '#64748b', marginTop: '4px' }}>
                  {previewResult.errorRowsCount}
                </div>
                <div style={{ fontSize: '12px', color: previewResult.errorRowsCount > 0 ? '#ef4444' : '#64748b', marginTop: '2px', fontWeight: 500 }}>
                  {previewResult.errorRowsCount > 0 ? 'Action required' : 'Zero errors'}
                </div>
              </div>

              <div style={{
                background: '#ffffff',
                borderRadius: '12px',
                padding: '16px 20px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>SHA-256 Checksum</div>
                <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#475569', marginTop: '8px', wordBreak: 'break-all' }}>
                  {previewResult.fileHash.slice(0, 16)}...
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Idempotency verified</div>
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
                      <th style={{ padding: '12px 16px' }}>Brand Formulation</th>
                      <th style={{ padding: '12px 16px' }}>Generic Molecule</th>
                      <th style={{ padding: '12px 16px' }}>Category</th>
                      <th style={{ padding: '12px 16px' }}>Pack Size</th>
                      <th style={{ padding: '12px 16px' }}>Batch #</th>
                      <th style={{ padding: '12px 16px' }}>Expiry</th>
                      <th style={{ padding: '12px 16px' }}>MRP</th>
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
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>
                          {item.brandName as string} <span style={{ color: '#64748b', fontWeight: 400 }}>({item.strength as string})</span>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#475569' }}>{item.genericName as string}</td>
                        <td style={{ padding: '12px 16px', color: '#475569' }}>{item.category as string}</td>
                        <td style={{ padding: '12px 16px', color: '#0f172a', fontWeight: 600 }}>{item.stripSize as number} units</td>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{(item.batchNumber as string) || '—'}</td>
                        <td style={{ padding: '12px 16px' }}>{(item.expiryDate as string) || '—'}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                          {item.mrp ? `₹${item.mrp}` : '—'}
                        </td>
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
