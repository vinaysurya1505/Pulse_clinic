'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { useStore } from '@/context/StoreContext';
import { apiGet, apiPost, apiPut, apiDelete, ApiError } from '@/lib/api';
import {
  MedicineMaster,
  CreateMedicineInput,
  BaseUnits,
  BaseUnit,
  ScheduleCategories,
  ScheduleCategory,
} from '@pulseclinic/types';

interface MedicineListResponse {
  success: boolean;
  medicines: MedicineMaster[];
  nextCursor?: string;
}

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

const GST_SLABS = [
  { label: '0% (Exempt)', bps: 0 },
  { label: '5% (Essential)', bps: 500 },
  { label: '12% (Standard Pharma)', bps: 1200 },
  { label: '18% (Supplements/Cosmeceuticals)', bps: 1800 },
  { label: '28% (Special)', bps: 2800 },
];

export default function MedicinesPage() {
  const { activeStore } = useStore();
  const [medicines, setMedicines] = useState<MedicineMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [scheduleFilter, setScheduleFilter] = useState<string>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<MedicineMaster | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Form Fields
  const [formData, setFormData] = useState<CreateMedicineInput>({
    brandName: '',
    genericName: '',
    category: CATEGORIES[0],
    dosageForm: 'Tablet',
    strength: '500mg',
    manufacturer: '',
    hsnCode: '3004',
    gstRateBps: 1200,
    baseUnit: BaseUnits.TABLET,
    stripSize: 10,
    allowLooseSales: true,
    scheduleCategory: ScheduleCategories.NONE,
    rackLocation: 'Rack A-1',
    barcode: '',
    reorderLevelUnits: 50,
  });

  const fetchMedicines = async () => {
    if (!activeStore) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<MedicineListResponse>(
        `/inventory/medicines?limit=100${categoryFilter !== 'ALL' ? `&category=${encodeURIComponent(categoryFilter)}` : ''}${scheduleFilter !== 'ALL' ? `&scheduleCategory=${scheduleFilter}` : ''}`,
        activeStore.storeId
      );
      if (res.success) {
        setMedicines(res.medicines || []);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load medicines from catalog.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedicines();
  }, [activeStore?.storeId, categoryFilter, scheduleFilter]);

  // Client-side search filtering
  const filteredMedicines = useMemo(() => {
    if (!searchTerm.trim()) return medicines;
    const term = searchTerm.toLowerCase().trim();
    return medicines.filter(
      (m) =>
        m.brandName?.toLowerCase().includes(term) ||
        m.genericName?.toLowerCase().includes(term) ||
        m.barcode?.toLowerCase().includes(term) ||
        m.hsnCode?.toLowerCase().includes(term) ||
        m.rackLocation?.toLowerCase().includes(term)
    );
  }, [medicines, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    const total = medicines.length;
    const looseEnabled = medicines.filter((m) => m.allowLooseSales).length;
    const scheduled = medicines.filter((m) => m.scheduleCategory !== 'NONE').length;
    const categoriesCount = new Set(medicines.map((m) => m.category)).size;
    return { total, looseEnabled, scheduled, categoriesCount };
  }, [medicines]);

  const handleOpenAddModal = () => {
    setEditingMedicine(null);
    setFormData({
      brandName: '',
      genericName: '',
      category: CATEGORIES[0],
      dosageForm: 'Tablet',
      strength: '500mg',
      manufacturer: '',
      hsnCode: '3004',
      gstRateBps: 1200,
      baseUnit: BaseUnits.TABLET,
      stripSize: 10,
      allowLooseSales: true,
      scheduleCategory: ScheduleCategories.NONE,
      rackLocation: 'Rack A-1',
      barcode: '',
      reorderLevelUnits: 50,
    });
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (medicine: MedicineMaster) => {
    setEditingMedicine(medicine);
    setFormData({
      brandName: medicine.brandName || '',
      genericName: medicine.genericName || '',
      category: medicine.category || CATEGORIES[0],
      dosageForm: medicine.dosageForm || 'Tablet',
      strength: medicine.strength || '',
      manufacturer: medicine.manufacturer || '',
      hsnCode: medicine.hsnCode || '3004',
      gstRateBps: medicine.gstRateBps ?? 1200,
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

  const handleSaveMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore) return;

    if (!formData.brandName.trim() || !formData.genericName.trim()) {
      setModalError('Brand name and generic name are required.');
      return;
    }
    if (formData.stripSize <= 0) {
      setModalError('Strip size must be at least 1 unit.');
      return;
    }

    setModalLoading(true);
    setModalError(null);

    try {
      if (editingMedicine) {
        // Update
        const res = await apiPut<{ success: boolean; medicine: MedicineMaster }>(
          `/inventory/medicines/${editingMedicine.id}`,
          formData,
          activeStore.storeId
        );
        if (res.success) {
          setMedicines((prev) => prev.map((m) => (m.id === editingMedicine.id ? res.medicine : m)));
          setIsModalOpen(false);
        }
      } else {
        // Create
        const res = await apiPost<{ success: boolean; medicine: MedicineMaster }>(
          `/inventory/medicines`,
          formData,
          activeStore.storeId
        );
        if (res.success) {
          setMedicines((prev) => [res.medicine, ...prev]);
          setIsModalOpen(false);
        }
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setModalError(err.message);
      } else {
        setModalError('Failed to save medicine entry.');
      }
    } finally {
      setModalLoading(false);
    }
  };

  const handleArchive = async (medicine: MedicineMaster) => {
    if (!activeStore) return;
    const confirmed = window.confirm(
      `Are you sure you want to archive "${medicine.brandName}"? It will be safely hidden from active catalogues.`
    );
    if (!confirmed) return;

    try {
      await apiDelete(`/inventory/medicines/${medicine.id}`, activeStore.storeId);
      setMedicines((prev) => prev.filter((m) => m.id !== medicine.id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to archive medicine.');
    }
  };

  return (
    <DashboardLayout>
      <Head>
        <title>Medicine Master Catalog | PulseClinic</title>
        <meta name="description" content="Manage clinical medicine catalog, units, schedule classification, and GST tax codes." />
      </Head>

      <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)'
              }}>
                💊
              </div>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Medicine Master Catalog
                </h1>
                <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>
                  Manage formulary specifications, unit-to-pack conversions (ADR-010), Schedule H/H1 compliance, and tax slabs.
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleOpenAddModal}
              id="add-medicine-btn"
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
              <span>+ Add Medicine</span>
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
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Total Formulations</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>{stats.total}</div>
            <div style={{ fontSize: '12px', color: '#10b981', marginTop: '4px', fontWeight: 500 }}>Active in store catalog</div>
          </div>

          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            padding: '16px 20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Loose Unit Sales</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>{stats.looseEnabled}</div>
            <div style={{ fontSize: '12px', color: '#3b82f6', marginTop: '4px', fontWeight: 500 }}>Sellable by individual unit</div>
          </div>

          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            padding: '16px 20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Scheduled Drugs (H / H1 / X)</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: stats.scheduled > 0 ? '#f59e0b' : '#0f172a', marginTop: '6px' }}>
              {stats.scheduled}
            </div>
            <div style={{ fontSize: '12px', color: '#f59e0b', marginTop: '4px', fontWeight: 500 }}>Requires Doctor Prescription</div>
          </div>

          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            padding: '16px 20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Therapeutic Categories</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>{stats.categoriesCount}</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', fontWeight: 500 }}>Formulary groups configured</div>
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
                placeholder="Search by Brand Name, Generic Molecule, Barcode, or Rack..."
                id="medicine-search-input"
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  color: '#0f172a',
                  backgroundColor: '#ffffff',
                  outline: 'none',
                  transition: 'border-color 0.15s ease',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Category Dropdown */}
            <div style={{ flex: '0 0 auto', minWidth: '220px' }}>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
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
                <option value="ALL">All Categories</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Schedule Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', marginRight: '4px' }}>
              Regulatory Schedule:
            </span>
            {[
              { id: 'ALL', label: 'All Medicines' },
              { id: 'NONE', label: 'Regular (Non-scheduled)' },
              { id: 'H', label: 'Schedule H' },
              { id: 'H1', label: 'Schedule H1 (High Risk)' },
              { id: 'X', label: 'Schedule X (Strict Narcotic)' },
            ].map((pill) => {
              const active = scheduleFilter === pill.id;
              return (
                <button
                  key={pill.id}
                  onClick={() => setScheduleFilter(pill.id)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '9999px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: active ? '1px solid #6366f1' : '1px solid #e2e8f0',
                    backgroundColor: active ? 'rgba(99, 102, 241, 0.1)' : '#f8fafc',
                    color: active ? '#4f46e5' : '#64748b',
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

        {/* Medicines Table */}
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
                  <th style={{ padding: '14px 16px' }}>Category & Location</th>
                  <th style={{ padding: '14px 16px' }}>Pack & Unit Model</th>
                  <th style={{ padding: '14px 16px' }}>GST & HSN</th>
                  <th style={{ padding: '14px 16px' }}>Schedule</th>
                  <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody style={{ fontSize: '14px', color: '#1e293b' }}>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '48px 20px', textAlign: 'center', color: '#64748b' }}>
                      <div style={{ display: 'inline-block', width: 24, height: 24, border: '3px solid #cbd5e1', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                      <div style={{ marginTop: '10px', fontSize: '14px' }}>Loading medicine registry...</div>
                    </td>
                  </tr>
                ) : filteredMedicines.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '48px 20px', textAlign: 'center' }}>
                      <div style={{ fontSize: '40px' }}>💊</div>
                      <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '8px', fontSize: '16px' }}>
                        No medicines match your filter
                      </div>
                      <div style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>
                        Click &quot;+ Add Medicine&quot; to register your first pharmaceutical product.
                      </div>
                      <button
                        onClick={handleOpenAddModal}
                        style={{
                          marginTop: '16px',
                          padding: '8px 18px',
                          backgroundColor: '#6366f1',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        + Add First Medicine
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredMedicines.map((med, index) => {
                    return (
                      <tr
                        key={med.id}
                        style={{
                          borderBottom: index === filteredMedicines.length - 1 ? 'none' : '1px solid #f1f5f9',
                          transition: 'background-color 0.15s ease',
                          backgroundColor: '#ffffff'
                        }}
                      >
                        {/* Brand & Generic Name */}
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                              width: 34,
                              height: 34,
                              borderRadius: '8px',
                              backgroundColor: '#f1f5f9',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              color: '#6366f1',
                              fontSize: '13px'
                            }}>
                              {med.dosageForm.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '15px' }}>
                                {med.brandName}
                              </div>
                              <div style={{ fontSize: '13px', color: '#64748b', display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                                <span>{med.genericName}</span>
                                <span>•</span>
                                <span style={{ fontWeight: 500, color: '#334155' }}>{med.strength}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Category & Rack */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
                            {med.category}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                            {med.rackLocation ? (
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                backgroundColor: '#f1f5f9',
                                border: '1px solid #e2e8f0',
                                fontSize: '11px',
                                fontWeight: 600,
                                color: '#475569'
                              }}>
                                📍 {med.rackLocation}
                              </span>
                            ) : (
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Unassigned rack</span>
                            )}
                            {med.barcode && (
                              <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                                🏷️ {med.barcode}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Pack & Base Unit */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                            1 Pack = {med.stripSize} {med.baseUnit.toLowerCase()}s
                          </div>
                          <div style={{ marginTop: '4px' }}>
                            {med.allowLooseSales ? (
                              <span style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                color: '#16a34a',
                                backgroundColor: '#f0fdf4',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                border: '1px solid #bbf7d0'
                              }}>
                                ✓ Loose Sales Allowed
                              </span>
                            ) : (
                              <span style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                color: '#b45309',
                                backgroundColor: '#fffbeb',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                border: '1px solid #fde68a'
                              }}>
                                ⚠️ Full Pack Only
                              </span>
                            )}
                          </div>
                        </td>

                        {/* GST & HSN */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                            {med.gstRateBps / 100}% GST
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                            HSN: {med.hsnCode}
                          </div>
                        </td>

                        {/* Schedule Badge */}
                        <td style={{ padding: '14px 16px' }}>
                          {med.scheduleCategory === 'NONE' ? (
                            <span style={{
                              padding: '3px 10px',
                              borderRadius: '9999px',
                              fontSize: '12px',
                              fontWeight: 600,
                              backgroundColor: '#f1f5f9',
                              color: '#475569'
                            }}>
                              Regular
                            </span>
                          ) : med.scheduleCategory === 'H' ? (
                            <span style={{
                              padding: '3px 10px',
                              borderRadius: '9999px',
                              fontSize: '12px',
                              fontWeight: 600,
                              backgroundColor: '#fef3c7',
                              color: '#b45309',
                              border: '1px solid #fde68a'
                            }}>
                              Schedule H
                            </span>
                          ) : med.scheduleCategory === 'H1' ? (
                            <span style={{
                              padding: '3px 10px',
                              borderRadius: '9999px',
                              fontSize: '12px',
                              fontWeight: 600,
                              backgroundColor: '#fee2e2',
                              color: '#b91c1c',
                              border: '1px solid #fecaca'
                            }}>
                              Schedule H1
                            </span>
                          ) : (
                            <span style={{
                              padding: '3px 10px',
                              borderRadius: '9999px',
                              fontSize: '12px',
                              fontWeight: 600,
                              backgroundColor: '#f3e8ff',
                              color: '#7e22ce',
                              border: '1px solid #e9d5ff'
                            }}>
                              Schedule X
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '8px' }}>
                            <button
                              onClick={() => handleOpenEditModal(med)}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontWeight: 500,
                                color: '#334155',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleArchive(med)}
                              style={{
                                padding: '6px 10px',
                                backgroundColor: '#ffffff',
                                border: '1px solid #fecaca',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontWeight: 500,
                                color: '#dc2626',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              Archive
                            </button>
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

        {/* Modal: Add / Edit Medicine */}
        {isModalOpen && (
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
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              border: '1px solid #e2e8f0'
            }}>
              {/* Modal Header */}
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
                    {editingMedicine ? `Edit Medicine: ${editingMedicine.brandName}` : 'Add New Medicine to Formulary'}
                  </h2>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
                    Enter formulation details, strip packaging rules, and legal classifications.
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '20px',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '4px 8px'
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleSaveMedicine} style={{ padding: '24px' }}>
                {modalError && (
                  <div style={{
                    marginBottom: '20px',
                    backgroundColor: '#fee2e2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    padding: '12px',
                    color: '#b91c1c',
                    fontSize: '13px'
                  }}>
                    {modalError}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Section 1: Basic Formulation */}
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                      1. Brand & Formulation
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                          Brand Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.brandName}
                          onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                          placeholder="e.g. Dolo 650, Augmentin"
                          style={{
                            width: '100%',
                            padding: '9px 12px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '14px',
                            color: '#0f172a',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                          Generic Molecule *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.genericName}
                          onChange={(e) => setFormData({ ...formData, genericName: e.target.value })}
                          placeholder="e.g. Paracetamol, Amoxicillin + Clav"
                          style={{
                            width: '100%',
                            padding: '9px 12px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '14px',
                            color: '#0f172a',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                          Dosage Form *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.dosageForm}
                          onChange={(e) => setFormData({ ...formData, dosageForm: e.target.value })}
                          placeholder="e.g. Tablet, Capsule, Syrup, Cream"
                          style={{
                            width: '100%',
                            padding: '9px 12px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '14px',
                            color: '#0f172a',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                          Strength *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.strength}
                          onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
                          placeholder="e.g. 650mg, 625mg, 200mg/5ml"
                          style={{
                            width: '100%',
                            padding: '9px 12px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '14px',
                            color: '#0f172a',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                          Therapeutic Category
                        </label>
                        <select
                          value={formData.category}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
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
                          {CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Pack & Unit Model */}
                  <div style={{ paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                      2. Pack & Unit Model (ADR-010)
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                          Smallest Base Unit *
                        </label>
                        <select
                          value={formData.baseUnit}
                          onChange={(e) => setFormData({ ...formData, baseUnit: e.target.value as BaseUnit })}
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
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                          Units per Strip / Pack *
                        </label>
                        <input
                          type="number"
                          min={1}
                          required
                          value={formData.stripSize}
                          onChange={(e) => setFormData({ ...formData, stripSize: parseInt(e.target.value, 10) || 1 })}
                          style={{
                            width: '100%',
                            padding: '9px 12px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '14px',
                            color: '#0f172a',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                      <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                        <input
                          type="checkbox"
                          id="allowLooseSalesCheck"
                          checked={formData.allowLooseSales}
                          onChange={(e) => setFormData({ ...formData, allowLooseSales: e.target.checked })}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        <label htmlFor="allowLooseSalesCheck" style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', cursor: 'pointer' }}>
                          Allow Loose Unit Sales (Cashier can sell individual {formData.baseUnit.toLowerCase()}s without full strip)
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Regulatory & Tax */}
                  <div style={{ paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                      3. Regulatory & GST Classification
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                          Drug Schedule *
                        </label>
                        <select
                          value={formData.scheduleCategory}
                          onChange={(e) => setFormData({ ...formData, scheduleCategory: e.target.value as ScheduleCategory })}
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
                          <option value={ScheduleCategories.NONE}>Regular (Over-The-Counter / Non-scheduled)</option>
                          <option value={ScheduleCategories.H}>Schedule H (Mandatory Rx)</option>
                          <option value={ScheduleCategories.H1}>Schedule H1 (Critical Antibiotic / Habit Forming)</option>
                          <option value={ScheduleCategories.X}>Schedule X (Psychotropic / Strict Narcotic)</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                          GST Tax Slab *
                        </label>
                        <select
                          value={formData.gstRateBps}
                          onChange={(e) => setFormData({ ...formData, gstRateBps: parseInt(e.target.value, 10) })}
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
                          {GST_SLABS.map((slab) => (
                            <option key={slab.bps} value={slab.bps}>
                              {slab.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                          HSN Code *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.hsnCode}
                          onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })}
                          placeholder="e.g. 3004"
                          style={{
                            width: '100%',
                            padding: '9px 12px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '14px',
                            color: '#0f172a',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                          Manufacturer / Marketer
                        </label>
                        <input
                          type="text"
                          value={formData.manufacturer || ''}
                          onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                          placeholder="e.g. Micro Labs Ltd, GSK"
                          style={{
                            width: '100%',
                            padding: '9px 12px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '14px',
                            color: '#0f172a',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 4: Physical Storage & Alerts */}
                  <div style={{ paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                      4. Storage Location & Reorder Alert
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                          Physical Rack Location
                        </label>
                        <input
                          type="text"
                          value={formData.rackLocation || ''}
                          onChange={(e) => setFormData({ ...formData, rackLocation: e.target.value })}
                          placeholder="e.g. Rack B-4, Drawer 2"
                          style={{
                            width: '100%',
                            padding: '9px 12px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '14px',
                            color: '#0f172a',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                          Barcode / EAN
                        </label>
                        <input
                          type="text"
                          value={formData.barcode || ''}
                          onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                          placeholder="e.g. 890111728101"
                          style={{
                            width: '100%',
                            padding: '9px 12px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '14px',
                            color: '#0f172a',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                          Reorder Threshold (Units)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={formData.reorderLevelUnits || 50}
                          onChange={(e) => setFormData({ ...formData, reorderLevelUnits: parseInt(e.target.value, 10) || 0 })}
                          style={{
                            width: '100%',
                            padding: '9px 12px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '14px',
                            color: '#0f172a',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
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
                    onClick={() => setIsModalOpen(false)}
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
                    disabled={modalLoading}
                    id="submit-medicine-btn"
                    style={{
                      padding: '10px 24px',
                      backgroundColor: '#6366f1',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: modalLoading ? 'not-allowed' : 'pointer',
                      opacity: modalLoading ? 0.7 : 1,
                      boxShadow: '0 2px 8px rgba(99, 102, 241, 0.25)'
                    }}
                  >
                    {modalLoading ? 'Saving...' : editingMedicine ? 'Update Formulation' : 'Create Formulation'}
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
