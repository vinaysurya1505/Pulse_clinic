'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { useStore } from '@/context/StoreContext';
import { apiGet, apiPost, apiPut, apiDelete, ApiError } from '@/lib/api';
import {
  MedicineMaster,
  CreateMedicineInput,
  BatchInventory,
  BaseUnits,
  BaseUnit,
  ScheduleCategories,
} from '@pulseclinic/types';

interface MedicineListResponse {
  success: boolean;
  medicines: MedicineMaster[];
  nextCursor?: string;
}

const DOSAGE_FORMS = [
  'Tablet',
  'Capsule',
  'Syrup',
  'Powder',
  'Granules',
  'Liquid/Bottle',
  'Cream',
  'Ointment',
  'Injection',
  'Drops',
  'Gel',
  'Sachet',
  'Inhaler',
  'Suppository',
  'Other',
];

const CATEGORIES = [
  'Analgesics & Antipyretics',
  'Antibiotics & Anti-infectives',
  'Cardiovascular & Antihypertensive',
  'Antidiabetic',
  'Gastrointestinal',
  'Respiratory & Anti-allergic',
  'Vitamins & Supplements',
  'Dermatological',
  'Neurological',
  'Ophthalmic & ENT',
  'Other',
];

interface NewRowData {
  brandName: string;
  dosageForm: string;
  rackLocation: string;
  stripSize: string;
  mrpRupees: string;
  batchNumber: string;
  expiryDate: string;
  stockUnits: string;
}

const emptyRow = (): NewRowData => ({
  brandName: '',
  dosageForm: 'Tablet',
  rackLocation: '',
  stripSize: '10',
  mrpRupees: '',
  batchNumber: '',
  expiryDate: '',
  stockUnits: '1',
});

// Inline cell style constants
const cellInput: React.CSSProperties = {
  width: '100%',
  padding: '7px 8px',
  border: '1.5px solid #c7d2fe',
  borderRadius: '4px',
  fontSize: '13px',
  color: '#0f172a',
  backgroundColor: '#fafaff',
  outline: 'none',
  boxSizing: 'border-box',
};

const cellSelect: React.CSSProperties = {
  ...cellInput,
  cursor: 'pointer',
  backgroundColor: '#fafaff',
};

const thStyle: React.CSSProperties = {
  padding: '10px 8px',
  fontWeight: 700,
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: '#475569',
  borderBottom: '2px solid #e2e8f0',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '8px 8px',
  fontSize: '13px',
  borderBottom: '1px solid #f1f5f9',
  verticalAlign: 'middle',
};

const iconBtn = (bg: string, color: string): React.CSSProperties => ({
  width: '28px',
  height: '28px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '6px',
  border: 'none',
  background: bg,
  color,
  fontWeight: 800,
  fontSize: '12px',
  cursor: 'pointer',
  flexShrink: 0,
});

