'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { useStore } from '@/context/StoreContext';
import { apiPost, apiGet, ApiError } from '@/lib/api';

interface VaultBatch {
  id: string;
  medicineId: string;
  medicineBrandName: string;
  dosageForm: string;
  batchNumber: string;
  expiryDate: string;
  mrpPaise: number;
  costPricePaise: number;
  stockUnits: number;
  status: string;
}

interface MedicineProfit {
  name: string;
  revenuePaise: number;
  costPaise: number;
  profitPaise: number;
  marginPercent: number;
  qtySold: number;
}

interface ProfitData {
  todayRevenuePaise: number;
  todayCostPaise: number;
  todayProfitPaise: number;
  todayInvoiceCount: number;
  totalRevenuePaise: number;
  totalCostPaise: number;
  totalProfitPaise: number;
  totalMarginPercent: number;
  topProfitable: MedicineProfit[];
  leastProfitable: MedicineProfit[];
  lossMakers: MedicineProfit[];
  missingCostCount: number;
}

const VAULT_TIMEOUT_MS = 15 * 60 * 1000;

export default function OwnerVaultPage() {
  const { activeStore } = useStore();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinLoading, setPinLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'cost' | 'profit' | 'commission'>('profit');

  // Cost editor state
  const [batches, setBatches] = useState<VaultBatch[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [editingBatch, setEditingBatch] = useState<string | null>(null);
  const [editCostValue, setEditCostValue] = useState('');
  const [saveStatus, setSaveStatus] = useState<Record<string, 'saving' | 'saved' | 'error'>>({});
  const [costFilter, setCostFilter] = useState<'all' | 'missing' | 'filled'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Profit state
  const [profitData, setProfitData] = useState<ProfitData | null>(null);
  const [profitLoading, setProfitLoading] = useState(false);

  // Doctor commission state
  const [commissions, setCommissions] = useState<any[]>([]);
  const [commissionsLoading, setCommissionsLoading] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payDoctorId, setPayDoctorId] = useState<string | null>(null);

  // Auto-lock timer
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetLockTimer = useCallback(() => {
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    lockTimerRef.current = setTimeout(() => {
      setIsUnlocked(false);
      sessionStorage.removeItem('vault_unlocked');
    }, VAULT_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    const wasUnlocked = sessionStorage.getItem('vault_unlocked') === 'true';
    if (wasUnlocked) {
      setIsUnlocked(true);
      resetLockTimer();
    }
  }, [resetLockTimer]);

  useEffect(() => {
    if (!isUnlocked) return;
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    const handler = () => resetLockTimer();
    events.forEach(e => window.addEventListener(e, handler));
    return () => events.forEach(e => window.removeEventListener(e, handler));
  }, [isUnlocked, resetLockTimer]);

  const handleUnlock = async () => {
    if (!activeStore || !pin.trim()) return;
    setPinLoading(true);
    setPinError(null);

    try {
      const res = await apiPost<{ success: boolean }>('/vault/verify-pin', { pin: pin.trim() }, activeStore.storeId);
      if (res.success) {
        setIsUnlocked(true);
        sessionStorage.setItem('vault_unlocked', 'true');
        setPin('');
        resetLockTimer();
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) setPinError(err.message);
      else setPinError('Failed to verify PIN');
    } finally {
      setPinLoading(false);
    }
  };

  const handleLock = () => {
    setIsUnlocked(false);
    sessionStorage.removeItem('vault_unlocked');
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
  };

  const fetchBatches = useCallback(async () => {
    if (!activeStore) return;
    setBatchesLoading(true);
    try {
      const res = await apiGet<{ success: boolean; batches: VaultBatch[] }>('/vault/batches', activeStore.storeId);
      if (res.success) setBatches(res.batches);
    } catch { /* ignore */ }
    finally { setBatchesLoading(false); }
  }, [activeStore]);

  const fetchProfit = useCallback(async () => {
    if (!activeStore) return;
    setProfitLoading(true);
    try {
      const res = await apiGet<{ success: boolean; profit: ProfitData }>('/vault/profit', activeStore.storeId);
      if (res.success) setProfitData(res.profit);
    } catch { /* ignore */ }
    finally { setProfitLoading(false); }
  }, [activeStore]);

  const fetchCommissions = useCallback(async () => {
    if (!activeStore) return;
    setCommissionsLoading(true);
    try {
      const res = await apiGet<{ success: boolean; commissions: any[] }>('/vault/doctor-commissions', activeStore.storeId);
      if (res.success) setCommissions(res.commissions);
    } catch { /* ignore */ }
    finally { setCommissionsLoading(false); }
  }, [activeStore]);

  const fetchLedger = useCallback(async (doctorId: string) => {
    if (!activeStore) return;
    setLedgerLoading(true);
    try {
      const res = await apiGet<{ success: boolean; ledger: any[] }>(`/vault/doctor-commissions/${doctorId}/ledger`, activeStore.storeId);
      if (res.success) setLedger(res.ledger);
    } catch { /* ignore */ }
    finally { setLedgerLoading(false); }
  }, [activeStore]);

  const handlePayCommission = async () => {
    if (!activeStore || !payDoctorId) return;
    const paise = Math.round(parseFloat(payAmount || '0') * 100);
    if (paise <= 0) return;
    setPayLoading(true);
    setPayError(null);
    try {
      await apiPost('/vault/doctor-commissions/' + payDoctorId + '/pay', {
        amountPaise: paise,
        note: payNote.trim() || undefined,
      }, activeStore.storeId);
      setShowPayModal(false);
      setPayAmount('');
      setPayNote('');
      fetchCommissions();
      if (selectedDoctorId === payDoctorId) fetchLedger(payDoctorId);
    } catch (err: any) {
      setPayError(err instanceof ApiError ? err.message : 'Payment failed');
    } finally {
      setPayLoading(false);
    }
  };

  useEffect(() => {
    if (isUnlocked && activeStore) {
      fetchBatches();
      fetchProfit();
      fetchCommissions();
    }
  }, [isUnlocked, activeStore, fetchBatches, fetchProfit, fetchCommissions]);

  const saveCostPrice = async (batchId: string, costRupees: string) => {
    if (!activeStore) return;
    const paise = Math.round(parseFloat(costRupees || '0') * 100);
    if (isNaN(paise) || paise < 0) return;

    setSaveStatus(prev => ({ ...prev, [batchId]: 'saving' }));
    try {
      await apiPost<{ success: boolean }>('/vault/batches/cost', { batchId, costPricePaise: paise }, activeStore.storeId);
      setBatches(prev => prev.map(b => b.id === batchId ? { ...b, costPricePaise: paise } : b));
      setSaveStatus(prev => ({ ...prev, [batchId]: 'saved' }));
      setTimeout(() => setSaveStatus(prev => { const n = { ...prev }; delete n[batchId]; return n; }), 2000);
    } catch {
      setSaveStatus(prev => ({ ...prev, [batchId]: 'error' }));
    }
    setEditingBatch(null);
  };

  const filteredBatches = batches.filter(b => {
    if (costFilter === 'missing' && b.costPricePaise > 0) return false;
    if (costFilter === 'filled' && b.costPricePaise === 0) return false;
    if (searchTerm && !b.medicineBrandName.toLowerCase().includes(searchTerm.toLowerCase()) && !b.batchNumber.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const p = (paise: number) => (paise / 100).toFixed(2);

  // PIN Entry Screen
  if (!isUnlocked) {
    return (
      <DashboardLayout>
        <Head><title>Owner Vault | New Sanjivani Clinic</title></Head>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 120px)' }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            padding: '48px 40px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
            width: '100%',
            maxWidth: '400px',
            textAlign: 'center',
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'linear-gradient(135deg, #1e293b, #334155)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px auto', fontSize: '28px',
            }}>
              🔒
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>Owner Vault</h1>
            <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 28px 0' }}>
              Enter your PIN to access cost prices, profit analytics, and confidential data.
            </p>

            {pinError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
                {pinError}
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); handleUnlock(); }}>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter Owner PIN"
                autoFocus
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  fontSize: '18px',
                  textAlign: 'center',
                  letterSpacing: '8px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '12px',
                  outline: 'none',
                  fontWeight: 700,
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#2563eb'; }}
                onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; }}
              />
              <button
                type="submit"
                disabled={pinLoading || !pin.trim()}
                style={{
                  width: '100%',
                  marginTop: '16px',
                  padding: '14px',
                  background: pinLoading ? '#94a3b8' : '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: pinLoading ? 'not-allowed' : 'pointer',
                }}
              >
                {pinLoading ? 'Verifying...' : 'Unlock Vault'}
              </button>
            </form>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Unlocked Vault
  return (
    <DashboardLayout>
      <Head><title>Owner Vault | New Sanjivani Clinic</title></Head>
      <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: 42, height: 42, borderRadius: '12px',
              background: 'linear-gradient(135deg, #0f172a, #334155)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '22px',
            }}>
              🔓
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Owner Vault</h1>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>
                Cost prices, margins & profit analytics — confidential
              </p>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                {[['Click cost', 'Edit'], ['Enter', 'Save & next'], ['Tab', 'Next field'], ['Esc', 'Cancel']].map(([k, v]) => (
                  <span key={k} style={{ fontSize: '10px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <kbd style={{ padding: '1px 4px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '3px', fontSize: '10px', fontWeight: 600, color: '#475569', fontFamily: 'inherit' }}>{k}</kbd>
                    {v}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <button
            onClick={handleLock}
            style={{
              padding: '8px 18px',
              background: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            🔒 Lock Vault
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', borderRadius: '10px', padding: '4px', width: 'fit-content' }}>
          {(['profit', 'cost', 'commission'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                background: activeTab === tab ? '#ffffff' : 'transparent',
                color: activeTab === tab ? '#0f172a' : '#64748b',
                boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {tab === 'profit' ? 'Profit Dashboard' : tab === 'cost' ? 'Cost Price Editor' : 'Doctor Commission'}
            </button>
          ))}
        </div>

        {/* Profit Dashboard Tab */}
        {activeTab === 'profit' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {profitLoading ? (
              <div style={{ background: '#fff', borderRadius: '12px', padding: '40px', textAlign: 'center', border: '1px solid #e2e8f0', color: '#64748b' }}>
                Loading profit analytics...
              </div>
            ) : profitData ? (
              <>
                {/* KPI Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                  <KPICard label="Today's Revenue" value={`₹${p(profitData.todayRevenuePaise)}`} color="#2563eb" sub={`${profitData.todayInvoiceCount} invoices`} />
                  <KPICard label="Today's Cost" value={`₹${p(profitData.todayCostPaise)}`} color="#dc2626" sub="Cost of goods sold" />
                  <KPICard label="Today's Profit" value={`₹${p(profitData.todayProfitPaise)}`} color={profitData.todayProfitPaise >= 0 ? '#059669' : '#dc2626'} sub={profitData.todayRevenuePaise > 0 ? `${((profitData.todayProfitPaise / profitData.todayRevenuePaise) * 100).toFixed(1)}% margin` : 'No sales yet'} />
                  <KPICard label="All-Time Profit" value={`₹${p(profitData.totalProfitPaise)}`} color={profitData.totalProfitPaise >= 0 ? '#059669' : '#dc2626'} sub={`${profitData.totalMarginPercent}% overall margin`} />
                </div>

                {profitData.missingCostCount > 0 && (
                  <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '10px', padding: '12px 16px', fontSize: '13px', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>⚠️</span>
                    <span><strong>{profitData.missingCostCount} batches</strong> are missing cost prices. Profit calculations may be inaccurate.
                    <button onClick={() => { setActiveTab('cost'); setCostFilter('missing'); }} style={{ background: 'none', border: 'none', color: '#92400e', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', padding: '0 0 0 4px' }}>Fix now →</button></span>
                  </div>
                )}

                {/* Top Profitable */}
                <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Top Profitable Medicines</h3>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
                        <th style={{ padding: '10px 16px', textAlign: 'left' }}>Medicine</th>
                        <th style={{ padding: '10px 16px', textAlign: 'right' }}>Revenue</th>
                        <th style={{ padding: '10px 16px', textAlign: 'right' }}>Cost</th>
                        <th style={{ padding: '10px 16px', textAlign: 'right' }}>Profit</th>
                        <th style={{ padding: '10px 16px', textAlign: 'right' }}>Margin</th>
                        <th style={{ padding: '10px 16px', textAlign: 'right' }}>Qty Sold</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profitData.topProfitable.map((m, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 16px', fontWeight: 600 }}>{m.name}</td>
                          <td style={{ padding: '10px 16px', textAlign: 'right' }}>₹{p(m.revenuePaise)}</td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', color: '#dc2626' }}>₹{p(m.costPaise)}</td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: m.profitPaise >= 0 ? '#059669' : '#dc2626' }}>₹{p(m.profitPaise)}</td>
                          <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                            <span style={{
                              padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                              background: m.marginPercent >= 20 ? '#dcfce7' : m.marginPercent >= 10 ? '#fef9c3' : '#fee2e2',
                              color: m.marginPercent >= 20 ? '#15803d' : m.marginPercent >= 10 ? '#a16207' : '#b91c1c',
                            }}>
                              {m.marginPercent}%
                            </span>
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'right' }}>{m.qtySold}</td>
                        </tr>
                      ))}
                      {profitData.topProfitable.length === 0 && (
                        <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>No sales data yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Loss Makers */}
                {profitData.lossMakers.length > 0 && (
                  <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #fecaca', overflow: 'hidden' }}>
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid #fecaca', background: '#fef2f2' }}>
                      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#991b1b' }}>Loss-Making Medicines</h3>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
                          <th style={{ padding: '10px 16px', textAlign: 'left' }}>Medicine</th>
                          <th style={{ padding: '10px 16px', textAlign: 'right' }}>Revenue</th>
                          <th style={{ padding: '10px 16px', textAlign: 'right' }}>Cost</th>
                          <th style={{ padding: '10px 16px', textAlign: 'right' }}>Loss</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profitData.lossMakers.map((m, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 16px', fontWeight: 600 }}>{m.name}</td>
                            <td style={{ padding: '10px 16px', textAlign: 'right' }}>₹{p(m.revenuePaise)}</td>
                            <td style={{ padding: '10px 16px', textAlign: 'right' }}>₹{p(m.costPaise)}</td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>-₹{p(Math.abs(m.profitPaise))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <div style={{ background: '#fff', borderRadius: '12px', padding: '40px', textAlign: 'center', border: '1px solid #e2e8f0', color: '#94a3b8' }}>
                No profit data available.
              </div>
            )}
          </div>
        )}

        {/* Cost Price Editor Tab */}
        {activeTab === 'cost' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Filters */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Search medicine or batch..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  padding: '9px 14px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '13px',
                  width: '280px',
                  outline: 'none',
                }}
              />
              <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', borderRadius: '8px', padding: '3px' }}>
                {(['all', 'missing', 'filled'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setCostFilter(f)}
                    style={{
                      padding: '6px 14px', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                      background: costFilter === f ? '#fff' : 'transparent',
                      color: costFilter === f ? '#0f172a' : '#64748b',
                      boxShadow: costFilter === f ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                    }}
                  >
                    {f === 'all' ? 'All' : f === 'missing' ? 'Missing Cost' : 'Has Cost'}
                  </button>
                ))}
              </div>
              <button onClick={fetchBatches} style={{ padding: '8px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: '#475569' }}>
                Refresh
              </button>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                {filteredBatches.length} batches shown
              </span>
            </div>

            {/* Cost Table */}
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              {batchesLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading batches...</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '800px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>
                        <th style={{ padding: '10px 14px', textAlign: 'left' }}>Medicine Name</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left' }}>Batch #</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left' }}>Expiry</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right' }}>Stock</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right' }}>MRP</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right' }}>Cost Price</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right' }}>Margin</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBatches.map((b) => {
                        const isEditing = editingBatch === b.id;
                        const margin = b.mrpPaise > 0 && b.costPricePaise > 0 ? Math.round(((b.mrpPaise - b.costPricePaise) / b.mrpPaise) * 10000) / 100 : null;
                        const status = saveStatus[b.id];

                        return (
                          <tr key={b.id} style={{
                            borderBottom: '1px solid #f1f5f9',
                            background: b.costPricePaise === 0 ? '#fffbeb' : undefined,
                          }}>
                            <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>
                              {b.medicineBrandName}
                              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 400 }}>{b.dosageForm}</div>
                            </td>
                            <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '12px' }}>{b.batchNumber}</td>
                            <td style={{ padding: '10px 14px', fontSize: '12px' }}>{b.expiryDate}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>{b.stockUnits}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>₹{(b.mrpPaise / 100).toFixed(2)}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                              {isEditing ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  autoFocus
                                  value={editCostValue}
                                  onChange={(e) => setEditCostValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      saveCostPrice(b.id, editCostValue);
                                      const currentIdx = filteredBatches.findIndex(fb => fb.id === b.id);
                                      if (currentIdx < filteredBatches.length - 1) {
                                        const nextBatch = filteredBatches[currentIdx + 1];
                                        setTimeout(() => {
                                          setEditingBatch(nextBatch.id);
                                          setEditCostValue(nextBatch.costPricePaise > 0 ? (nextBatch.costPricePaise / 100).toFixed(2) : '');
                                        }, 50);
                                      }
                                    }
                                    if (e.key === 'Escape') setEditingBatch(null);
                                  }}
                                  onBlur={() => saveCostPrice(b.id, editCostValue)}
                                  style={{
                                    width: '90px', padding: '5px 8px', border: '2px solid #2563eb', borderRadius: '6px',
                                    fontSize: '13px', textAlign: 'right', fontWeight: 600, outline: 'none',
                                  }}
                                />
                              ) : (
                                <span
                                  onClick={() => {
                                    setEditingBatch(b.id);
                                    setEditCostValue(b.costPricePaise > 0 ? (b.costPricePaise / 100).toFixed(2) : '');
                                  }}
                                  style={{
                                    cursor: 'pointer',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    border: '1px dashed',
                                    borderColor: b.costPricePaise === 0 ? '#f59e0b' : '#e2e8f0',
                                    fontWeight: 600,
                                    color: b.costPricePaise === 0 ? '#dc2626' : '#0f172a',
                                    display: 'inline-block',
                                    minWidth: '70px',
                                    textAlign: 'right',
                                  }}
                                  title="Click to edit cost price"
                                >
                                  {b.costPricePaise > 0 ? `₹${(b.costPricePaise / 100).toFixed(2)}` : 'Add cost'}
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                              {margin !== null ? (
                                <span style={{
                                  padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                                  background: margin >= 20 ? '#dcfce7' : margin >= 10 ? '#fef9c3' : '#fee2e2',
                                  color: margin >= 20 ? '#15803d' : margin >= 10 ? '#a16207' : '#b91c1c',
                                }}>
                                  {margin}%
                                </span>
                              ) : (
                                <span style={{ color: '#cbd5e1', fontSize: '12px' }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              {status === 'saving' && <span style={{ fontSize: '11px', color: '#2563eb' }}>Saving...</span>}
                              {status === 'saved' && <span style={{ fontSize: '11px', color: '#059669', fontWeight: 700 }}>Saved</span>}
                              {status === 'error' && <span style={{ fontSize: '11px', color: '#dc2626' }}>Error</span>}
                              {!status && <span style={{ fontSize: '11px', color: '#cbd5e1' }}>—</span>}
                            </td>
                          </tr>
                        );
                      })}
                      {filteredBatches.length === 0 && (
                        <tr><td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                          {searchTerm || costFilter !== 'all' ? 'No batches match your filter.' : 'No batches found.'}
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Doctor Commission Tab */}
        {activeTab === 'commission' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {commissionsLoading ? (
              <div style={{ background: '#fff', borderRadius: '12px', padding: '40px', textAlign: 'center', border: '1px solid #e2e8f0', color: '#64748b' }}>
                Loading doctor commissions...
              </div>
            ) : commissions.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: '12px', padding: '40px', textAlign: 'center', border: '1px solid #e2e8f0', color: '#94a3b8' }}>
                No doctor commissions recorded yet. Commissions are calculated on profit margin when a bill is created with a linked doctor.
              </div>
            ) : (
              <>
                {/* Summary KPIs */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                  <KPICard
                    label="Total Commission Earned"
                    value={`₹${(commissions.reduce((s: number, c: any) => s + (c.totalEarnedPaise || 0), 0) / 100).toFixed(2)}`}
                    color="#2563eb"
                    sub={`${commissions.length} doctors`}
                  />
                  <KPICard
                    label="Total Paid Out"
                    value={`₹${(commissions.reduce((s: number, c: any) => s + (c.totalPaidPaise || 0), 0) / 100).toFixed(2)}`}
                    color="#059669"
                    sub="All time"
                  />
                  <KPICard
                    label="Total Remaining"
                    value={`₹${(commissions.reduce((s: number, c: any) => s + (c.remainingPaise || 0), 0) / 100).toFixed(2)}`}
                    color={commissions.reduce((s: number, c: any) => s + (c.remainingPaise || 0), 0) > 0 ? '#dc2626' : '#059669'}
                    sub="Unpaid balance"
                  />
                </div>

                {/* Doctor Commission Table */}
                <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>
                          <th style={{ padding: '10px 14px', textAlign: 'left' }}>Doctor Name</th>
                          <th style={{ padding: '10px 14px', textAlign: 'right' }}>Commission Rate</th>
                          <th style={{ padding: '10px 14px', textAlign: 'right' }}>Total Earned</th>
                          <th style={{ padding: '10px 14px', textAlign: 'right' }}>Refunded</th>
                          <th style={{ padding: '10px 14px', textAlign: 'right' }}>Paid</th>
                          <th style={{ padding: '10px 14px', textAlign: 'right' }}>Remaining</th>
                          <th style={{ padding: '10px 14px', textAlign: 'center' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commissions.map((c: any) => (
                          <tr key={c.doctorId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>
                              {c.doctorName?.startsWith('Dr.') ? c.doctorName : `Dr. ${c.doctorName}`}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: '12px' }}>
                              {c.commissionBps ? `${(c.commissionBps / 100).toFixed(0)}%` : '—'}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#2563eb' }}>
                              ₹{((c.totalEarnedPaise || 0) / 100).toFixed(2)}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', color: '#dc2626' }}>
                              {c.totalRefundedPaise > 0 ? `-₹${(c.totalRefundedPaise / 100).toFixed(2)}` : '—'}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', color: '#059669', fontWeight: 600 }}>
                              ₹{((c.totalPaidPaise || 0) / 100).toFixed(2)}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: (c.remainingPaise || 0) > 0 ? '#dc2626' : '#059669' }}>
                              ₹{((c.remainingPaise || 0) / 100).toFixed(2)}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                {(c.remainingPaise || 0) > 0 && (
                                  <button
                                    onClick={() => {
                                      setPayDoctorId(c.doctorId);
                                      setPayAmount(((c.remainingPaise || 0) / 100).toFixed(2));
                                      setPayNote('');
                                      setPayError(null);
                                      setShowPayModal(true);
                                    }}
                                    style={{
                                      padding: '5px 12px', borderRadius: '6px', border: '1px solid #059669',
                                      background: '#f0fdf4', color: '#059669', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                                    }}
                                  >
                                    Pay
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setSelectedDoctorId(selectedDoctorId === c.doctorId ? null : c.doctorId);
                                    if (selectedDoctorId !== c.doctorId) fetchLedger(c.doctorId);
                                  }}
                                  style={{
                                    padding: '5px 12px', borderRadius: '6px', border: '1px solid #cbd5e1',
                                    background: selectedDoctorId === c.doctorId ? '#eff6ff' : '#fff',
                                    color: '#2563eb', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                                  }}
                                >
                                  {selectedDoctorId === c.doctorId ? 'Hide' : 'View Details'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Ledger Detail Panel */}
                {selectedDoctorId && (
                  <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                        Commission Ledger — {commissions.find((c: any) => c.doctorId === selectedDoctorId)?.doctorName || 'Doctor'}
                      </h3>
                      <button onClick={() => fetchLedger(selectedDoctorId)} style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: '#475569' }}>
                        Refresh
                      </button>
                    </div>
                    {ledgerLoading ? (
                      <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>Loading ledger...</div>
                    ) : ledger.length === 0 ? (
                      <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>No ledger entries found.</div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '800px' }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                              <th style={{ padding: '8px 14px', textAlign: 'left' }}>Date & Time</th>
                              <th style={{ padding: '8px 14px', textAlign: 'left' }}>Type</th>
                              <th style={{ padding: '8px 14px', textAlign: 'left' }}>Bill #</th>
                              <th style={{ padding: '8px 14px', textAlign: 'left' }}>Customer</th>
                              <th style={{ padding: '8px 14px', textAlign: 'right' }}>Bill Amount</th>
                              <th style={{ padding: '8px 14px', textAlign: 'right' }}>Profit</th>
                              <th style={{ padding: '8px 14px', textAlign: 'right' }}>Commission</th>
                              <th style={{ padding: '8px 14px', textAlign: 'left' }}>Note</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ledger.map((entry: any) => {
                              const dt = new Date(entry.createdAt);
                              const dateStr = dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                              const timeStr = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                              const typeBadge: Record<string, { bg: string; color: string; label: string }> = {
                                EARNED: { bg: '#dcfce7', color: '#15803d', label: 'EARNED' },
                                REFUND: { bg: '#fee2e2', color: '#b91c1c', label: 'REFUND' },
                                PAYMENT: { bg: '#dbeafe', color: '#1e40af', label: 'PAID' },
                              };
                              const badge = typeBadge[entry.type] || typeBadge.EARNED;
                              return (
                                <tr key={entry.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '8px 14px', fontSize: '12px' }}>
                                    {dateStr}<br/><span style={{ color: '#94a3b8' }}>{timeStr}</span>
                                  </td>
                                  <td style={{ padding: '8px 14px' }}>
                                    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, background: badge.bg, color: badge.color }}>
                                      {badge.label}
                                    </span>
                                  </td>
                                  <td style={{ padding: '8px 14px', fontFamily: 'monospace', fontSize: '12px' }}>
                                    {entry.invoiceNumber || '—'}
                                  </td>
                                  <td style={{ padding: '8px 14px', fontSize: '12px' }}>
                                    {entry.customerName || '—'}
                                  </td>
                                  <td style={{ padding: '8px 14px', textAlign: 'right', fontSize: '12px' }}>
                                    {entry.billAmountPaise ? `₹${(entry.billAmountPaise / 100).toFixed(2)}` : '—'}
                                  </td>
                                  <td style={{ padding: '8px 14px', textAlign: 'right', fontSize: '12px' }}>
                                    {entry.profitPaise ? `₹${(entry.profitPaise / 100).toFixed(2)}` : '—'}
                                  </td>
                                  <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, color: entry.amountPaise >= 0 ? '#15803d' : '#dc2626' }}>
                                    {entry.amountPaise >= 0 ? '+' : ''}₹{(Math.abs(entry.amountPaise) / 100).toFixed(2)}
                                  </td>
                                  <td style={{ padding: '8px 14px', fontSize: '12px', color: '#64748b' }}>
                                    {entry.note || '—'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Pay Commission Modal */}
        {showPayModal && payDoctorId && (
          <div
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}
            onClick={() => setShowPayModal(false)}
          >
            <div
              style={{ backgroundColor: '#fff', borderRadius: '16px', width: '100%', maxWidth: '400px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0' }}>
                Record Commission Payment
              </h3>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0' }}>
                Paying {commissions.find((c: any) => c.doctorId === payDoctorId)?.doctorName || 'Doctor'}
              </p>

              {payError && (
                <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', fontSize: '13px', marginBottom: '12px' }}>
                  {payError}
                </div>
              )}

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Amount (₹)
                </label>
                <input
                  autoFocus
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={payAmount}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setPayAmount(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handlePayCommission(); }}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '2px solid #2563eb', fontSize: '15px', fontWeight: 600 }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Note (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Weekly settlement"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handlePayCommission(); }}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button onClick={() => setShowPayModal(false)} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button
                  onClick={handlePayCommission}
                  disabled={payLoading}
                  style={{ padding: '8px 20px', background: '#059669', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: payLoading ? 'not-allowed' : 'pointer' }}
                >
                  {payLoading ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function KPICard({ label, value, color, sub }: { label: string; value: string; color: string; sub: string }) {
  return (
    <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '24px', fontWeight: 700, color, marginTop: '4px' }}>{value}</div>
      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{sub}</div>
    </div>
  );
}
