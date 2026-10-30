'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { useStore } from '@/context/StoreContext';
import { apiGet, apiPost, ApiError } from '@/lib/api';
import {
  BatchInventory,
  MedicineMaster,
  StockLedgerEntry,
  getBatchExpiryStatus,
  ExpiryAlertTier,
} from '@pulseclinic/types';

interface BatchListResponse {
  success: boolean;
  batches: BatchInventory[];
  nextCursor?: string;
}

interface MedicineListResponse {
  success: boolean;
  medicines: MedicineMaster[];
}

interface LedgerResponse {
  success: boolean;
  entries: StockLedgerEntry[];
}

export default function BatchesPage() {
  const { activeStore } = useStore();
  const [batches, setBatches] = useState<BatchInventory[]>([]);
  const [medicines, setMedicines] = useState<MedicineMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [expiryFilter, setExpiryFilter] = useState<'ALL' | 'VALID' | 'NEAR_EXPIRY' | 'EXPIRED'>('ALL');
  const [medicineFilter, setMedicineFilter] = useState<string>('ALL');

  // Add Batch Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({
    medicineId: '',
    batchNumber: '',
    expiryDate: '',
    mrpRupees: '',
    costPriceRupees: '',
    initialStockUnits: 50,
    supplierName: '',
    rackLocation: '',
  });

  // Adjust Stock Modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustingBatch, setAdjustingBatch] = useState<BatchInventory | null>(null);
  const [adjustUnits, setAdjustUnits] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustType, setAdjustType] = useState<'ADJUSTMENT_ADD' | 'ADJUSTMENT_SUBTRACT' | 'DAMAGE' | 'EXPIRED'>('ADJUSTMENT_ADD');
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // Ledger History Modal
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [ledgerEntries, setLedgerEntries] = useState<StockLedgerEntry[]>([]);
  const [ledgerBatchTitle, setLedgerBatchTitle] = useState('');
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Expiry Report Email Trigger State
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  const handleSendExpiryEmailReport = async () => {
    if (!activeStore) return;
    setSendingEmail(true);
    setEmailStatus(null);
    try {
      const res = await apiPost<{ success: boolean; message: string }>(
        `/jobs/cron/expiry-alert?storeId=${activeStore.storeId}&force=true`,
        {},
        activeStore.storeId
      );
      if (res.success) {
        setEmailStatus(res.message || 'Expiry alert email dispatched to store owner successfully!');
        setTimeout(() => setEmailStatus(null), 6000);
      }
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Failed to send expiry email.';
      setEmailStatus(msg);
      setTimeout(() => setEmailStatus(null), 6000);
    } finally {
      setSendingEmail(false);
    }
  };

  const fetchBatches = async () => {
    if (!activeStore) return;
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      queryParams.set('limit', '100');
      if (expiryFilter !== 'ALL') queryParams.set('expiryStatus', expiryFilter);
      if (medicineFilter !== 'ALL') queryParams.set('medicineId', medicineFilter);

      const res = await apiGet<BatchListResponse>(
        `/inventory/batches?${queryParams.toString()}`,
        activeStore.storeId
      );
      if (res.success) {
        setBatches(res.batches || []);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load batch inventory.');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchMedicines = async () => {
    if (!activeStore) return;
    try {
      const res = await apiGet<MedicineListResponse>(`/inventory/medicines?limit=100`, activeStore.storeId);
      if (res.success) {
        setMedicines(res.medicines || []);
        if (res.medicines.length > 0 && !addForm.medicineId) {
          setAddForm((prev) => ({ ...prev, medicineId: res.medicines[0].id }));
        }
      }
    } catch {
      // Non-fatal fallback
    }
  };

  useEffect(() => {
    fetchBatches();
    fetchMedicines();
  }, [activeStore?.storeId, expiryFilter, medicineFilter]);

  // Client-side search filtering
  const filteredBatches = useMemo(() => {
    if (!searchTerm.trim()) return batches;
    const q = searchTerm.toLowerCase().trim();
    return batches.filter(
      (b) =>
        b.batchNumber?.toLowerCase().includes(q) ||
        b.medicineBrandName?.toLowerCase().includes(q) ||
        b.medicineGenericName?.toLowerCase().includes(q) ||
        b.supplierName?.toLowerCase().includes(q) ||
        b.rackLocation?.toLowerCase().includes(q)
    );
  }, [batches, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    const totalBatches = batches.length;
    let totalUnits = 0;
    let nearExpiryCount = 0;
    let expiredCount = 0;

    const now = new Date();
    batches.forEach((b) => {
      totalUnits += b.stockUnits || 0;
      const tier = getBatchExpiryStatus(b.expiryDate, now);
      if (tier === 'EXPIRED') expiredCount++;
      else if (tier === 'CRITICAL_30' || tier === 'WARNING_60' || tier === 'ATTENTION_90') nearExpiryCount++;
    });

    return { totalBatches, totalUnits, nearExpiryCount, expiredCount };
  }, [batches]);

  const handleOpenAddModal = () => {
    const defaultMedId = medicines[0]?.id || '';
    // Default expiry 1 year in future
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const expStr = nextYear.toISOString().slice(0, 10);

    setAddForm({
      medicineId: defaultMedId,
      batchNumber: '',
      expiryDate: expStr,
      mrpRupees: '',
      costPriceRupees: '',
      initialStockUnits: 50,
      supplierName: '',
      rackLocation: '',
    });
    setAddError(null);
    setIsAddModalOpen(true);
  };

  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore) return;

    if (!addForm.medicineId) {
      setAddError('Please select a formulation from the catalog.');
      return;
    }
    if (!addForm.batchNumber.trim()) {
      setAddError('Batch number is required.');
      return;
    }
    if (!addForm.expiryDate) {
      setAddError('Expiry date is required.');
      return;
    }

    const mrpPaise = Math.round(parseFloat(addForm.mrpRupees || '0') * 100);
    const costPricePaise = Math.round(parseFloat(addForm.costPriceRupees || '0') * 100);

    if (mrpPaise <= 0) {
      setAddError('MRP must be greater than ₹0.00');
      return;
    }

    setAddLoading(true);
    setAddError(null);

    try {
      const res = await apiPost<{ success: boolean; batch: BatchInventory }>(
        `/inventory/batches`,
        {
          medicineId: addForm.medicineId,
          batchNumber: addForm.batchNumber.trim().toUpperCase(),
          expiryDate: addForm.expiryDate,
          mrpPaise,
          costPricePaise,
          initialStockUnits: addForm.initialStockUnits,
          supplierName: addForm.supplierName || undefined,
          rackLocation: addForm.rackLocation || undefined,
        },
        activeStore.storeId
      );

      if (res.success) {
        setBatches((prev) => [res.batch, ...prev]);
        setIsAddModalOpen(false);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setAddError(err.message);
      } else {
        setAddError('Failed to create inventory batch.');
      }
    } finally {
      setAddLoading(false);
    }
  };

  const handleOpenAdjustModal = (batch: BatchInventory) => {
    setAdjustingBatch(batch);
    setAdjustUnits(0);
    setAdjustReason('');
    setAdjustType('ADJUSTMENT_ADD');
    setAdjustError(null);
    setIsAdjustModalOpen(true);
  };

  const handleExecuteAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore || !adjustingBatch) return;

    if (adjustUnits === 0) {
      setAdjustError('Adjustment units cannot be zero.');
      return;
    }
    if (!adjustReason.trim()) {
      setAdjustError('A reason is mandatory for the immutable audit ledger (ADR-012).');
      return;
    }

    const newBalance = adjustingBatch.stockUnits + adjustUnits;
    if (newBalance < 0) {
      setAdjustError(`Cannot deduct ${Math.abs(adjustUnits)} units. Current stock is only ${adjustingBatch.stockUnits} units.`);
      return;
    }

    setAdjustLoading(true);
    setAdjustError(null);

    try {
      const res = await apiPost<{ success: boolean; batch: BatchInventory }>(
        `/inventory/batches/adjust`,
        {
          batchId: adjustingBatch.id,
          adjustmentUnits: adjustUnits,
          reason: adjustReason.trim(),
          movementType: adjustType,
        },
        activeStore.storeId
      );

      if (res.success) {
        setBatches((prev) => prev.map((b) => (b.id === adjustingBatch.id ? res.batch : b)));
        setIsAdjustModalOpen(false);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setAdjustError(err.message);
      } else {
        setAdjustError('Failed to execute stock adjustment.');
      }
    } finally {
      setAdjustLoading(false);
    }
  };

  const handleViewLedger = async (batch: BatchInventory) => {
    if (!activeStore) return;
    setLedgerBatchTitle(`${batch.medicineBrandName || 'Medicine'} (Batch ${batch.batchNumber})`);
    setLedgerLoading(true);
    setIsLedgerModalOpen(true);

    try {
      const res = await apiGet<LedgerResponse>(
        `/inventory/batches/ledger?batchId=${batch.id}&limit=50`,
        activeStore.storeId
      );
      if (res.success) {
        setLedgerEntries(res.entries || []);
      }
    } catch {
      setLedgerEntries([]);
    } finally {
      setLedgerLoading(false);
    }
  };

  const formatPaiseToINR = (paise: number) => {
    return `₹${(paise / 100).toFixed(2)}`;
  };

  const renderExpiryBadge = (expiryDateStr: string) => {
    const tier: ExpiryAlertTier = getBatchExpiryStatus(expiryDateStr);
    switch (tier) {
      case 'EXPIRED':
        return (
          <span style={{
            padding: '3px 10px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: 700,
            backgroundColor: '#fee2e2',
            color: '#b91c1c',
            border: '1px solid #fecaca'
          }}>
            ⛔ Expired (Quarantined)
          </span>
        );
      case 'CRITICAL_30':
        return (
          <span style={{
            padding: '3px 10px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: 700,
            backgroundColor: '#ffedd5',
            color: '#c2410c',
            border: '1px solid #fed7aa'
          }}>
            ⚡ &lt;30 Days Critical
          </span>
        );
      case 'WARNING_60':
        return (
          <span style={{
            padding: '3px 10px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: 600,
            backgroundColor: '#fef3c7',
            color: '#b45309',
            border: '1px solid #fde68a'
          }}>
            ⚠️ &lt;60 Days
          </span>
        );
      case 'ATTENTION_90':
        return (
          <span style={{
            padding: '3px 10px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: 600,
            backgroundColor: '#fef9c3',
            color: '#a16207',
            border: '1px solid #fef08a'
          }}>
            ⏰ &lt;90 Days
          </span>
        );
      default:
        return (
          <span style={{
            padding: '3px 10px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: 600,
            backgroundColor: '#f0fdf4',
            color: '#15803d',
            border: '1px solid #bbf7d0'
          }}>
            ✓ Valid FEFO Stock
          </span>
        );
    }
  };

  return (
    <DashboardLayout>
      <Head>
        <title>Batch Inventory & FEFO Engine | New Sanjivani Clinic</title>
        <meta name="description" content="FEFO batch tracking, expiry monitoring, and immutable stock movement ledger." />
      </Head>

      <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(6, 182, 212, 0.2)'
            }}>
              📦
            </div>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Batch Inventory & FEFO Engine
              </h1>
              <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>
                First-Expiry-First-Out automated queue (ADR-011), quarantine controls, and append-only stock movement ledger (ADR-012).
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleSendExpiryEmailReport}
              disabled={sendingEmail}
              id="send-expiry-email-btn"
              title="Dispatches urgent near-expiry list (≤ 30 days) to store owner email"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                backgroundColor: '#ffffff',
                color: '#0f172a',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: sendingEmail ? 'not-allowed' : 'pointer',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{sendingEmail ? '⏳ Dispatching...' : '✉️ Send Expiry Email (≤30d)'}</span>
            </button>
            <button
              onClick={handleOpenAddModal}
              id="add-batch-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                backgroundColor: '#06b6d4',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(6, 182, 212, 0.25)',
                transition: 'all 0.15s ease'
              }}
            >
              <span>+ Add Batch</span>
            </button>
          </div>
        </div>

        {emailStatus && (
          <div
            style={{
              padding: '12px 18px',
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              color: '#15803d',
              fontSize: '14px',
              fontWeight: 600,
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>📧 {emailStatus}</span>
            <button
              onClick={() => setEmailStatus(null)}
              style={{ background: 'none', border: 'none', color: '#15803d', cursor: 'pointer', fontSize: '16px' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Metric Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            padding: '16px 20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Active Batches</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>{stats.totalBatches}</div>
            <div style={{ fontSize: '12px', color: '#06b6d4', marginTop: '4px', fontWeight: 500 }}>Tracked in store</div>
          </div>

          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            padding: '16px 20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Total Stock In Hand</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>{stats.totalUnits.toLocaleString()}</div>
            <div style={{ fontSize: '12px', color: '#10b981', marginTop: '4px', fontWeight: 500 }}>Smallest base units</div>
          </div>

          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            padding: '16px 20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Near-Expiry Alerts</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: stats.nearExpiryCount > 0 ? '#f59e0b' : '#0f172a', marginTop: '6px' }}>
              {stats.nearExpiryCount}
            </div>
            <div style={{ fontSize: '12px', color: '#f59e0b', marginTop: '4px', fontWeight: 500 }}>Expiring within 90 days</div>
          </div>

          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            padding: '16px 20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Expired Stock (Quarantined)</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: stats.expiredCount > 0 ? '#ef4444' : '#0f172a', marginTop: '6px' }}>
              {stats.expiredCount}
            </div>
            <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px', fontWeight: 500 }}>Blocked from cashier billing</div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          padding: '16px 20px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
            {/* Search Input */}
            <div style={{ flex: '1 1 280px', position: 'relative' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '15px' }}>
                🔍
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by Batch #, Formulation, Rack, or Supplier..."
                id="batch-search-input"
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  color: '#0f172a',
                  backgroundColor: '#ffffff',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Medicine Filter Dropdown */}
            <div style={{ flex: '0 0 auto', minWidth: '240px' }}>
              <select
                value={medicineFilter}
                onChange={(e) => setMedicineFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  color: '#0f172a',
                  backgroundColor: '#ffffff',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="ALL">All Formulations</option>
                {medicines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.brandName} ({m.strength})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Expiry Tier Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', marginRight: '4px' }}>
              FEFO Expiry Tier:
            </span>
            {[
              { id: 'ALL', label: 'All Batches' },
              { id: 'VALID', label: 'Valid Stock (>90 Days)' },
              { id: 'NEAR_EXPIRY', label: 'Near Expiry (Within 90 Days)' },
              { id: 'EXPIRED', label: 'Expired (Locked)' },
            ].map((pill) => {
              const active = expiryFilter === pill.id;
              return (
                <button
                  key={pill.id}
                  onClick={() => setExpiryFilter(pill.id as any)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '9999px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: active ? '1px solid #06b6d4' : '1px solid #e2e8f0',
                    backgroundColor: active ? 'rgba(6, 182, 212, 0.1)' : '#f8fafc',
                    color: active ? '#0891b2' : '#64748b',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Error notification */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '8px',
            padding: '12px 16px',
            color: '#b91c1c',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Batches Table */}
        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '960px' }}>
              <thead>
                <tr style={{
                  backgroundColor: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  color: '#475569',
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  <th style={{ padding: '14px 20px' }}>Formulation / Brand</th>
                  <th style={{ padding: '14px 16px' }}>Batch # & Location</th>
                  <th style={{ padding: '14px 16px' }}>Expiry & FEFO Status</th>
                  <th style={{ padding: '14px 16px' }}>Pricing (MRP / Cost)</th>
                  <th style={{ padding: '14px 16px' }}>Stock In Hand</th>
                  <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody style={{ fontSize: '14px', color: '#1e293b' }}>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '48px 20px', textAlign: 'center', color: '#64748b' }}>
                      <div style={{ display: 'inline-block', width: 24, height: 24, border: '3px solid #cbd5e1', borderTopColor: '#06b6d4', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                      <div style={{ marginTop: '10px', fontSize: '14px' }}>Loading batch inventory...</div>
                    </td>
                  </tr>
                ) : filteredBatches.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '48px 20px', textAlign: 'center' }}>
                      <div style={{ fontSize: '40px' }}>📦</div>
                      <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '8px', fontSize: '16px' }}>
                        No inventory batches found
                      </div>
                      <div style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>
                        Add your first pharmaceutical batch with MRP and expiry to start dispensing.
                      </div>
                      <button
                        onClick={handleOpenAddModal}
                        style={{
                          marginTop: '16px',
                          padding: '8px 18px',
                          backgroundColor: '#06b6d4',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        + Add First Batch
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredBatches.map((b, index) => (
                    <tr
                      key={b.id}
                      style={{
                        borderBottom: index === filteredBatches.length - 1 ? 'none' : '1px solid #f1f5f9',
                        transition: 'background-color 0.15s ease',
                        backgroundColor: '#ffffff'
                      }}
                    >
                      {/* Medicine Details */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '15px' }}>
                          {b.medicineBrandName || 'Formulation'}
                        </div>
                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                          {b.medicineGenericName} {b.strength && `• ${b.strength}`}
                        </div>
                      </td>

                      {/* Batch & Location */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{
                          display: 'inline-block',
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          fontSize: '13px',
                          color: '#0f172a',
                          backgroundColor: '#f1f5f9',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          border: '1px solid #e2e8f0'
                        }}>
                          {b.batchNumber}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                          {b.rackLocation ? `📍 ${b.rackLocation}` : 'No rack'}
                          {b.supplierName && ` • ${b.supplierName}`}
                        </div>
                      </td>

                      {/* Expiry & Status */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>
                          📅 {b.expiryDate}
                        </div>
                        {renderExpiryBadge(b.expiryDate)}
                      </td>

                      {/* Pricing */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                          MRP: {formatPaiseToINR(b.mrpPaise)}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                          Cost: {formatPaiseToINR(b.costPricePaise)}
                        </div>
                      </td>

                      {/* Stock in Hand */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{
                          fontSize: '16px',
                          fontWeight: 700,
                          color: b.stockUnits <= 10 ? '#ef4444' : '#0f172a'
                        }}>
                          {b.stockUnits} units
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          {b.status}
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            onClick={() => handleOpenAdjustModal(b)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              fontSize: '13px',
                              fontWeight: 600,
                              color: '#0891b2',
                              cursor: 'pointer'
                            }}
                          >
                            Adjust
                          </button>
                          <button
                            onClick={() => handleViewLedger(b)}
                            style={{
                              padding: '6px 10px',
                              backgroundColor: '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              fontSize: '13px',
                              fontWeight: 500,
                              color: '#475569',
                              cursor: 'pointer'
                            }}
                          >
                            Ledger
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal 1: Add Batch */}
        {isAddModalOpen && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}>
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '620px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#f8fafc',
                borderTopLeftRadius: '16px',
                borderTopRightRadius: '16px'
              }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    Register Inventory Batch
                  </h2>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
                    Record manufacturing batch, MRP in integer paise, and initial stock balance.
                  </p>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  style={{ background: 'none', border: 'none', fontSize: '20px', color: '#94a3b8', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveBatch} style={{ padding: '24px' }}>
                {addError && (
                  <div style={{
                    marginBottom: '20px',
                    backgroundColor: '#fee2e2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    padding: '12px',
                    color: '#b91c1c',
                    fontSize: '13px'
                  }}>
                    {addError}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      Select Formulation / Medicine *
                    </label>
                    <select
                      required
                      value={addForm.medicineId}
                      onChange={(e) => setAddForm({ ...addForm, medicineId: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                        color: '#0f172a',
                        backgroundColor: '#ffffff'
                      }}
                    >
                      {medicines.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.brandName} ({m.genericName}) - {m.strength}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        Batch Number *
                      </label>
                      <input
                        type="text"
                        required
                        value={addForm.batchNumber}
                        onChange={(e) => setAddForm({ ...addForm, batchNumber: e.target.value.toUpperCase() })}
                        placeholder="e.g. B240801"
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '14px',
                          fontFamily: 'monospace',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        Expiry Date * (YYYY-MM-DD)
                      </label>
                      <input
                        type="date"
                        required
                        value={addForm.expiryDate}
                        onChange={(e) => setAddForm({ ...addForm, expiryDate: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '14px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        MRP (₹) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        value={addForm.mrpRupees}
                        onChange={(e) => setAddForm({ ...addForm, mrpRupees: e.target.value })}
                        placeholder="e.g. 150.00"
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '14px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        Cost Price (₹)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={addForm.costPriceRupees}
                        onChange={(e) => setAddForm({ ...addForm, costPriceRupees: e.target.value })}
                        placeholder="e.g. 105.00"
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '14px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        Initial Stock Units *
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={addForm.initialStockUnits}
                        onChange={(e) => setAddForm({ ...addForm, initialStockUnits: parseInt(e.target.value, 10) || 0 })}
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '14px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        Rack / Shelf Location
                      </label>
                      <input
                        type="text"
                        value={addForm.rackLocation}
                        onChange={(e) => setAddForm({ ...addForm, rackLocation: e.target.value })}
                        placeholder="e.g. Rack A-2"
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '14px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        Supplier / Distributor
                      </label>
                      <input
                        type="text"
                        value={addForm.supplierName}
                        onChange={(e) => setAddForm({ ...addForm, supplierName: e.target.value })}
                        placeholder="e.g. Apollo Pharma Distributors"
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '14px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{
                  marginTop: '28px',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  borderTop: '1px solid #e2e8f0',
                  paddingTop: '16px'
                }}>
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    style={{
                      padding: '10px 18px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addLoading}
                    id="submit-batch-btn"
                    style={{
                      padding: '10px 24px',
                      backgroundColor: '#06b6d4',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: addLoading ? 'not-allowed' : 'pointer',
                      opacity: addLoading ? 0.7 : 1,
                      boxShadow: '0 2px 8px rgba(6, 182, 212, 0.25)'
                    }}
                  >
                    {addLoading ? 'Registering...' : 'Register Batch'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 2: Adjust Stock */}
        {isAdjustModalOpen && adjustingBatch && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}>
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '520px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#f8fafc',
                borderTopLeftRadius: '16px',
                borderTopRightRadius: '16px'
              }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    Adjust Batch Stock
                  </h2>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
                    {adjustingBatch.medicineBrandName} (Batch {adjustingBatch.batchNumber})
                  </p>
                </div>
                <button
                  onClick={() => setIsAdjustModalOpen(false)}
                  style={{ background: 'none', border: 'none', fontSize: '20px', color: '#94a3b8', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleExecuteAdjustment} style={{ padding: '24px' }}>
                {adjustError && (
                  <div style={{
                    marginBottom: '16px',
                    backgroundColor: '#fee2e2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    padding: '12px',
                    color: '#b91c1c',
                    fontSize: '13px'
                  }}>
                    {adjustError}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Current Balance card */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    backgroundColor: '#f1f5f9',
                    border: '1px solid #e2e8f0'
                  }}>
                    <div>
                      <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Current Units</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>{adjustingBatch.stockUnits}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>New Balance After</div>
                      <div style={{
                        fontSize: '20px',
                        fontWeight: 700,
                        color: adjustingBatch.stockUnits + adjustUnits < 0 ? '#ef4444' : '#10b981'
                      }}>
                        {adjustingBatch.stockUnits + adjustUnits}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      Adjustment Reason Type *
                    </label>
                    <select
                      value={adjustType}
                      onChange={(e) => setAdjustType(e.target.value as any)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                        color: '#0f172a',
                        backgroundColor: '#ffffff'
                      }}
                    >
                      <option value="ADJUSTMENT_ADD">Stock Recount / Audit Addition (+)</option>
                      <option value="ADJUSTMENT_SUBTRACT">Stock Recount / Shortage (-)</option>
                      <option value="DAMAGE">Broken / Damaged Packaging (-)</option>
                      <option value="EXPIRED">Quarantined / Expired Return (-)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      Unit Delta (+/-) *
                    </label>
                    <input
                      type="number"
                      required
                      value={adjustUnits}
                      onChange={(e) => setAdjustUnits(parseInt(e.target.value, 10) || 0)}
                      placeholder="e.g. +10 or -5"
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '16px',
                        fontWeight: 700,
                        color: '#0f172a',
                        boxSizing: 'border-box'
                      }}
                    />
                    <span style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                      Positive number to add units, negative number to deduct units.
                    </span>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      Audit Reason * (Mandatory for Compliance)
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                      placeholder="e.g. Physical inventory reconciliation verified by pharmacist on duty."
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                        color: '#0f172a',
                        boxSizing: 'border-box',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                </div>

                <div style={{
                  marginTop: '24px',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  borderTop: '1px solid #e2e8f0',
                  paddingTop: '16px'
                }}>
                  <button
                    type="button"
                    onClick={() => setIsAdjustModalOpen(false)}
                    style={{
                      padding: '10px 18px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={adjustLoading}
                    style={{
                      padding: '10px 24px',
                      backgroundColor: '#0f172a',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: adjustLoading ? 'not-allowed' : 'pointer',
                      opacity: adjustLoading ? 0.7 : 1
                    }}
                  >
                    {adjustLoading ? 'Logging...' : 'Post Adjustment to Ledger'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 3: Immutable Stock Ledger Drawer */}
        {isLedgerModalOpen && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}>
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '780px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#f8fafc',
                borderTopLeftRadius: '16px',
                borderTopRightRadius: '16px'
              }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    Stock Movement Audit Trail
                  </h2>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
                    Immutable append-only ledger history for: {ledgerBatchTitle}
                  </p>
                </div>
                <button
                  onClick={() => setIsLedgerModalOpen(false)}
                  style={{ background: 'none', border: 'none', fontSize: '20px', color: '#94a3b8', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              <div style={{ padding: '24px' }}>
                {ledgerLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                    Loading audit ledger entries...
                  </div>
                ) : ledgerEntries.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                    No stock movements recorded yet for this batch.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {ledgerEntries.map((entry) => (
                      <div
                        key={entry.id}
                        style={{
                          padding: '14px 16px',
                          borderRadius: '10px',
                          border: '1px solid #e2e8f0',
                          backgroundColor: '#f8fafc',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor: entry.changeUnits >= 0 ? '#dcfce7' : '#fee2e2',
                              color: entry.changeUnits >= 0 ? '#15803d' : '#b91c1c'
                            }}>
                              {entry.movementType}
                            </span>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                              {entry.changeUnits > 0 ? `+${entry.changeUnits}` : entry.changeUnits} units
                            </span>
                            <span style={{ fontSize: '12px', color: '#64748b' }}>
                              (Balance: {entry.balanceUnitsBefore} → {entry.balanceUnitsAfter})
                            </span>
                          </div>
                          <div style={{ fontSize: '13px', color: '#334155', marginTop: '6px' }}>
                            &quot;{entry.reason}&quot;
                          </div>
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                            By: {entry.performedByName || entry.performedBy} • {new Date(entry.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