export default function MedicinesPage() {
  const { activeStore } = useStore();
  const [medicines, setMedicines] = useState<MedicineMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search
  const [searchTerm, setSearchTerm] = useState('');

  // New inline rows (multiple can be open at once)
  const [newRows, setNewRows] = useState<NewRowData[]>([]);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});

  // Batch data per medicine (keyed by medicine ID)
  const [medicineBatches, setMedicineBatches] = useState<Record<string, BatchInventory[]>>({});

  // Flash animation for recently saved rows
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());

  // Restock modal
  const [restockMed, setRestockMed] = useState<MedicineMaster | null>(null);
  const [restockBatch, setRestockBatch] = useState<BatchInventory | null>(null);
  const [restockQty, setRestockQty] = useState('');
  const [restockMode, setRestockMode] = useState<'existing' | 'new'>('existing');
  const [restockNewBatch, setRestockNewBatch] = useState({ batchNumber: '', expiryDate: '', mrpRupees: '' });
  const [restockSaving, setRestockSaving] = useState(false);
  const [restockError, setRestockError] = useState<string | null>(null);

  // Edit mode for existing medicines (inline)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<NewRowData>(emptyRow());

  // Full detail modal for advanced edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<MedicineMaster | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateMedicineInput>({
    brandName: '',
    genericName: '',
    category: CATEGORIES[0],
    dosageForm: 'Tablet',
    strength: '500mg',
    manufacturer: '',
    hsnCode: '3004',
    gstRateBps: 0,
    baseUnit: BaseUnits.TABLET,
    stripSize: 10,
    allowLooseSales: true,
    scheduleCategory: ScheduleCategories.NONE,
    rackLocation: '',
    barcode: '',
    reorderLevelUnits: 50,
  });

  const nameInputRef = useRef<HTMLInputElement>(null);

  const fetchMedicines = async () => {
    if (!activeStore) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<MedicineListResponse>(
        '/inventory/medicines?limit=100',
        activeStore.storeId
      );
      if (res.success) {
        setMedicines(res.medicines || []);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to load medicines from catalog.');
    } finally {
      setLoading(false);
    }
  };

  const fetchBatchesForMedicines = async (meds: MedicineMaster[]) => {
    if (!activeStore || meds.length === 0) return;
    const batchMap: Record<string, BatchInventory[]> = {};
    await Promise.all(
      meds.map(async (med) => {
        try {
          const res = await apiGet<{ success: boolean; batches: BatchInventory[] }>(
            `/inventory/batches?medicineId=${med.id}`,
            activeStore.storeId
          );
          if (res.success && res.batches) {
            batchMap[med.id] = res.batches;
          } else {
            batchMap[med.id] = [];
          }
        } catch {
          batchMap[med.id] = [];
        }
      })
    );
    setMedicineBatches(batchMap);
  };

  useEffect(() => {
    fetchMedicines();
  }, [activeStore?.storeId]);

  useEffect(() => {
    if (medicines.length > 0 && activeStore) {
      fetchBatchesForMedicines(medicines);
    }
  }, [medicines, activeStore?.storeId]);

  const filteredMedicines = useMemo(() => {
    if (!searchTerm.trim()) return medicines;
    const term = searchTerm.toLowerCase().trim();
    return medicines.filter(
      (m) =>
        m.brandName?.toLowerCase().includes(term) ||
        m.genericName?.toLowerCase().includes(term) ||
        m.rackLocation?.toLowerCase().includes(term) ||
        m.dosageForm?.toLowerCase().includes(term)
    );
  }, [medicines, searchTerm]);

  const stats = useMemo(() => {
    const total = medicines.length;
    const scheduled = medicines.filter((m) => m.scheduleCategory !== 'NONE').length;
    return { total, scheduled };
  }, [medicines]);

  // --- NEW ROW HANDLERS ---
  const handleAddRow = () => {
    setNewRows((prev) => [...prev, emptyRow()]);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  const updateNewRow = (idx: number, field: keyof NewRowData, value: string) => {
    setNewRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
  };

  const removeNewRow = (idx: number) => {
    setNewRows((prev) => prev.filter((_, i) => i !== idx));
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
  };

  const handleSaveNewRow = async (idx: number) => {
    if (!activeStore) return;
    const row = newRows[idx];

    if (!row.brandName.trim()) {
      setRowErrors((p) => ({ ...p, [idx]: 'Medicine name is required' }));
      return;
    }
    if (!row.batchNumber.trim()) {
      setRowErrors((p) => ({ ...p, [idx]: 'Batch number is required' }));
      return;
    }
    if (!row.expiryDate.trim()) {
      setRowErrors((p) => ({ ...p, [idx]: 'Expiry date is required' }));
      return;
    }
    const mrp = parseFloat(row.mrpRupees);
    if (!mrp || mrp <= 0) {
      setRowErrors((p) => ({ ...p, [idx]: 'Valid MRP is required' }));
      return;
    }
    const stripSize = parseInt(row.stripSize, 10);
    if (!stripSize || stripSize < 1) {
      setRowErrors((p) => ({ ...p, [idx]: 'Units per strip must be at least 1' }));
      return;
    }

    setSavingIndex(idx);
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });

    try {
      const res = await apiPost<{ success: boolean; medicine: MedicineMaster }>(
        '/inventory/medicines/quick',
        {
          brandName: row.brandName.trim(),
          dosageForm: row.dosageForm,
          rackLocation: row.rackLocation.trim() || undefined,
          stripSize,
          mrpRupees: mrp,
          batchNumber: row.batchNumber.trim(),
          expiryDate: row.expiryDate.trim(),
          initialStockUnits: parseInt(row.stockUnits, 10) || 1,
        },
        activeStore.storeId
      );

      if (res.success) {
        setMedicines((prev) => [res.medicine, ...prev]);
        setNewRows((prev) => prev.filter((_, i) => i !== idx));
        // Flash green
        setFlashIds((prev) => new Set(prev).add(res.medicine.id));
        setTimeout(() => {
          setFlashIds((prev) => {
            const next = new Set(prev);
            next.delete(res.medicine.id);
            return next;
          });
        }, 1500);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) setRowErrors((p) => ({ ...p, [idx]: err.message }));
      else setRowErrors((p) => ({ ...p, [idx]: 'Failed to save. Try again.' }));
    } finally {
      setSavingIndex(null);
    }
  };

  // --- INLINE EDIT HANDLERS ---
  const startInlineEdit = (med: MedicineMaster) => {
    setEditingId(med.id);
    setEditData({
      brandName: med.brandName || '',
      dosageForm: med.dosageForm || 'Tablet',
      rackLocation: med.rackLocation || '',
      stripSize: String(med.stripSize || 10),
      mrpRupees: '',
      batchNumber: '',
      expiryDate: '',
      stockUnits: '1',
    });
  };

  const cancelInlineEdit = () => {
    setEditingId(null);
    setEditData(emptyRow());
  };

  const saveInlineEdit = async () => {
    if (!activeStore || !editingId) return;
    const strip = parseInt(editData.stripSize, 10) || 10;

    try {
      // Update medicine master fields
      const res = await apiPut<{ success: boolean; medicine: MedicineMaster }>(
        `/inventory/medicines/${editingId}`,
        {
          brandName: editData.brandName.trim(),
          dosageForm: editData.dosageForm,
          rackLocation: editData.rackLocation.trim() || undefined,
          stripSize: strip,
        },
        activeStore.storeId
      );

      // If batch fields are filled, create a new batch too
      const hasBatchData = editData.batchNumber.trim() && editData.expiryDate.trim() && parseFloat(editData.mrpRupees) > 0;
      if (hasBatchData) {
        let expiryIso = editData.expiryDate.trim();
        const mmYYYY = expiryIso.match(/^(\d{1,2})[\/\-](\d{4})$/);
        if (mmYYYY) {
          const mm = mmYYYY[1].padStart(2, '0');
          expiryIso = `${mmYYYY[2]}-${mm}-28`;
        }
        const mrpPaise = Math.round(parseFloat(editData.mrpRupees) * 100);
        try {
          await apiPost(
            '/inventory/batches',
            {
              medicineId: editingId,
              batchNumber: editData.batchNumber.trim(),
              expiryDate: expiryIso,
              mrpPaise,
              costPricePaise: mrpPaise,
              initialStockUnits: parseInt(editData.stockUnits, 10) || 1,
              rackLocation: editData.rackLocation.trim() || undefined,
            },
            activeStore.storeId
          );
        } catch (batchErr) {
          console.error('Failed to create batch during inline edit:', batchErr);
          alert('Medicine updated, but failed to create batch. Try adding batch separately.');
        }
      }

      if (res.success) {
        setMedicines((prev) => prev.map((m) => (m.id === editingId ? res.medicine : m)));
        cancelInlineEdit();
        setFlashIds((prev) => new Set(prev).add(editingId));
        setTimeout(() => {
          setFlashIds((prev) => {
            const next = new Set(prev);
            next.delete(editingId);
            return next;
          });
        }, 1500);
      }
    } catch (err: unknown) {
      alert(err instanceof ApiError ? err.message : 'Failed to update medicine.');
    }
  };

  // --- FULL DETAIL MODAL (advanced edit) ---
  const handleOpenAdvancedEdit = (medicine: MedicineMaster) => {
    setEditingMedicine(medicine);
    setFormData({
      brandName: medicine.brandName || '',
      genericName: medicine.genericName || '',
      category: medicine.category || CATEGORIES[0],
      dosageForm: medicine.dosageForm || 'Tablet',
      strength: medicine.strength || '',
      manufacturer: medicine.manufacturer || '',
      hsnCode: medicine.hsnCode || '3004',
      gstRateBps: medicine.gstRateBps ?? 0,
      baseUnit: medicine.baseUnit || BaseUnits.TABLET,
      stripSize: medicine.stripSize || 10,
      allowLooseSales: medicine.allowLooseSales ?? true,
      scheduleCategory: medicine.scheduleCategory || ScheduleCategories.NONE,
      rackLocation: medicine.rackLocation || '',
      barcode: medicine.barcode || '',
      reorderLevelUnits: medicine.reorderLevelUnits ?? 50,
    });
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSaveAdvanced = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore || !editingMedicine) return;

    if (!formData.brandName.trim()) {
      setModalError('Brand name is required.');
      return;
    }

    setModalLoading(true);
    setModalError(null);

    try {
      const res = await apiPut<{ success: boolean; medicine: MedicineMaster }>(
        `/inventory/medicines/${editingMedicine.id}`,
        formData,
        activeStore.storeId
      );
      if (res.success) {
        setMedicines((prev) => prev.map((m) => (m.id === editingMedicine.id ? res.medicine : m)));
        setIsModalOpen(false);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) setModalError(err.message);
      else setModalError('Failed to update medicine.');
    } finally {
      setModalLoading(false);
    }
  };

  // --- ARCHIVE ---
  const handleArchive = async (medicine: MedicineMaster) => {
    if (!activeStore) return;
    const confirmed = window.confirm(`Archive "${medicine.brandName}"? It will be hidden from active catalog.`);
    if (!confirmed) return;
    try {
      await apiDelete(`/inventory/medicines/${medicine.id}`, activeStore.storeId);
      setMedicines((prev) => prev.filter((m) => m.id !== medicine.id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to archive medicine.');
    }
  };

  // --- RESTOCK HANDLERS ---
  const openRestock = (med: MedicineMaster) => {
    const batches = medicineBatches[med.id] || [];
    setRestockMed(med);
    setRestockBatch(batches.length > 0 ? batches[0] : null);
    setRestockMode(batches.length > 0 ? 'existing' : 'new');
    setRestockQty('');
    setRestockNewBatch({ batchNumber: '', expiryDate: '', mrpRupees: '' });
    setRestockError(null);
  };

  const closeRestock = () => {
    setRestockMed(null);
    setRestockBatch(null);
    setRestockQty('');
    setRestockError(null);
  };

  const handleRestock = async () => {
    if (!activeStore || !restockMed) return;
    const qty = parseInt(restockQty, 10);
    if (!qty || qty < 1) {
      setRestockError('Enter a valid quantity (minimum 1).');
      return;
    }

    setRestockSaving(true);
    setRestockError(null);

    try {
      if (restockMode === 'existing' && restockBatch) {
        await apiPost(
          '/inventory/batches/adjust',
          {
            batchId: restockBatch.id,
            adjustmentUnits: qty,
            reason: 'Restock / Purchase',
            movementType: 'ADJUSTMENT_ADD',
          },
          activeStore.storeId
        );
      } else {
        if (!restockNewBatch.batchNumber.trim()) {
          setRestockError('Batch number is required.');
          setRestockSaving(false);
          return;
        }
        if (!restockNewBatch.expiryDate.trim()) {
          setRestockError('Expiry date is required.');
          setRestockSaving(false);
          return;
        }
        const mrp = parseFloat(restockNewBatch.mrpRupees);
        if (!mrp || mrp <= 0) {
          setRestockError('Valid MRP is required.');
          setRestockSaving(false);
          return;
        }
        let expiryIso = restockNewBatch.expiryDate.trim();
        const mmYYYY = expiryIso.match(/^(\d{1,2})[\/\-](\d{4})$/);
        if (mmYYYY) {
          expiryIso = `${mmYYYY[2]}-${mmYYYY[1].padStart(2, '0')}-28`;
        }
        const mrpPaise = Math.round(mrp * 100);
        await apiPost(
          '/inventory/batches',
          {
            medicineId: restockMed.id,
            batchNumber: restockNewBatch.batchNumber.trim(),
            expiryDate: expiryIso,
            mrpPaise,
            costPricePaise: mrpPaise,
            initialStockUnits: qty,
            rackLocation: restockMed.rackLocation || '',
          },
          activeStore.storeId
        );
      }
      closeRestock();
      await fetchBatchesForMedicines(medicines);
    } catch (err: unknown) {
      setRestockError(err instanceof ApiError ? err.message : 'Failed to restock.');
    } finally {
      setRestockSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <Head>
        <title>Medicine Register | New Sanjivani Clinic</title>
      </Head>

      <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: 38, height: 38, borderRadius: '10px',
              background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '18px', color: '#ffffff',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)'
            }}>
              💊
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Medicine Register
              </h1>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>
                Quick-add medicines like a spreadsheet. {stats.total} formulations registered{stats.scheduled > 0 ? ` • ${stats.scheduled} scheduled drugs` : ''}.
              </p>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                {[['Ctrl+A', 'Add Row'], ['Enter', 'Save'], ['Esc', 'Cancel']].map(([k, v]) => (
                  <span key={k} style={{ fontSize: '10px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <kbd style={{ padding: '1px 4px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '3px', fontSize: '10px', fontWeight: 600, color: '#475569', fontFamily: 'inherit' }}>{k}</kbd>
                    {v}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <Link
              href="/imports/csv"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', backgroundColor: '#ffffff', color: '#334155',
                border: '1px solid #cbd5e1', borderRadius: '8px',
                fontSize: '13px', fontWeight: 600, textDecoration: 'none',
              }}
            >
              📁 CSV Import
            </Link>
            <button
              onClick={handleAddRow}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', backgroundColor: '#6366f1', color: '#ffffff',
                border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
                cursor: 'pointer', boxShadow: '0 2px 8px rgba(99, 102, 241, 0.25)',
              }}
            >
              + Add Row
            </button>
          </div>
        </div>

        {/* Search */}
        <div style={{
          background: '#ffffff', borderRadius: '10px', padding: '10px 16px',
          border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <span style={{ color: '#94a3b8', fontSize: '15px' }}>🔍</span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search medicines by name, form, or rack location..."
            style={{
              flex: 1, border: 'none', outline: 'none', fontSize: '14px',
              color: '#0f172a', backgroundColor: 'transparent',
            }}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '16px' }}>✕</button>
          )}
        </div>

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px',
            padding: '10px 14px', color: '#b91c1c', fontSize: '13px',
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Spreadsheet Table */}
        <div style={{
          background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0',
          overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <th style={{ ...thStyle, width: '36px', textAlign: 'center' }}>#</th>
                  <th style={{ ...thStyle, minWidth: '180px' }}>Medicine Name</th>
                  <th style={{ ...thStyle, width: '120px' }}>Form</th>
                  <th style={{ ...thStyle, width: '100px' }}>Rack</th>
                  <th style={{ ...thStyle, width: '80px' }}>Units/Strip</th>
                  <th style={{ ...thStyle, width: '100px' }}>MRP/Strip ₹</th>
                  <th style={{ ...thStyle, width: '110px' }}>Batch #</th>
                  <th style={{ ...thStyle, width: '100px' }}>Expiry</th>
                  <th style={{ ...thStyle, width: '70px' }}>Qty</th>
                  <th style={{ ...thStyle, width: '100px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {/* NEW editable rows at top */}
                {newRows.map((row, idx) => (
                  <React.Fragment key={`new-${idx}`}>
                    <tr style={{ backgroundColor: '#f0f4ff', borderBottom: rowErrors[idx] ? 'none' : '1px solid #e2e8f0' }}>
                      <td style={{ ...tdStyle, textAlign: 'center', color: '#6366f1', fontWeight: 700, fontSize: '12px' }}>new</td>
                      <td style={tdStyle}>
                        <input
                          ref={idx === newRows.length - 1 ? nameInputRef : undefined}
                          type="text"
                          placeholder="e.g. Dolo 650"
                          value={row.brandName}
                          onChange={(e) => updateNewRow(idx, 'brandName', e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSaveNewRow(idx); }}
                          style={cellInput}
                        />
                      </td>
                      <td style={tdStyle}>
                        <select value={row.dosageForm} onChange={(e) => updateNewRow(idx, 'dosageForm', e.target.value)} style={cellSelect}>
                          {DOSAGE_FORMS.map((f) => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </td>
                      <td style={tdStyle}>
                        <input type="text" placeholder="A-3" value={row.rackLocation} onChange={(e) => updateNewRow(idx, 'rackLocation', e.target.value)} style={cellInput} />
                      </td>
                      <td style={tdStyle}>
                        <input type="number" min="1" value={row.stripSize} onChange={(e) => updateNewRow(idx, 'stripSize', e.target.value)} style={{ ...cellInput, textAlign: 'center' }} />
                      </td>
                      <td style={tdStyle}>
                        <input type="number" min="0" step="0.5" placeholder="₹" value={row.mrpRupees} onChange={(e) => updateNewRow(idx, 'mrpRupees', e.target.value)} style={{ ...cellInput, textAlign: 'right' }} />
                      </td>
                      <td style={tdStyle}>
                        <input type="text" placeholder="AUG-9912A" value={row.batchNumber} onChange={(e) => updateNewRow(idx, 'batchNumber', e.target.value)} style={cellInput} />
                      </td>
                      <td style={tdStyle}>
                        <input type="text" placeholder="MM/YYYY" value={row.expiryDate} onChange={(e) => updateNewRow(idx, 'expiryDate', e.target.value)} style={{ ...cellInput, textAlign: 'center' }} />
                      </td>
                      <td style={tdStyle}>
                        <input type="number" min="1" value={row.stockUnits} onChange={(e) => updateNewRow(idx, 'stockUnits', e.target.value)} style={{ ...cellInput, textAlign: 'center' }} />
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          <button
                            title="Save (S)"
                            onClick={() => handleSaveNewRow(idx)}
                            disabled={savingIndex === idx}
                            style={iconBtn(savingIndex === idx ? '#94a3b8' : '#059669', '#fff')}
                          >
                            S
                          </button>
                          <button
                            title="Discard row"
                            onClick={() => removeNewRow(idx)}
                            style={iconBtn('#fee2e2', '#dc2626')}
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                    {rowErrors[idx] && (
                      <tr style={{ backgroundColor: '#fef2f2' }}>
                        <td colSpan={10} style={{ padding: '4px 8px 6px 44px', fontSize: '12px', color: '#dc2626', borderBottom: '1px solid #fecaca' }}>
                          ⚠️ {rowErrors[idx]}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}

                {/* Existing medicines */}
                {loading ? (
                  <tr>
                    <td colSpan={10} style={{ padding: '48px 20px', textAlign: 'center', color: '#64748b' }}>
                      Loading medicine register...
                    </td>
                  </tr>
                ) : filteredMedicines.length === 0 && newRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: '48px 20px', textAlign: 'center' }}>
                      <div style={{ fontSize: '32px', marginBottom: '8px' }}>💊</div>
                      <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '15px' }}>No medicines registered yet</div>
                      <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                        Click "+ Add Row" to start adding medicines like a spreadsheet.
                      </div>
                      <button
                        onClick={handleAddRow}
                        style={{
                          marginTop: '14px', padding: '8px 18px', backgroundColor: '#6366f1',
                          color: '#ffffff', border: 'none', borderRadius: '8px',
                          fontSize: '13px', fontWeight: 600, cursor: 'pointer'
                        }}
                      >
                        + Add First Medicine
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredMedicines.map((med, index) => {
                    const isEditing = editingId === med.id;
                    const isFlash = flashIds.has(med.id);

                    if (isEditing) {
                      return (
                        <tr key={med.id} style={{ backgroundColor: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
                          <td style={{ ...tdStyle, textAlign: 'center', color: '#64748b', fontSize: '12px' }}>{index + 1}</td>
                          <td style={tdStyle}>
                            <input type="text" value={editData.brandName} onChange={(e) => setEditData({ ...editData, brandName: e.target.value })} style={cellInput} />
                          </td>
                          <td style={tdStyle}>
                            <select value={editData.dosageForm} onChange={(e) => setEditData({ ...editData, dosageForm: e.target.value })} style={cellSelect}>
                              {DOSAGE_FORMS.map((f) => <option key={f} value={f}>{f}</option>)}
                            </select>
                          </td>
                          <td style={tdStyle}>
                            <input type="text" value={editData.rackLocation} onChange={(e) => setEditData({ ...editData, rackLocation: e.target.value })} style={cellInput} />
                          </td>
                          <td style={tdStyle}>
                            <input type="number" min="1" value={editData.stripSize} onChange={(e) => setEditData({ ...editData, stripSize: e.target.value })} style={{ ...cellInput, textAlign: 'center' }} />
                          </td>
                          <td style={tdStyle}>
                            <input type="number" min="0" step="0.5" placeholder="₹" value={editData.mrpRupees} onChange={(e) => setEditData({ ...editData, mrpRupees: e.target.value })} style={{ ...cellInput, textAlign: 'right' }} />
                          </td>
                          <td style={tdStyle}>
                            <input type="text" placeholder="Batch #" value={editData.batchNumber} onChange={(e) => setEditData({ ...editData, batchNumber: e.target.value })} style={cellInput} />
                          </td>
                          <td style={tdStyle}>
                            <input type="text" placeholder="MM/YYYY" value={editData.expiryDate} onChange={(e) => setEditData({ ...editData, expiryDate: e.target.value })} style={{ ...cellInput, textAlign: 'center' }} />
                          </td>
                          <td style={tdStyle}>
                            <input type="number" min="1" value={editData.stockUnits} onChange={(e) => setEditData({ ...editData, stockUnits: e.target.value })} style={{ ...cellInput, textAlign: 'center' }} />
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              <button title="Save (S)" onClick={saveInlineEdit} style={iconBtn('#059669', '#fff')}>S</button>
                              <button title="Cancel" onClick={cancelInlineEdit} style={iconBtn('#f1f5f9', '#64748b')}>✕</button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr
                        key={med.id}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          backgroundColor: isFlash ? '#f0fdf4' : '#ffffff',
                          transition: 'background-color 0.5s ease',
                        }}
                      >
                        <td style={{ ...tdStyle, textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>{index + 1}</td>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '14px' }}>{med.brandName}</div>
                          {med.genericName && med.genericName !== med.brandName && (
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>{med.genericName}</div>
                          )}
                        </td>
                        <td style={{ ...tdStyle, color: '#334155' }}>{med.dosageForm}</td>
                        <td style={tdStyle}>
                          {med.rackLocation ? (
                            <span style={{
                              padding: '2px 7px', borderRadius: '4px',
                              backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0',
                              fontSize: '11px', fontWeight: 600, color: '#475569'
                            }}>
                              {med.rackLocation}
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#cbd5e1' }}>—</span>
                          )}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600 }}>{med.stripSize}</td>
                        {(() => {
                          const batches = medicineBatches[med.id] || [];
                          const topBatch = batches.length > 0 ? batches[0] : null;
                          const totalStock = batches.reduce((sum, b) => sum + b.stockUnits, 0);
                          if (!topBatch) {
                            return (
                              <>
                                <td style={{ ...tdStyle, textAlign: 'center', color: '#dc2626', fontSize: '12px' }}>₹0</td>
                                <td style={{ ...tdStyle, textAlign: 'center', color: '#dc2626', fontSize: '12px' }}>No batch</td>
                                <td style={{ ...tdStyle, textAlign: 'center', color: '#dc2626', fontSize: '12px' }}>—</td>
                                <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700, color: '#dc2626' }}>0</td>
                              </>
                            );
                          }
                          const mrpRs = (topBatch.mrpPaise / 100).toFixed(2);
                          const expParts = topBatch.expiryDate.split('-');
                          const expiryDisplay = expParts.length >= 2 ? `${expParts[1]}/${expParts[0]}` : topBatch.expiryDate;
                          return (
                            <>
                              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>₹{mrpRs}</td>
                              <td style={{ ...tdStyle, textAlign: 'center', color: '#334155', fontSize: '12px' }}>{topBatch.batchNumber}</td>
                              <td style={{ ...tdStyle, textAlign: 'center', color: '#334155', fontSize: '12px' }}>{expiryDisplay}</td>
                              <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700, color: totalStock > 0 ? '#059669' : '#dc2626' }}>{totalStock}</td>
                            </>
                          );
                        })()}
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            <button title="Restock (+)" onClick={() => openRestock(med)} style={iconBtn('#ecfdf5', '#059669')}>+</button>
                            <button title="Edit inline (E)" onClick={() => startInlineEdit(med)} style={iconBtn('#eff6ff', '#2563eb')}>E</button>
                            <button title="Advanced edit" onClick={() => handleOpenAdvancedEdit(med)} style={iconBtn('#f5f3ff', '#7c3aed')}>⚙</button>
                            <button title="Delete (D)" onClick={() => handleArchive(med)} style={iconBtn('#fef2f2', '#dc2626')}>D</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer: Add Row Button */}
          <div style={{
            padding: '10px 16px', borderTop: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <button
              onClick={handleAddRow}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 14px', backgroundColor: '#ffffff',
                border: '1px dashed #6366f1', borderRadius: '6px',
                color: '#6366f1', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              + Add Row
            </button>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              Fill details and press S to save each row • Press Enter in medicine name to quick-save
            </span>
          </div>
        </div>
      </div>

      {/* Advanced Edit Modal (full details) */}
      {isModalOpen && editingMedicine && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '16px', maxWidth: '600px', width: '100%',
            maxHeight: '90vh', overflowY: 'auto', border: '1px solid #e2e8f0',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          }}>
            <div style={{
              padding: '18px 24px', borderBottom: '1px solid #e2e8f0',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              backgroundColor: '#f8fafc', borderTopLeftRadius: '16px', borderTopRightRadius: '16px'
            }}>
              <div>
                <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Advanced Edit: {editingMedicine.brandName}
                </h2>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                  Edit all fields including generic name, category, schedule, barcode, etc.
                </p>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleSaveAdvanced} style={{ padding: '20px 24px' }}>
              {modalError && (
                <div style={{ marginBottom: '16px', backgroundColor: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px', color: '#b91c1c', fontSize: '13px' }}>
                  {modalError}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Brand Name *</label>
                  <input type="text" required value={formData.brandName} onChange={(e) => setFormData({ ...formData, brandName: e.target.value })} style={cellInput} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Generic / Salt Name</label>
                  <input type="text" value={formData.genericName} onChange={(e) => setFormData({ ...formData, genericName: e.target.value })} style={cellInput} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Dosage Form</label>
                  <select value={formData.dosageForm} onChange={(e) => setFormData({ ...formData, dosageForm: e.target.value })} style={cellSelect}>
                    {DOSAGE_FORMS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Strength</label>
                  <input type="text" placeholder="e.g. 650mg" value={formData.strength} onChange={(e) => setFormData({ ...formData, strength: e.target.value })} style={cellInput} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Category</label>
                  <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} style={cellSelect}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Manufacturer</label>
                  <input type="text" value={formData.manufacturer || ''} onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })} style={cellInput} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Units per Strip</label>
                  <input type="number" min={1} value={formData.stripSize} onChange={(e) => setFormData({ ...formData, stripSize: parseInt(e.target.value, 10) || 1 })} style={cellInput} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Base Unit</label>
                  <select value={formData.baseUnit} onChange={(e) => setFormData({ ...formData, baseUnit: e.target.value as BaseUnit })} style={cellSelect}>
                    <option value={BaseUnits.TABLET}>Tablet</option>
                    <option value={BaseUnits.CAPSULE}>Capsule</option>
                    <option value={BaseUnits.ML}>ML (Liquid)</option>
                    <option value={BaseUnits.VIAL}>Vial</option>
                    <option value={BaseUnits.BOTTLE}>Bottle</option>
                    <option value={BaseUnits.PIECE}>Piece</option>
                    <option value={BaseUnits.SACHET}>Sachet</option>
                    <option value={BaseUnits.TUBE}>Tube</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Schedule Category</label>
                  <select value={formData.scheduleCategory} onChange={(e) => setFormData({ ...formData, scheduleCategory: e.target.value as any })} style={cellSelect}>
                    <option value="NONE">Regular (None)</option>
                    <option value="H">Schedule H</option>
                    <option value="H1">Schedule H1</option>
                    <option value="X">Schedule X</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Rack Location</label>
                  <input type="text" value={formData.rackLocation || ''} onChange={(e) => setFormData({ ...formData, rackLocation: e.target.value })} style={cellInput} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Barcode / EAN</label>
                  <input type="text" value={formData.barcode || ''} onChange={(e) => setFormData({ ...formData, barcode: e.target.value })} style={cellInput} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>HSN Code</label>
                  <input type="text" value={formData.hsnCode} onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })} style={cellInput} />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px' }}>
                <input type="checkbox" id="looseSalesAdv" checked={formData.allowLooseSales} onChange={(e) => setFormData({ ...formData, allowLooseSales: e.target.checked })} style={{ width: 16, height: 16 }} />
                <label htmlFor="looseSalesAdv" style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', cursor: 'pointer' }}>Allow loose unit sales</label>
              </div>

              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '8px 16px', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" disabled={modalLoading} style={{ padding: '8px 20px', backgroundColor: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: modalLoading ? 0.7 : 1 }}>
                  {modalLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Restock Modal */}
      {restockMed && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)',
          zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '16px', maxWidth: '420px', width: '100%',
            border: '1px solid #e2e8f0', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          }}>
            <div style={{
              padding: '18px 24px', borderBottom: '1px solid #e2e8f0',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              backgroundColor: '#f0fdf4', borderTopLeftRadius: '16px', borderTopRightRadius: '16px'
            }}>
              <div>
                <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Restock: {restockMed.brandName}
                </h2>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                  Add inventory to this medicine
                </p>
              </div>
              <button onClick={closeRestock} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {restockError && (
                <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px', color: '#b91c1c', fontSize: '13px' }}>
                  {restockError}
                </div>
              )}

              {/* Mode toggle: existing batch vs new batch */}
              {restockBatch && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setRestockMode('existing')}
                    style={{
                      flex: 1, padding: '8px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                      border: restockMode === 'existing' ? '2px solid #059669' : '1px solid #cbd5e1',
                      backgroundColor: restockMode === 'existing' ? '#ecfdf5' : '#fff',
                      color: restockMode === 'existing' ? '#059669' : '#64748b',
                    }}
                  >
                    Add to existing batch
                  </button>
                  <button
                    onClick={() => setRestockMode('new')}
                    style={{
                      flex: 1, padding: '8px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                      border: restockMode === 'new' ? '2px solid #6366f1' : '1px solid #cbd5e1',
                      backgroundColor: restockMode === 'new' ? '#eef2ff' : '#fff',
                      color: restockMode === 'new' ? '#6366f1' : '#64748b',
                    }}
                  >
                    New batch
                  </button>
                </div>
              )}

              {restockMode === 'existing' && restockBatch && (
                <div style={{ backgroundColor: '#f8fafc', borderRadius: '8px', padding: '10px 14px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Batch:</span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{restockBatch.batchNumber}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                    <span style={{ color: '#64748b' }}>Current stock:</span>
                    <span style={{ fontWeight: 700, color: restockBatch.stockUnits > 0 ? '#059669' : '#dc2626' }}>{restockBatch.stockUnits} units</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                    <span style={{ color: '#64748b' }}>MRP:</span>
                    <span style={{ fontWeight: 600 }}>₹{(restockBatch.mrpPaise / 100).toFixed(2)}</span>
                  </div>
                </div>
              )}

              {restockMode === 'new' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Batch Number *</label>
                    <input type="text" placeholder="e.g. AUG-9912A" value={restockNewBatch.batchNumber} onChange={(e) => setRestockNewBatch({ ...restockNewBatch, batchNumber: e.target.value })} style={cellInput} />
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>MRP/Strip ₹ *</label>
                      <input type="number" min="0" step="0.5" placeholder="₹" value={restockNewBatch.mrpRupees} onChange={(e) => setRestockNewBatch({ ...restockNewBatch, mrpRupees: e.target.value })} style={cellInput} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Expiry *</label>
                      <input type="text" placeholder="MM/YYYY" value={restockNewBatch.expiryDate} onChange={(e) => setRestockNewBatch({ ...restockNewBatch, expiryDate: e.target.value })} style={cellInput} />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Quantity to add *
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="Enter units to add"
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleRestock(); }}
                  autoFocus
                  style={{ ...cellInput, fontSize: '16px', padding: '10px 12px', textAlign: 'center', fontWeight: 700 }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <button onClick={closeRestock} style={{ flex: 1, padding: '10px', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={handleRestock} disabled={restockSaving} style={{
                  flex: 1, padding: '10px', backgroundColor: '#059669', color: '#fff',
                  border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
                  cursor: 'pointer', opacity: restockSaving ? 0.7 : 1,
                }}>
                  {restockSaving ? 'Adding...' : `+ Add Stock`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
