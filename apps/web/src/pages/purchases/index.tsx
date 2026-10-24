'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { useStore } from '@/context/StoreContext';
import { apiGet, apiPost, ApiError } from '@/lib/api';
import {
  PurchaseOrder,
  SupplierProfile,
  MedicineMaster,
  formatPaiseToINR,
} from '@pulseclinic/types';

interface POListResponse {
  success: boolean;
  purchaseOrders: PurchaseOrder[];
  nextCursor?: string;
}

interface SupplierListResponse {
  success: boolean;
  suppliers: SupplierProfile[];
}

interface MedicineListResponse {
  success: boolean;
  medicines: MedicineMaster[];
}

interface NewPOLineItem {
  medicineId: string;
  quantityPacks: number;
  unitCostRupees: string;
}

interface GRNBatchInputItem {
  medicineId: string;
  medicineName: string;
  stripSize: number;
  quantityPacks: number;
  batchNumber: string;
  expiryDate: string;
  mrpRupees: string;
  purchaseRateRupees: string;
  rackLocation: string;
}

export default function PurchasesPage() {
  const { activeStore } = useStore();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierProfile[]>([]);
  const [medicines, setMedicines] = useState<MedicineMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ISSUED' | 'RECEIVED' | 'DRAFT'>('ALL');

  // New PO Modal
  const [isNewPOModalOpen, setIsNewPOModalOpen] = useState(false);
  const [newPOSupplierId, setNewPOSupplierId] = useState('');
  const [newPOLines, setNewPOLines] = useState<NewPOLineItem[]>([]);
  const [newPONotes, setNewPONotes] = useState('');
  const [newPOLoading, setNewPOLoading] = useState(false);
  const [newPOError, setNewPOError] = useState<string | null>(null);

  // Receive GRN Modal
  const [isGRNModalOpen, setIsGRNModalOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [grnBatches, setGrnBatches] = useState<GRNBatchInputItem[]>([]);
  const [grnLoading, setGrnLoading] = useState(false);
  const [grnError, setGrnError] = useState<string | null>(null);

  const fetchPOs = async () => {
    if (!activeStore) return;
    setLoading(true);
    setError(null);
    try {
      const q = statusFilter !== 'ALL' ? `?status=${statusFilter}&limit=100` : `?limit=100`;
      const res = await apiGet<POListResponse>(`/purchases${q}`, activeStore.storeId);
      if (res.success) {
        setPurchaseOrders(res.purchaseOrders || []);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to load purchase orders.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPrerequisites = async () => {
    if (!activeStore) return;
    try {
      const [supRes, medRes] = await Promise.all([
        apiGet<SupplierListResponse>(`/suppliers?limit=100`, activeStore.storeId),
        apiGet<MedicineListResponse>(`/inventory/medicines?limit=100`, activeStore.storeId),
      ]);
      if (supRes.success) setSuppliers(supRes.suppliers || []);
      if (medRes.success) setMedicines(medRes.medicines || []);
    } catch {
      // Non-fatal
    }
  };

  useEffect(() => {
    fetchPOs();
  }, [activeStore?.storeId, statusFilter]);

  useEffect(() => {
    fetchPrerequisites();
  }, [activeStore?.storeId]);

  const stats = useMemo(() => {
    const total = purchaseOrders.length;
    const issued = purchaseOrders.filter((p) => p.status === 'ISSUED').length;
    const received = purchaseOrders.filter((p) => p.status === 'RECEIVED').length;
    let totalValue = 0;
    purchaseOrders.forEach((p) => {
      totalValue += p.totalAmountPaise || 0;
    });
    return { total, issued, received, totalValue };
  }, [purchaseOrders]);

  const handleOpenNewPO = () => {
    setNewPOSupplierId(suppliers[0]?.id || '');
    if (medicines.length > 0) {
      setNewPOLines([{ medicineId: medicines[0].id, quantityPacks: 10, unitCostRupees: '100.00' }]);
    } else {
      setNewPOLines([]);
    }
    setNewPONotes('');
    setNewPOError(null);
    setIsNewPOModalOpen(true);
  };

  const handleAddPOLine = () => {
    const defaultMedId = medicines[0]?.id || '';
    setNewPOLines((prev) => [...prev, { medicineId: defaultMedId, quantityPacks: 10, unitCostRupees: '100.00' }]);
  };

  const handleRemovePOLine = (index: number) => {
    setNewPOLines((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore) return;
    if (!newPOSupplierId) {
      setNewPOError('Please select a supplier.');
      return;
    }
    if (newPOLines.length === 0) {
      setNewPOError('Add at least one medicine line item to the order.');
      return;
    }

    setNewPOLoading(true);
    setNewPOError(null);

    try {
      const payload = {
        supplierId: newPOSupplierId,
        lineItems: newPOLines.map((l) => ({
          medicineId: l.medicineId,
          quantityPacks: l.quantityPacks,
          unitCostPaise: Math.round(parseFloat(l.unitCostRupees || '0') * 100),
        })),
        notes: newPONotes || undefined,
      };

      const res = await apiPost<{ success: boolean; purchaseOrder: PurchaseOrder }>(
        `/purchases`,
        payload,
        activeStore.storeId
      );

      if (res.success) {
        setPurchaseOrders((prev) => [res.purchaseOrder, ...prev]);
        setIsNewPOModalOpen(false);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) setNewPOError(err.message);
      else setNewPOError('Failed to create purchase order.');
    } finally {
      setNewPOLoading(false);
    }
  };

  const handleOpenGRNModal = (po: PurchaseOrder) => {
    setSelectedPO(po);
    setInvoiceNumber('');
    setInvoiceDate(new Date().toISOString().slice(0, 10));

    // Default 1 year expiry
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const defExpiry = nextYear.toISOString().slice(0, 10);

    const initialBatches: GRNBatchInputItem[] = po.lineItems.map((item, idx) => ({
      medicineId: item.medicineId,
      medicineName: item.medicineBrandName,
      stripSize: item.stripSize || 10,
      quantityPacks: item.quantityPacks,
      batchNumber: `B${Date.now().toString().slice(-4)}${idx + 1}`,
      expiryDate: defExpiry,
      mrpRupees: ((item.unitCostPaise * 1.35) / 100).toFixed(2),
      purchaseRateRupees: (item.unitCostPaise / 100).toFixed(2),
      rackLocation: 'Rack A-1',
    }));

    setGrnBatches(initialBatches);
    setGrnError(null);
    setIsGRNModalOpen(true);
  };

  const handleExecuteGRN = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore || !selectedPO) return;

    if (!invoiceNumber.trim()) {
      setGrnError('Supplier Invoice Number is mandatory for GRN receipt.');
      return;
    }
    if (!invoiceDate) {
      setGrnError('Supplier Invoice Date is mandatory.');
      return;
    }

    setGrnLoading(true);
    setGrnError(null);

    try {
      const payload = {
        poId: selectedPO.id,
        supplierInvoiceNumber: invoiceNumber.trim(),
        supplierInvoiceDate: invoiceDate,
        batches: grnBatches.map((b) => ({
          medicineId: b.medicineId,
          batchNumber: b.batchNumber.trim().toUpperCase(),
          expiryDate: b.expiryDate,
          quantityPacks: b.quantityPacks,
          stripSize: b.stripSize,
          purchaseRatePaise: Math.round(parseFloat(b.purchaseRateRupees || '0') * 100),
          mrpPaise: Math.round(parseFloat(b.mrpRupees || '0') * 100),
          rackLocation: b.rackLocation || undefined,
        })),
      };

      const res = await apiPost<{ success: boolean; purchaseOrder: PurchaseOrder }>(
        `/purchases/${selectedPO.id}/receive`,
        payload,
        activeStore.storeId
      );

      if (res.success) {
        setPurchaseOrders((prev) =>
          prev.map((p) => (p.id === selectedPO.id ? res.purchaseOrder : p))
        );
        setIsGRNModalOpen(false);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) setGrnError(err.message);
      else setGrnError('Failed to execute GRN stock ingestion.');
    } finally {
      setGrnLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <Head>
        <title>Purchase Orders & GRN Receiving | PulseClinic</title>
        <meta name="description" content="Procurement lifecycle, supplier POs, and atomic Goods Received Note (GRN) batch ingestion." />
      </Head>

      <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)'
            }}>
              🛒
            </div>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Purchase Orders & GRN Receiving
              </h1>
              <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>
                Manage distributor purchase orders, delivery receiving (GRN), atomic batch inventory stock ingestion, and payables.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleOpenNewPO}
              id="new-po-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(59, 130, 246, 0.25)',
                transition: 'all 0.15s ease'
              }}
            >
              <span>+ New Purchase Order</span>
            </button>
          </div>
        </div>

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
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Total Purchase Orders</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>{stats.total}</div>
            <div style={{ fontSize: '12px', color: '#3b82f6', marginTop: '4px', fontWeight: 500 }}>Lifetime orders</div>
          </div>

          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            padding: '16px 20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Awaiting Delivery (Issued)</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: stats.issued > 0 ? '#f59e0b' : '#0f172a', marginTop: '6px' }}>
              {stats.issued}
            </div>
            <div style={{ fontSize: '12px', color: '#f59e0b', marginTop: '4px', fontWeight: 500 }}>Ready for GRN receiving</div>
          </div>

          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            padding: '16px 20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Received & Stocked (GRN)</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#10b981', marginTop: '6px' }}>{stats.received}</div>
            <div style={{ fontSize: '12px', color: '#10b981', marginTop: '4px', fontWeight: 500 }}>Ingested to batches</div>
          </div>

          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            padding: '16px 20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Total Procurement Value</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>
              {formatPaiseToINR(stats.totalValue)}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', fontWeight: 500 }}>Order book total</div>
          </div>
        </div>

        {/* Filter Pills */}
        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          padding: '14px 20px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Status Filter:</span>
          {[
            { id: 'ALL', label: 'All Orders' },
            { id: 'ISSUED', label: 'Pending Delivery (Issued)' },
            { id: 'RECEIVED', label: 'Received (Stock Ingested)' },
            { id: 'DRAFT', label: 'Draft' },
          ].map((pill) => {
            const active = statusFilter === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => setStatusFilter(pill.id as any)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '9999px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: active ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                  backgroundColor: active ? 'rgba(59, 130, 246, 0.1)' : '#f8fafc',
                  color: active ? '#2563eb' : '#64748b',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '8px',
            padding: '12px 16px',
            color: '#b91c1c',
            fontSize: '14px'
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Purchase Orders Table */}
        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '920px' }}>
              <thead>
                <tr style={{
                  backgroundColor: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  color: '#475569',
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase'
                }}>
                  <th style={{ padding: '14px 20px' }}>PO Number & Date</th>
                  <th style={{ padding: '14px 16px' }}>Distributor / Vendor</th>
                  <th style={{ padding: '14px 16px' }}>Order Contents</th>
                  <th style={{ padding: '14px 16px' }}>Total Amount</th>
                  <th style={{ padding: '14px 16px' }}>PO Status</th>
                  <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody style={{ fontSize: '14px', color: '#1e293b' }}>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '48px 20px', textAlign: 'center', color: '#64748b' }}>
                      <div style={{ display: 'inline-block', width: 24, height: 24, border: '3px solid #cbd5e1', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                      <div style={{ marginTop: '10px', fontSize: '14px' }}>Loading purchase orders...</div>
                    </td>
                  </tr>
                ) : purchaseOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '48px 20px', textAlign: 'center' }}>
                      <div style={{ fontSize: '40px' }}>🛒</div>
                      <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '8px', fontSize: '16px' }}>
                        No purchase orders matching filter
                      </div>
                      <div style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>
                        Create a PO to restock medicines from your distributors.
                      </div>
                      <button
                        onClick={handleOpenNewPO}
                        style={{
                          marginTop: '16px',
                          padding: '8px 18px',
                          backgroundColor: '#3b82f6',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        + Create First Order
                      </button>
                    </td>
                  </tr>
                ) : (
                  purchaseOrders.map((po, index) => (
                    <tr
                      key={po.id}
                      style={{
                        borderBottom: index === purchaseOrders.length - 1 ? 'none' : '1px solid #f1f5f9',
                        transition: 'background-color 0.15s ease',
                        backgroundColor: '#ffffff'
                      }}
                    >
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>
                          {po.poNumber}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                          {new Date(po.createdAt).toLocaleDateString()}
                        </div>
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{po.supplierName}</div>
                        {po.supplierInvoiceNumber && (
                          <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '2px' }}>
                            Inv: {po.supplierInvoiceNumber}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                          {po.lineItems?.length || 0} formulation(s)
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                          Total: {po.lineItems?.reduce((acc, curr) => acc + (curr.quantityPacks || 0), 0)} packs
                        </div>
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                          {formatPaiseToINR(po.totalAmountPaise)}
                        </div>
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        {po.status === 'RECEIVED' ? (
                          <span style={{
                            padding: '3px 10px',
                            borderRadius: '9999px',
                            fontSize: '12px',
                            fontWeight: 700,
                            backgroundColor: '#f0fdf4',
                            color: '#16a34a',
                            border: '1px solid #bbf7d0'
                          }}>
                            ✓ Received (Stock Ingested)
                          </span>
                        ) : po.status === 'ISSUED' ? (
                          <span style={{
                            padding: '3px 10px',
                            borderRadius: '9999px',
                            fontSize: '12px',
                            fontWeight: 600,
                            backgroundColor: '#fef3c7',
                            color: '#b45309',
                            border: '1px solid #fde68a'
                          }}>
                            ⏳ Issued (Awaiting Delivery)
                          </span>
                        ) : po.status === 'CANCELLED' ? (
                          <span style={{
                            padding: '3px 10px',
                            borderRadius: '9999px',
                            fontSize: '12px',
                            fontWeight: 600,
                            backgroundColor: '#fee2e2',
                            color: '#b91c1c'
                          }}>
                            Cancelled
                          </span>
                        ) : (
                          <span style={{
                            padding: '3px 10px',
                            borderRadius: '9999px',
                            fontSize: '12px',
                            fontWeight: 600,
                            backgroundColor: '#f1f5f9',
                            color: '#475569'
                          }}>
                            Draft
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        {po.status === 'ISSUED' && (
                          <button
                            onClick={() => handleOpenGRNModal(po)}
                            style={{
                              padding: '6px 14px',
                              backgroundColor: '#10b981',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '13px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              boxShadow: '0 2px 6px rgba(16, 185, 129, 0.25)'
                            }}
                          >
                            Receive GRN
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: New Purchase Order */}
        {isNewPOModalOpen && (
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
              maxWidth: '680px',
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
                    Create Purchase Order
                  </h2>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
                    Select distributor and line items with pack quantities.
                  </p>
                </div>
                <button
                  onClick={() => setIsNewPOModalOpen(false)}
                  style={{ background: 'none', border: 'none', fontSize: '20px', color: '#94a3b8', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreatePO} style={{ padding: '24px' }}>
                {newPOError && (
                  <div style={{
                    marginBottom: '16px',
                    backgroundColor: '#fee2e2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    padding: '12px',
                    color: '#b91c1c',
                    fontSize: '13px'
                  }}>
                    {newPOError}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      Distributor / Vendor *
                    </label>
                    <select
                      required
                      value={newPOSupplierId}
                      onChange={(e) => setNewPOSupplierId(e.target.value)}
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
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.paymentTermsDays} Days Net)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>
                        Line Items
                      </span>
                      <button
                        type="button"
                        onClick={handleAddPOLine}
                        style={{
                          fontSize: '12px',
                          color: '#2563eb',
                          fontWeight: 600,
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        + Add Formulation
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {newPOLines.map((line, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 100px 110px 32px',
                            gap: '8px',
                            alignItems: 'center'
                          }}
                        >
                          <select
                            value={line.medicineId}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNewPOLines((prev) =>
                                prev.map((l, i) => (i === idx ? { ...l, medicineId: val } : l))
                              );
                            }}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontSize: '13px',
                              backgroundColor: '#ffffff'
                            }}
                          >
                            {medicines.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.brandName} ({m.strength})
                              </option>
                            ))}
                          </select>

                          <input
                            type="number"
                            min={1}
                            placeholder="Packs"
                            value={line.quantityPacks}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 1;
                              setNewPOLines((prev) =>
                                prev.map((l, i) => (i === idx ? { ...l, quantityPacks: val } : l))
                              );
                            }}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontSize: '13px'
                            }}
                          />

                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="₹/Pack"
                            value={line.unitCostRupees}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNewPOLines((prev) =>
                                prev.map((l, i) => (i === idx ? { ...l, unitCostRupees: val } : l))
                              );
                            }}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontSize: '13px'
                            }}
                          />

                          <button
                            type="button"
                            onClick={() => handleRemovePOLine(idx)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ef4444',
                              fontSize: '16px',
                              cursor: 'pointer'
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      Order Notes / Delivery Instructions
                    </label>
                    <input
                      type="text"
                      value={newPONotes}
                      onChange={(e) => setNewPONotes(e.target.value)}
                      placeholder="e.g. Urgent morning stock refill"
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
                    onClick={() => setIsNewPOModalOpen(false)}
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
                    disabled={newPOLoading}
                    id="submit-po-btn"
                    style={{
                      padding: '10px 24px',
                      backgroundColor: '#3b82f6',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: newPOLoading ? 'not-allowed' : 'pointer',
                      opacity: newPOLoading ? 0.7 : 1,
                      boxShadow: '0 2px 8px rgba(59, 130, 246, 0.25)'
                    }}
                  >
                    {newPOLoading ? 'Creating...' : 'Issue Purchase Order'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Receive Goods Received Note (GRN) */}
        {isGRNModalOpen && selectedPO && (
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
              maxWidth: '840px',
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
                    Receive Goods Received Note (GRN)
                  </h2>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
                    PO: {selectedPO.poNumber} • Vendor: {selectedPO.supplierName}
                  </p>
                </div>
                <button
                  onClick={() => setIsGRNModalOpen(false)}
                  style={{ background: 'none', border: 'none', fontSize: '20px', color: '#94a3b8', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleExecuteGRN} style={{ padding: '24px' }}>
                {grnError && (
                  <div style={{
                    marginBottom: '16px',
                    backgroundColor: '#fee2e2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    padding: '12px',
                    color: '#b91c1c',
                    fontSize: '13px'
                  }}>
                    {grnError}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        Supplier Invoice Number *
                      </label>
                      <input
                        type="text"
                        required
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        placeholder="e.g. INV-991280"
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
                        Supplier Invoice Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={invoiceDate}
                        onChange={(e) => setInvoiceDate(e.target.value)}
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

                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Verify Delivered Drug Batches
                    </h3>
                    <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                      Batches will be automatically registered in FEFO stock inventory and supplier debt will be credited atomically.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {grnBatches.map((item, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '14px',
                            borderRadius: '10px',
                            border: '1px solid #e2e8f0',
                            backgroundColor: '#f8fafc',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>
                              {item.medicineName}
                            </span>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#0369a1' }}>
                              {item.quantityPacks} packs ({item.quantityPacks * item.stripSize} base units)
                            </span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                                Batch # *
                              </label>
                              <input
                                type="text"
                                required
                                value={item.batchNumber}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setGrnBatches((prev) =>
                                    prev.map((b, i) => (i === idx ? { ...b, batchNumber: val } : b))
                                  );
                                }}
                                style={{
                                  width: '100%',
                                  padding: '7px 9px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '13px',
                                  fontFamily: 'monospace',
                                  boxSizing: 'border-box'
                                }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                                Expiry Date *
                              </label>
                              <input
                                type="date"
                                required
                                value={item.expiryDate}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setGrnBatches((prev) =>
                                    prev.map((b, i) => (i === idx ? { ...b, expiryDate: val } : b))
                                  );
                                }}
                                style={{
                                  width: '100%',
                                  padding: '7px 9px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '13px',
                                  boxSizing: 'border-box'
                                }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                                MRP (₹/pack) *
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                required
                                value={item.mrpRupees}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setGrnBatches((prev) =>
                                    prev.map((b, i) => (i === idx ? { ...b, mrpRupees: val } : b))
                                  );
                                }}
                                style={{
                                  width: '100%',
                                  padding: '7px 9px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '13px',
                                  boxSizing: 'border-box'
                                }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                                Cost (₹/pack) *
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                required
                                value={item.purchaseRateRupees}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setGrnBatches((prev) =>
                                    prev.map((b, i) => (i === idx ? { ...b, purchaseRateRupees: val } : b))
                                  );
                                }}
                                style={{
                                  width: '100%',
                                  padding: '7px 9px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '13px',
                                  boxSizing: 'border-box'
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
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
                    onClick={() => setIsGRNModalOpen(false)}
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
                    disabled={grnLoading}
                    id="confirm-grn-btn"
                    style={{
                      padding: '10px 24px',
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: grnLoading ? 'not-allowed' : 'pointer',
                      opacity: grnLoading ? 0.7 : 1,
                      boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)'
                    }}
                  >
                    {grnLoading ? 'Ingesting Stock...' : 'Confirm & Ingest Stock to Inventory'}
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
