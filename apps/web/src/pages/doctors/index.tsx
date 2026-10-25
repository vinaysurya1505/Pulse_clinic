'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { useStore } from '@/context/StoreContext';
import { apiGet, apiPost, apiPut, ApiError } from '@/lib/api';
import { DoctorProfile, CreateDoctorInput } from '@pulseclinic/types';

interface DoctorListResponse {
  success: boolean;
  doctors: DoctorProfile[];
  nextCursor?: string;
}

export default function DoctorsPage() {
  const { activeStore } = useStore();
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Add / Edit Doctor Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<DoctorProfile | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formHospitalClinic, setFormHospitalClinic] = useState('');
  const [formCommissionEnabled, setFormCommissionEnabled] = useState(false);
  const [formCommissionPercent, setFormCommissionPercent] = useState('0');

  const fetchDoctors = async () => {
    if (!activeStore) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<DoctorListResponse>('/doctors?limit=100', activeStore.storeId);
      if (res.success) {
        setDoctors(res.doctors || []);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to load doctor registry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, [activeStore?.storeId]);

  // Keyboard shortcut: Alt+D to open Add Doctor modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        openAddModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const openAddModal = () => {
    setEditingDoctor(null);
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormHospitalClinic('');
    setFormCommissionEnabled(false);
    setFormCommissionPercent('0');
    setModalError(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (doc: DoctorProfile) => {
    setEditingDoctor(doc);
    setFormName(doc.name);
    setFormPhone(doc.phone || '');
    setFormEmail(doc.email || '');
    setFormHospitalClinic(doc.hospitalClinic || '');
    setFormCommissionEnabled(doc.commissionEnabled === true);
    setFormCommissionPercent(((doc.commissionBps || 0) / 100).toString());
    setModalError(null);
    setIsAddModalOpen(true);
  };

  const handleSaveDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore) return;
    setModalLoading(true);
    setModalError(null);

    const commissionBps = formCommissionEnabled
      ? Math.round(parseFloat(formCommissionPercent || '0') * 100)
      : 0;

    if (formCommissionEnabled) {
      if (isNaN(commissionBps) || commissionBps < 0 || commissionBps > 10000) {
        setModalError('Commission rate must be between 0% and 100%.');
        setModalLoading(false);
        return;
      }
    }

    try {
      if (editingDoctor) {
        await apiPut(
          `/doctors/${editingDoctor.id}`,
          {
            name: formName.trim(),
            phone: formPhone.trim() || undefined,
            email: formEmail.trim() || undefined,
            hospitalClinic: formHospitalClinic.trim() || undefined,
            commissionBps,
            commissionEnabled: formCommissionEnabled,
          },
          activeStore.storeId
        );
      } else {
        const payload: CreateDoctorInput = {
          name: formName.trim(),
          phone: formPhone.trim() || undefined,
          email: formEmail.trim() || undefined,
          hospitalClinic: formHospitalClinic.trim() || undefined,
          commissionBps,
          commissionEnabled: formCommissionEnabled,
        };
        await apiPost('/doctors', payload, activeStore.storeId);
      }

      setIsAddModalOpen(false);
      fetchDoctors();
    } catch (err: unknown) {
      if (err instanceof ApiError) setModalError(err.message);
      else setModalError('Failed to save doctor record.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleToggleActive = async (doc: DoctorProfile) => {
    if (!activeStore) return;
    try {
      await apiPut(
        `/doctors/${doc.id}`,
        { isActive: !doc.isActive },
        activeStore.storeId
      );
      fetchDoctors();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const filteredDoctors = useMemo(() => {
    return doctors.filter((d) => {
      if (statusFilter === 'ACTIVE' && !d.isActive) return false;
      if (statusFilter === 'INACTIVE' && d.isActive) return false;
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase().trim();
      return (
        d.name?.toLowerCase().includes(q) ||
        d.registrationNumber?.toLowerCase().includes(q) ||
        d.specialization?.toLowerCase().includes(q) ||
        d.phone?.toLowerCase().includes(q) ||
        d.hospitalClinic?.toLowerCase().includes(q)
      );
    });
  }, [doctors, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    const total = doctors.length;
    const active = doctors.filter((d) => d.isActive).length;
    const totalPrescriptions = doctors.reduce((acc, d) => acc + (d.prescriptionsLinkedCount || 0), 0);
    const withCommission = doctors.filter((d) => d.commissionEnabled).length;
    return { total, active, totalPrescriptions, withCommission };
  }, [doctors]);

  return (
    <DashboardLayout>
      <Head>
        <title>Doctor Registry | PulseClinic Pharmacy Console</title>
        <meta
          name="description"
          content="Manage registered prescribing doctors, medical license numbers, and Schedule H prescription references in PulseClinic."
        />
      </Head>

      <div style={{ maxWidth: '1440px', margin: '0 auto', color: '#0f172a' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px',
            gap: '16px',
          }}
        >
          <div>
            <h1
              style={{
                fontSize: '24px',
                fontWeight: 700,
                color: '#0f172a',
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              Doctor Registry & Prescribers
            </h1>
            <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '14px' }}>
              Maintain verified medical license credentials, clinic affiliations, and prescription association logs.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={openAddModal}
              id="add-doctor-btn"
              style={{
                padding: '10px 18px',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 1px 3px rgba(37,99,235,0.2)',
                transition: 'all 0.15s ease',
              }}
            >
              <span>+ Register Doctor</span>
              <span
                style={{
                  fontSize: '11px',
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                }}
              >
                Alt+D
              </span>
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '18px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
              Total Registered
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a' }}>{stats.total}</div>
            <div style={{ fontSize: '12px', color: '#10b981', marginTop: '4px', fontWeight: 500 }}>
              {stats.active} Active prescribers
            </div>
          </div>

          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '18px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
              Prescriptions Linked
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#2563eb' }}>
              {stats.totalPrescriptions}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              Schedule H compliance refs
            </div>
          </div>

          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '18px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
              Commission Governance
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#f59e0b' }}>
              {stats.withCommission}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              Disabled by default (DEC-OPEN-02)
            </div>
          </div>

          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '18px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
              Compliance Mode
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>
              DPDP & CDSCO
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              Verified medical license check
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '14px 18px',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', flex: 1, minWidth: '280px', position: 'relative' }}>
            <input
              type="text"
              placeholder="Search by doctor name, license number, hospital..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              id="search-doctors-input"
              style={{
                width: '100%',
                padding: '9px 14px',
                paddingLeft: '36px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '14px',
                backgroundColor: '#f8fafc',
                color: '#0f172a',
                outline: 'none',
              }}
            />
            <span
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
                fontSize: '14px',
              }}
            >
              🔍
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setStatusFilter(mode)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1px solid',
                  borderColor: statusFilter === mode ? '#2563eb' : '#e2e8f0',
                  backgroundColor: statusFilter === mode ? '#eff6ff' : '#ffffff',
                  color: statusFilter === mode ? '#2563eb' : '#64748b',
                  transition: 'all 0.15s ease',
                }}
              >
                {mode === 'ALL' ? 'All' : mode === 'ACTIVE' ? 'Active' : 'Inactive'}
              </button>
            ))}
          </div>
        </div>

        {/* Doctor Registry Table */}
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          {loading ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
              <p style={{ margin: 0, fontWeight: 500 }}>Loading doctor registry...</p>
            </div>
          ) : error ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#ef4444' }}>
              <p style={{ fontWeight: 600, marginBottom: '8px' }}>Error loading doctor registry</p>
              <p style={{ fontSize: '13px', color: '#64748b' }}>{error}</p>
              <button
                onClick={fetchDoctors}
                style={{
                  marginTop: '12px',
                  padding: '8px 16px',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Retry
              </button>
            </div>
          ) : filteredDoctors.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>🩺</div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a', margin: '0 0 6px 0' }}>
                No doctors registered
              </h3>
              <p style={{ fontSize: '13px', margin: '0 0 16px 0', maxWidth: '400px', marginInline: 'auto' }}>
                {searchTerm
                  ? 'No doctors match your query. Try clearing your search.'
                  : 'Register medical practitioners to associate Schedule H prescriptions with sales.'}
              </p>
              <button
                onClick={openAddModal}
                style={{
                  padding: '9px 18px',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                + Register First Doctor
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: '1px solid #e2e8f0',
                      backgroundColor: '#f8fafc',
                      color: '#475569',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      fontSize: '11px',
                    }}
                  >
                    <th style={{ padding: '14px 18px' }}>Doctor Name</th>
                    <th style={{ padding: '14px 18px' }}>Reg / License No</th>
                    <th style={{ padding: '14px 18px' }}>Specialization</th>
                    <th style={{ padding: '14px 18px' }}>Hospital / Clinic</th>
                    <th style={{ padding: '14px 18px' }}>Contact</th>
                    <th style={{ padding: '14px 18px' }}>Prescriptions</th>
                    <th style={{ padding: '14px 18px' }}>Commission</th>
                    <th style={{ padding: '14px 18px' }}>Status</th>
                    <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDoctors.map((doc) => (
                    <tr
                      key={doc.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background-color 0.1s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '14px' }}>
                          Dr. {doc.name.replace(/^dr\.?\s+/i, '')}
                        </div>
                        {doc.email && (
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                            {doc.email}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            backgroundColor: '#f1f5f9',
                            padding: '3px 7px',
                            borderRadius: '4px',
                            color: '#0f172a',
                            fontWeight: 600,
                            fontSize: '12px',
                          }}
                        >
                          {doc.registrationNumber}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px', color: '#334155' }}>
                        {doc.specialization || 'General Medicine'}
                      </td>
                      <td style={{ padding: '14px 18px', color: '#64748b' }}>
                        {doc.hospitalClinic || '—'}
                      </td>
                      <td style={{ padding: '14px 18px', color: '#334155' }}>
                        {doc.phone || '—'}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            backgroundColor: '#eff6ff',
                            color: '#2563eb',
                          }}
                        >
                          📄 {doc.prescriptionsLinkedCount || 0}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        {doc.commissionEnabled ? (
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: 600,
                              backgroundColor: '#fef3c7',
                              color: '#b45309',
                            }}
                          >
                            Active: {((doc.commissionBps || 0) / 100).toFixed(2)}%
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '12px',
                              color: '#94a3b8',
                              fontWeight: 500,
                            }}
                          >
                            Disabled (Default)
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            backgroundColor: doc.isActive ? '#ecfdf5' : '#f1f5f9',
                            color: doc.isActive ? '#059669' : '#64748b',
                          }}
                        >
                          {doc.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          <button
                            onClick={() => openEditModal(doc)}
                            style={{
                              padding: '6px 10px',
                              backgroundColor: '#f8fafc',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: '#334155',
                              cursor: 'pointer',
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggleActive(doc)}
                            style={{
                              padding: '6px 10px',
                              backgroundColor: '#ffffff',
                              border: '1px solid #e2e8f0',
                              borderRadius: '6px',
                              fontSize: '12px',
                              color: doc.isActive ? '#ef4444' : '#10b981',
                              cursor: 'pointer',
                            }}
                          >
                            {doc.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Doctor Modal */}
      {isAddModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
          }}
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '540px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              border: '1px solid #e2e8f0',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  {editingDoctor ? 'Edit Doctor Profile' : 'Register Medical Practitioner'}
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  CDSCO & State Council Compliance Record
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  color: '#94a3b8',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDoctor} style={{ padding: '24px' }}>
              {modalError && (
                <div
                  style={{
                    padding: '12px 14px',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    color: '#b91c1c',
                    fontSize: '13px',
                    marginBottom: '16px',
                  }}
                >
                  {modalError}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label
                    style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}
                  >
                    Doctor Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Rajesh Sharma"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: '14px',
                      backgroundColor: '#ffffff',
                      color: '#0f172a',
                      outline: 'none',
                    }}
                  />
                </div>



                <div>
                  <label
                    style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}
                  >
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: '14px',
                      backgroundColor: '#ffffff',
                      color: '#0f172a',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}
                  >
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. doctor@clinic.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: '14px',
                      backgroundColor: '#ffffff',
                      color: '#0f172a',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label
                    style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}
                  >
                    Hospital / Clinic Affiliation
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Apollo City Clinic, Koramangala"
                    value={formHospitalClinic}
                    onChange={(e) => setFormHospitalClinic(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: '14px',
                      backgroundColor: '#ffffff',
                      color: '#0f172a',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* DEC-OPEN-02: Doctor Commission Governance Box */}
                <div
                  style={{
                    gridColumn: 'span 2',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '14px 16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                        Doctor Commission Tracking
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                        Per DEC-OPEN-02: Configurable toggle, disabled by default.
                      </div>
                    </div>
                    <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={formCommissionEnabled}
                        onChange={(e) => setFormCommissionEnabled(e.target.checked)}
                        style={{ width: '18px', height: '18px', accentColor: '#2563eb' }}
                      />
                    </label>
                  </div>

                  {formCommissionEnabled && (
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                      <label
                        style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}
                      >
                        Commission Rate (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={formCommissionPercent}
                        onChange={(e) => setFormCommissionPercent(e.target.value)}
                        style={{
                          width: '120px',
                          padding: '8px 10px',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          fontSize: '13px',
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  marginTop: '24px',
                  paddingTop: '16px',
                  borderTop: '1px solid #e2e8f0',
                }}
              >
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
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: modalLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 1px 2px rgba(37,99,235,0.2)',
                  }}
                >
                  {modalLoading ? 'Saving...' : editingDoctor ? 'Update Doctor' : 'Register Doctor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
