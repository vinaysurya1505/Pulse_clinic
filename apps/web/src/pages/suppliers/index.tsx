'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { useStore } from '@/context/StoreContext';
import { apiGet, apiPost, ApiError } from '@/lib/api';
import {
  SupplierProfile,
  CreateSupplierInput,
  SupplierLedgerEntry,
  formatPaiseToINR,
} from '@pulseclinic/types';

interface SupplierListResponse {
  success: boolean;
  suppliers: SupplierProfile[];
  nextCursor?: string;
}

interface StatementResponse {
  success: boolean;
  statement: {
    currentBalancePaise: number;
    entries: SupplierLedgerEntry[];
  };
}

export default function SuppliersPage() {
  const { activeStore } = useStore();
  const [suppliers, setSuppliers] = useState<SupplierProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');

  // Add Supplier Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<CreateSupplierInput>({
    name: '',
    gstin: '',
    phone: '',
    email: '',
    contactPerson: '',
    paymentTermsDays: 30,
    address: { city: '', state: '', pincode: '' },
  });

  // Record Payment Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierProfile | null>(null);
  const [paymentAmountRupees, setPaymentAmountRupees] = useState('');
  const [paymentMode, setPaymentMode] = useState<'BANK_TRANSFER' | 'CHEQUE' | 'CASH' | 'UPI'>('BANK_TRANSFER');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Statement Drawer Modal
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [statementEntries, setStatementEntries] = useState<SupplierLedgerEntry[]>([]);
  const [statementLoading, setStatementLoading] = useState(false);

  const fetchSuppliers = async () => {
    if (!activeStore) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<SupplierListResponse>(`/suppliers?limit=100`, activeStore.storeId);
      if (res.success) {
        setSuppliers(res.suppliers || []);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to load supplier directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [activeStore?.storeId]);

  const filteredSuppliers = useMemo(() => {
    if (!searchTerm.trim()) return suppliers;
    const q = searchTerm.toLowerCase().trim();
    return suppliers.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.gstin?.toLowerCase().includes(q) ||
        s.phone?.toLowerCase().includes(q) ||
        s.contactPerson?.toLowerCase().includes(q)
    );
  }, [suppliers, searchTerm]);

  const stats = useMemo(() => {
    const total = suppliers.length;
    let totalDebt = 0;
    suppliers.forEach((s) => {
      totalDebt += s.currentBalancePaise || 0;
    });
    return { total, totalDebt };
  }, [suppliers]);

  const handleOpenAddModal = () => {
    setAddForm({
      name: '',
      gstin: '',
      phone: '',
      email: '',
      contactPerson: '',
      paymentTermsDays: 30,
      address: { city: '', state: '', pincode: '' },
    });
    setAddError(null);
    setIsAddModalOpen(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore) return;
    if (!addForm.name.trim() || !addForm.phone.trim()) {
      setAddError('Supplier name and phone are required.');
      return;
    }

    setAddLoading(true);
    setAddError(null);

    try {
      const res = await apiPost<{ success: boolean; supplier: SupplierProfile }>(
        `/suppliers`,
        addForm,
        activeStore.storeId
      );
      if (res.success) {
        setSuppliers((prev) => [res.supplier, ...prev]);
        setIsAddModalOpen(false);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) setAddError(err.message);
      else setAddError('Failed to create supplier profile.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleOpenPaymentModal = (supplier: SupplierProfile) => {
    setSelectedSupplier(supplier);
    setPaymentAmountRupees(supplier.currentBalancePaise > 0 ? (supplier.currentBalancePaise / 100).toFixed(2) : '');
    setPaymentMode('BANK_TRANSFER');
    setReferenceNumber('');
    setPaymentNotes('');
    setPaymentError(null);
    setIsPaymentModalOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore || !selectedSupplier) return;

    const amountPaise = Math.round(parseFloat(paymentAmountRupees || '0') * 100);
    if (amountPaise <= 0) {
      setPaymentError('Payment amount must be greater than ₹0.00');
      return;
    }
    if (!referenceNumber.trim()) {
      setPaymentError('Transaction reference or cheque number is required.');
      return;
    }

    setPaymentLoading(true);
    setPaymentError(null);

    try {
      const res = await apiPost<{ success: boolean; supplier: SupplierProfile }>(
        `/suppliers/${selectedSupplier.id}/payments`,
        {
          amountPaise,
          paymentMode,
          referenceNumber: referenceNumber.trim(),
          notes: paymentNotes || undefined,
        },
        activeStore.storeId
      );
      if (res.success) {
        setSuppliers((prev) => prev.map((s) => (s.id === selectedSupplier.id ? res.supplier : s)));
        setIsPaymentModalOpen(false);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) setPaymentError(err.message);
      else setPaymentError('Failed to record supplier payment.');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleViewStatement = async (supplier: SupplierProfile) => {
    if (!activeStore) return;
    setSelectedSupplier(supplier);
    setStatementLoading(true);
    setIsStatementModalOpen(true);

    try {
      const res = await apiGet<StatementResponse>(
        `/suppliers/${supplier.id}/statement?limit=50`,
        activeStore.storeId
      );
      if (res.success) {
        setStatementEntries(res.statement.entries || []);
      }
    } catch {
      setStatementEntries([]);
    } finally {
      setStatementLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <Head>
        <title>Suppliers Directory & Accounts | New Sanjivani Clinic</title>
        <meta name="description" content="Manage pharmaceutical distributors, credit payment terms, and supplier ledgers." />
      </Head>

      <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.2)'
            }}>
              🏭
            </div>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Suppliers & Distributor Accounts
              </h1>
              <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>
                Manage pharmaceutical vendors, credit payment terms, purchase invoice reconciliation, and payment ledgers.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleOpenAddModal}
              id="add-supplier-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                backgroundColor: '#f59e0b',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(245, 158, 11, 0.25)',
                transition: 'all 0.15s ease'
              }}
            >
              <span>+ Add Supplier</span>
            </button>
          </div>
        </div>

        {/* Metric Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            padding: '16px 20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Active Distributors</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>{stats.total}</div>
            <div style={{ fontSize: '12px', color: '#10b981', marginTop: '4px', fontWeight: 500 }}>Approved vendors</div>
          </div>

          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            padding: '16px 20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Total Outstanding Payables</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: stats.totalDebt > 0 ? '#b45309' : '#10b981', marginTop: '6px' }}>
              {formatPaiseToINR(stats.totalDebt)}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', fontWeight: 500 }}>Supplier debt balance</div>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          padding: '16px 20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '15px' }}>
              🔍
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Vendor Name, GSTIN, Phone, or Contact Person..."
              id="supplier-search-input"
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

        {/* Suppliers Table */}
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
                  <th style={{ padding: '14px 20px' }}>Supplier / Agency</th>
                  <th style={{ padding: '14px 16px' }}>GSTIN & City</th>
                  <th style={{ padding: '14px 16px' }}>Contact Person</th>
                  <th style={{ padding: '14px 16px' }}>Payment Terms</th>
                  <th style={{ padding: '14px 16px' }}>Current Payable</th>
                  <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody style={{ fontSize: '14px', color: '#1e293b' }}>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '48px 20px', textAlign: 'center', color: '#64748b' }}>
                      <div style={{ display: 'inline-block', width: 24, height: 24, border: '3px solid #cbd5e1', borderTopColor: '#f59e0b', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                      <div style={{ marginTop: '10px', fontSize: '14px' }}>Loading supplier directory...</div>
                    </td>
                  </tr>
                ) : filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '48px 20px', textAlign: 'center' }}>
                      <div style={{ fontSize: '40px' }}>🏭</div>
                      <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '8px', fontSize: '16px' }}>
                        No distributors registered yet
                      </div>
                      <div style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>
                        Add your wholesale pharmaceutical suppliers to track purchase orders and bills.
                      </div>
                      <button
                        onClick={handleOpenAddModal}
                        style={{
                          marginTop: '16px',
                          padding: '8px 18px',
                          backgroundColor: '#f59e0b',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        + Add First Supplier
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map((s, index) => (
                    <tr
                      key={s.id}
                      style={{
                        borderBottom: index === filteredSuppliers.length - 1 ? 'none' : '1px solid #f1f5f9',
                        transition: 'background-color 0.15s ease',
                        backgroundColor: '#ffffff'
                      }}
                    >
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '15px' }}>{s.name}</div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>📞 {s.phone}</div>
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '13px', color: '#334155' }}>
                          {s.gstin || 'Unregistered'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                          {s.address?.city ? `${s.address.city}, ${s.address.state || ''}` : 'No address'}
                        </div>
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: '#0f172a' }}>
                          {s.contactPerson || '—'}
                        </div>
                        {s.email && <div style={{ fontSize: '12px', color: '#64748b' }}>{s.email}</div>}
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: '9999px',
                          fontSize: '12px',
                          fontWeight: 600,
                          backgroundColor: '#f1f5f9',
                          color: '#475569'
                        }}>
                          {s.paymentTermsDays} Days Net
                        </span>
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        <div style={{
                          fontSize: '15px',
                          fontWeight: 700,
                          color: s.currentBalancePaise > 0 ? '#b45309' : '#10b981'
                        }}>
                          {formatPaiseToINR(s.currentBalancePaise)}
                        </div>
                      </td>

                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            onClick={() => handleOpenPaymentModal(s)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              fontSize: '13px',
                              fontWeight: 600,
                              color: '#d97706',
                              cursor: 'pointer'
                            }}
                          >
                            Pay
                          </button>
                          <button
                            onClick={() => handleViewStatement(s)}
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
                            Statement
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

        {/* Modal: Add Supplier */}
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
              maxWidth: '560px',
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
                    Register Wholesale Supplier
                  </h2>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
                    Enter distributor company profile, GSTIN, and credit terms.
                  </p>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  style={{ background: 'none', border: 'none', fontSize: '20px', color: '#94a3b8', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveSupplier} style={{ padding: '24px' }}>
                {addError && (
                  <div style={{
                    marginBottom: '16px',
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      Distributor / Business Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={addForm.name}
                      onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                      placeholder="e.g. Apex Pharma Distributors Pvt Ltd"
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

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        GSTIN
                      </label>
                      <input
                        type="text"
                        value={addForm.gstin || ''}
                        onChange={(e) => setAddForm({ ...addForm, gstin: e.target.value.toUpperCase() })}
                        placeholder="e.g. 27AABCA1234F1Z5"
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
                        Phone Number *
                      </label>
                      <input
                        type="text"
                        required
                        value={addForm.phone}
                        onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                        placeholder="e.g. +91 98765 43210"
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
                        Contact Person
                      </label>
                      <input
                        type="text"
                        value={addForm.contactPerson || ''}
                        onChange={(e) => setAddForm({ ...addForm, contactPerson: e.target.value })}
                        placeholder="e.g. Rajesh Sharma"
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
                        Credit Terms (Days)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={addForm.paymentTermsDays || 30}
                        onChange={(e) => setAddForm({ ...addForm, paymentTermsDays: parseInt(e.target.value, 10) || 0 })}
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
                  marginTop: '24px',
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
                    id="submit-supplier-btn"
                    style={{
                      padding: '10px 24px',
                      backgroundColor: '#f59e0b',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: addLoading ? 'not-allowed' : 'pointer',
                      opacity: addLoading ? 0.7 : 1,
                      boxShadow: '0 2px 8px rgba(245, 158, 11, 0.25)'
                    }}
                  >
                    {addLoading ? 'Saving...' : 'Register Supplier'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Record Payment */}
        {isPaymentModalOpen && selectedSupplier && (
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
                    Record Supplier Payment
                  </h2>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
                    Pay to: {selectedSupplier.name}
                  </p>
                </div>
                <button
                  onClick={() => setIsPaymentModalOpen(false)}
                  style={{ background: 'none', border: 'none', fontSize: '20px', color: '#94a3b8', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleRecordPayment} style={{ padding: '24px' }}>
                {paymentError && (
                  <div style={{
                    marginBottom: '16px',
                    backgroundColor: '#fee2e2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    padding: '12px',
                    color: '#b91c1c',
                    fontSize: '13px'
                  }}>
                    {paymentError}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    backgroundColor: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Total Balance Owed</span>
                    <span style={{ fontSize: '18px', fontWeight: 700, color: '#b45309' }}>
                      {formatPaiseToINR(selectedSupplier.currentBalancePaise)}
                    </span>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      Payment Amount (₹) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={paymentAmountRupees}
                      onChange={(e) => setPaymentAmountRupees(e.target.value)}
                      placeholder="e.g. 5000.00"
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
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        Payment Mode *
                      </label>
                      <select
                        value={paymentMode}
                        onChange={(e) => setPaymentMode(e.target.value as any)}
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '14px',
                          backgroundColor: '#ffffff'
                        }}
                      >
                        <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                        <option value="UPI">UPI Payment</option>
                        <option value="CHEQUE">Bank Cheque</option>
                        <option value="CASH">Cash</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        Reference / Cheque # *
                      </label>
                      <input
                        type="text"
                        required
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                        placeholder="e.g. UTR-99881273"
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
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      Notes
                    </label>
                    <input
                      type="text"
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      placeholder="e.g. Paid against invoice INV-991"
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
                    onClick={() => setIsPaymentModalOpen(false)}
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
                    disabled={paymentLoading}
                    style={{
                      padding: '10px 24px',
                      backgroundColor: '#0f172a',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: paymentLoading ? 'not-allowed' : 'pointer',
                      opacity: paymentLoading ? 0.7 : 1
                    }}
                  >
                    {paymentLoading ? 'Recording...' : 'Record Payment in Ledger'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Statement & Ledger Drawer */}
        {isStatementModalOpen && selectedSupplier && (
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
              maxWidth: '720px',
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
                    Vendor Statement: {selectedSupplier.name}
                  </h2>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
                    Current Payable: <strong style={{ color: '#b45309' }}>{formatPaiseToINR(selectedSupplier.currentBalancePaise)}</strong>
                  </p>
                </div>
                <button
                  onClick={() => setIsStatementModalOpen(false)}
                  style={{ background: 'none', border: 'none', fontSize: '20px', color: '#94a3b8', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              <div style={{ padding: '24px' }}>
                {statementLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                    Loading vendor account statement...
                  </div>
                ) : statementEntries.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                    No invoice or payment transactions recorded yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {statementEntries.map((entry) => (
                      <div
                        key={entry.id}
                        style={{
                          padding: '12px 16px',
                          borderRadius: '8px',
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
                              backgroundColor: entry.entryType === 'INVOICE_PURCHASE' ? '#fee2e2' : '#dcfce7',
                              color: entry.entryType === 'INVOICE_PURCHASE' ? '#b91c1c' : '#15803d'
                            }}>
                              {entry.entryType}
                            </span>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                              Ref: {entry.referenceNumber}
                            </span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                            {new Date(entry.createdAt).toLocaleString()} • Logged by: {entry.performedByName || 'Staff'}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{
                            fontSize: '15px',
                            fontWeight: 700,
                            color: entry.amountPaise > 0 ? '#b91c1c' : '#15803d'
                          }}>
                            {entry.amountPaise > 0 ? `+${formatPaiseToINR(entry.amountPaise)}` : formatPaiseToINR(entry.amountPaise)}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            Bal: {formatPaiseToINR(entry.balanceAfterPaise)}
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
