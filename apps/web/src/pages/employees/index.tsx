'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { useStore } from '@/context/StoreContext';
import { apiGet, apiPost, apiPut, ApiError } from '@/lib/api';
import {
  EmployeeProfileMasked,
  EmployeeRole,
  EmployeeStatus,
  EmployeeLedgerEntry,
  formatPaiseToINR,
  formatMaskedAadhaar,
  formatMaskedPan,
  validateAadhaarLastFour,
  validatePanLastFour,
} from '@pulseclinic/types';

interface EmployeeListResponse {
  success: boolean;
  employees: EmployeeProfileMasked[];
  nextCursor?: string;
}

interface LedgerResponse {
  success: boolean;
  entries: EmployeeLedgerEntry[];
  currentBalancePaise: number;
}

export default function EmployeesPage() {
  const { activeStore } = useStore();
  const [employees, setEmployees] = useState<EmployeeProfileMasked[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | EmployeeRole>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | EmployeeStatus>('ALL');

  // Add Employee Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [formFullName, setFormFullName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRole, setFormRole] = useState<EmployeeRole>('PHARMACIST');
  const [formSalaryRupees, setFormSalaryRupees] = useState('25000');
  const [formAadhaarLastFour, setFormAadhaarLastFour] = useState('');
  const [formPanLastFour, setFormPanLastFour] = useState('');

  // Ledger / Salary Advance Drawer
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeProfileMasked | null>(null);
  const [isLedgerDrawerOpen, setIsLedgerDrawerOpen] = useState(false);
  const [ledgerEntries, setLedgerEntries] = useState<EmployeeLedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);

  // Post Advance / Repayment Form
  const [entryType, setEntryType] = useState<'ADVANCE' | 'REPAYMENT' | 'SALARY_PAYMENT'>('ADVANCE');
  const [entryAmountRupees, setEntryAmountRupees] = useState('');
  const [entryDescription, setEntryDescription] = useState('');
  const [entryRef, setEntryRef] = useState('');
  const [entrySubmitting, setEntrySubmitting] = useState(false);

  const fetchEmployees = async () => {
    if (!activeStore) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<EmployeeListResponse>('/employees?limit=100', activeStore.storeId);
      if (res.success) {
        setEmployees(res.employees || []);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to load employee roster.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [activeStore?.storeId]);

  const openAddModal = () => {
    setFormFullName('');
    setFormEmail('');
    setFormPhone('');
    setFormRole('PHARMACIST');
    setFormSalaryRupees('25000');
    setFormAadhaarLastFour('');
    setFormPanLastFour('');
    setAddError(null);
    setIsAddModalOpen(true);
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore) return;
    setAddLoading(true);
    setAddError(null);

    // Frontend DPDP Pre-check
    const aadhaarCheck = validateAadhaarLastFour(formAadhaarLastFour);
    if (!aadhaarCheck.valid) {
      setAddError(aadhaarCheck.error || 'Invalid Aadhaar suffix');
      setAddLoading(false);
      return;
    }

    const panCheck = validatePanLastFour(formPanLastFour);
    if (!panCheck.valid) {
      setAddError(panCheck.error || 'Invalid PAN suffix');
      setAddLoading(false);
      return;
    }

    const salaryPaise = Math.round(parseFloat(formSalaryRupees || '0') * 100);

    try {
      await apiPost(
        '/employees',
        {
          fullName: formFullName.trim(),
          email: formEmail.trim().toLowerCase(),
          phone: formPhone.trim(),
          assignedRole: formRole,
          salaryPaise,
          aadhaarLastFour: formAadhaarLastFour.trim(),
          panLastFour: formPanLastFour.trim().toUpperCase(),
        },
        activeStore.storeId
      );

      setIsAddModalOpen(false);
      fetchEmployees();
    } catch (err: unknown) {
      if (err instanceof ApiError) setAddError(err.message);
      else setAddError('Failed to register employee');
    } finally {
      setAddLoading(false);
    }
  };

  const openLedgerDrawer = async (emp: EmployeeProfileMasked) => {
    setSelectedEmployee(emp);
    setIsLedgerDrawerOpen(true);
    setLedgerLoading(true);
    setLedgerError(null);
    setEntryAmountRupees('');
    setEntryDescription('');
    setEntryRef('');

    if (!activeStore) return;
    try {
      const res = await apiGet<LedgerResponse>(`/employees/${emp.id}/ledger`, activeStore.storeId);
      if (res.success) {
        setLedgerEntries(res.entries || []);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) setLedgerError(err.message);
      else setLedgerError('Failed to load ledger history');
    } finally {
      setLedgerLoading(false);
    }
  };

  const handlePostLedgerEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore || !selectedEmployee) return;

    const amountPaise = Math.round(parseFloat(entryAmountRupees || '0') * 100);
    if (amountPaise <= 0) {
      alert('Please enter a valid amount in ₹');
      return;
    }

    setEntrySubmitting(true);
    try {
      await apiPost(
        `/employees/${selectedEmployee.id}/ledger`,
        {
          type: entryType,
          amountPaise,
          description: entryDescription.trim(),
          referenceNumber: entryRef.trim() || undefined,
        },
        activeStore.storeId
      );

      // Refresh both ledger and roster
      const res = await apiGet<LedgerResponse>(
        `/employees/${selectedEmployee.id}/ledger`,
        activeStore.storeId
      );
      if (res.success) {
        setLedgerEntries(res.entries || []);
      }
      fetchEmployees();

      setEntryAmountRupees('');
      setEntryDescription('');
      setEntryRef('');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to post ledger entry');
    } finally {
      setEntrySubmitting(false);
    }
  };

  const handleToggleStatus = async (emp: EmployeeProfileMasked) => {
    if (!activeStore) return;
    const newStatus: EmployeeStatus = emp.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await apiPut(`/employees/${emp.id}`, { status: newStatus }, activeStore.storeId);
      fetchEmployees();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update employee status');
    }
  };

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (roleFilter !== 'ALL' && emp.assignedRole !== roleFilter) return false;
      if (statusFilter !== 'ALL' && emp.status !== statusFilter) return false;
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase().trim();
      return (
        emp.fullName?.toLowerCase().includes(q) ||
        emp.email?.toLowerCase().includes(q) ||
        emp.phone?.toLowerCase().includes(q)
      );
    });
  }, [employees, searchTerm, roleFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => e.status === 'ACTIVE').length;
    const totalAdvancePaise = employees.reduce((acc, e) => acc + (e.advanceBalancePaise || 0), 0);
    const totalMonthlySalaryPaise = employees.reduce((acc, e) => acc + (e.salaryPaise || 0), 0);
    return { total, active, totalAdvancePaise, totalMonthlySalaryPaise };
  }, [employees]);

  return (
    <DashboardLayout>
      <Head>
        <title>Employee Roster & Roles | New Sanjivani Clinic</title>
        <meta
          name="description"
          content="Manage pharmacy staff, RBAC roles, salary advances, and DPDP-compliant masked PII."
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
              Staff Roster & Personnel Ledger
            </h1>
            <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '14px' }}>
              DPDP Act 2023 compliant staff management, RBAC access controls, and salary advances.
            </p>
          </div>
          <button
            onClick={openAddModal}
            id="add-employee-btn"
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
            }}
          >
            <span>+ Add Staff Member</span>
          </button>
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
              Total Roster
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a' }}>{stats.total}</div>
            <div style={{ fontSize: '12px', color: '#10b981', marginTop: '4px', fontWeight: 500 }}>
              {stats.active} Active staff members
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
              Outstanding Advances
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#ef4444' }}>
              {formatPaiseToINR(stats.totalAdvancePaise)}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              Salary advances due for recovery
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
              Monthly Payroll Commitment
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#2563eb' }}>
              {formatPaiseToINR(stats.totalMonthlySalaryPaise)}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              Base wage allocation
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
              PII DPDP Security
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>
              Enforced Masking
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              Raw Aadhaar/PAN strictly blocked
            </div>
          </div>
        </div>

        {/* Filters */}
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
              placeholder="Search staff by name, email, phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              id="search-employees-input"
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

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                backgroundColor: '#ffffff',
                color: '#334155',
                fontWeight: 600,
              }}
            >
              <option value="ALL">All Roles</option>
              <option value="MANAGER">Manager</option>
              <option value="PHARMACIST">Pharmacist</option>
              <option value="ACCOUNTANT">Accountant</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                backgroundColor: '#ffffff',
                color: '#334155',
                fontWeight: 600,
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
        </div>

        {/* Employee Table */}
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
              <p style={{ margin: 0, fontWeight: 500 }}>Loading employee roster...</p>
            </div>
          ) : error ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#ef4444' }}>
              <p style={{ fontWeight: 600, marginBottom: '8px' }}>Error loading employee roster</p>
              <p style={{ fontSize: '13px', color: '#64748b' }}>{error}</p>
              <button
                onClick={fetchEmployees}
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
          ) : filteredEmployees.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>👥</div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a', margin: '0 0 6px 0' }}>
                No employees found
              </h3>
              <p style={{ fontSize: '13px', margin: '0 0 16px 0', maxWidth: '400px', marginInline: 'auto' }}>
                {searchTerm
                  ? 'No employees match your search query.'
                  : 'Add pharmacy staff with role assignments and DPDP-compliant masked identifiers.'}
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
                + Register First Staff Member
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
                    <th style={{ padding: '14px 18px' }}>Staff Name & Contact</th>
                    <th style={{ padding: '14px 18px' }}>Assigned Role</th>
                    <th style={{ padding: '14px 18px' }}>DPDP Masked Aadhaar</th>
                    <th style={{ padding: '14px 18px' }}>DPDP Masked PAN</th>
                    <th style={{ padding: '14px 18px' }}>Monthly Salary</th>
                    <th style={{ padding: '14px 18px' }}>Advance Balance</th>
                    <th style={{ padding: '14px 18px' }}>Status</th>
                    <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp) => (
                    <tr
                      key={emp.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background-color 0.1s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '14px' }}>
                          {emp.fullName}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                          {emp.email} • {emp.phone}
                        </div>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            letterSpacing: '0.03em',
                            backgroundColor:
                              emp.assignedRole === 'MANAGER'
                                ? '#f3e8ff'
                                : emp.assignedRole === 'ACCOUNTANT'
                                ? '#ecfdf5'
                                : '#eff6ff',
                            color:
                              emp.assignedRole === 'MANAGER'
                                ? '#7e22ce'
                                : emp.assignedRole === 'ACCOUNTANT'
                                ? '#047857'
                                : '#1d4ed8',
                          }}
                        >
                          {emp.assignedRole}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            backgroundColor: '#f1f5f9',
                            padding: '3px 7px',
                            borderRadius: '4px',
                            color: '#334155',
                            fontSize: '12px',
                          }}
                        >
                          {formatMaskedAadhaar(emp.aadhaarLastFour)}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            backgroundColor: '#f1f5f9',
                            padding: '3px 7px',
                            borderRadius: '4px',
                            color: '#334155',
                            fontSize: '12px',
                          }}
                        >
                          {formatMaskedPan(emp.panLastFour)}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px', fontWeight: 600, color: '#0f172a' }}>
                        {formatPaiseToINR(emp.salaryPaise)}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            fontWeight: 600,
                            color: emp.advanceBalancePaise > 0 ? '#dc2626' : '#059669',
                          }}
                        >
                          {formatPaiseToINR(emp.advanceBalancePaise || 0)}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            backgroundColor: emp.status === 'ACTIVE' ? '#ecfdf5' : '#fef2f2',
                            color: emp.status === 'ACTIVE' ? '#059669' : '#dc2626',
                          }}
                        >
                          {emp.status}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          <button
                            onClick={() => openLedgerDrawer(emp)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#eff6ff',
                              border: '1px solid #bfdbfe',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: '#1d4ed8',
                              cursor: 'pointer',
                            }}
                          >
                            Salary / Advance Ledger
                          </button>
                          <button
                            onClick={() => handleToggleStatus(emp)}
                            style={{
                              padding: '6px 10px',
                              backgroundColor: '#ffffff',
                              border: '1px solid #e2e8f0',
                              borderRadius: '6px',
                              fontSize: '12px',
                              color: emp.status === 'ACTIVE' ? '#dc2626' : '#10b981',
                              cursor: 'pointer',
                            }}
                          >
                            {emp.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
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

      {/* Add Employee Modal */}
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
              maxWidth: '560px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
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
                  Register Staff Member
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  RBAC Role assignment with DPDP PII protection standards
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

            <form onSubmit={handleCreateEmployee} style={{ padding: '24px' }}>
              {addError && (
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
                  {addError}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label
                    style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}
                  >
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh K. Patel"
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
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
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. ramesh@pulseclinic.in"
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

                <div>
                  <label
                    style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}
                  >
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
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
                    Assigned Role *
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as EmployeeRole)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: '14px',
                      backgroundColor: '#ffffff',
                      color: '#0f172a',
                      fontWeight: 600,
                    }}
                  >
                    <option value="PHARMACIST">Pharmacist (Dispensing & Billing)</option>
                    <option value="MANAGER">Manager (Inventory & Admin)</option>
                    <option value="ACCOUNTANT">Accountant (Ledger & Reports)</option>
                  </select>
                </div>

                <div>
                  <label
                    style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}
                  >
                    Monthly Base Salary (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    required
                    value={formSalaryRupees}
                    onChange={(e) => setFormSalaryRupees(e.target.value)}
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

                {/* DPDP PII Masked Inputs */}
                <div
                  style={{
                    gridColumn: 'span 2',
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '10px',
                    padding: '16px',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e40af', marginBottom: '4px' }}>
                    DPDP Act Compliance: Masked Identifiers Only
                  </div>
                  <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#3b82f6' }}>
                    Per DEC-OPEN-04: Submit strictly the last 4 characters. Raw 12-digit Aadhaar and 10-char PAN are strictly rejected by the server.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label
                        style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#1e3a8a', marginBottom: '4px' }}
                      >
                        Aadhaar Last 4 Digits *
                      </label>
                      <input
                        type="text"
                        maxLength={4}
                        required
                        placeholder="e.g. 4921"
                        value={formAadhaarLastFour}
                        onChange={(e) => setFormAadhaarLastFour(e.target.value.replace(/\D/g, ''))}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          border: '1px solid #93c5fd',
                          borderRadius: '6px',
                          fontSize: '14px',
                          fontFamily: 'monospace',
                          letterSpacing: '0.1em',
                        }}
                      />
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        Stored as XXXX-XXXX-{formAadhaarLastFour || '????'}
                      </div>
                    </div>

                    <div>
                      <label
                        style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#1e3a8a', marginBottom: '4px' }}
                      >
                        PAN Last 4 Characters *
                      </label>
                      <input
                        type="text"
                        maxLength={4}
                        required
                        placeholder="e.g. 921F"
                        value={formPanLastFour}
                        onChange={(e) => setFormPanLastFour(e.target.value.toUpperCase())}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          border: '1px solid #93c5fd',
                          borderRadius: '6px',
                          fontSize: '14px',
                          fontFamily: 'monospace',
                          letterSpacing: '0.1em',
                        }}
                      />
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        Stored as XXXXXX{formPanLastFour || '????'}
                      </div>
                    </div>
                  </div>
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
                  disabled={addLoading}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: addLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {addLoading ? 'Registering...' : 'Register Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Salary Advance & Repayment Drawer Modal */}
      {isLedgerDrawerOpen && selectedEmployee && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            justifyContent: 'flex-end',
            zIndex: 100,
          }}
          onClick={() => setIsLedgerDrawerOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              width: '100%',
              maxWidth: '540px',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-10px 0 25px -5px rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
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
                  {selectedEmployee.fullName}
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  {selectedEmployee.assignedRole} • Salary Ledger & Advances
                </p>
              </div>
              <button
                onClick={() => setIsLedgerDrawerOpen(false)}
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

            {/* Advance Balance Card */}
            <div
              style={{
                margin: '20px 24px',
                padding: '16px 20px',
                borderRadius: '12px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                  CURRENT ADVANCE OUTSTANDING
                </div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#dc2626', marginTop: '2px' }}>
                  {formatPaiseToINR(selectedEmployee.advanceBalancePaise || 0)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Base Monthly Salary</div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>
                  {formatPaiseToINR(selectedEmployee.salaryPaise)}
                </div>
              </div>
            </div>

            {/* Post New Ledger Entry Form */}
            <form
              onSubmit={handlePostLedgerEntry}
              style={{
                margin: '0 24px 20px 24px',
                padding: '16px',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                backgroundColor: '#ffffff',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>
                Post Financial Entry
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Entry Type *
                  </label>
                  <select
                    value={entryType}
                    onChange={(e) => setEntryType(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}
                  >
                    <option value="ADVANCE">Salary Advance (+Due)</option>
                    <option value="REPAYMENT">Repayment (-Due)</option>
                    <option value="SALARY_PAYMENT">Disburse Monthly Salary</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    placeholder="e.g. 5000"
                    value={entryAmountRupees}
                    onChange={(e) => setEntryAmountRupees(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '13px',
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Description / Audit Reason *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Medical emergency advance / Monthly wage cash"
                  value={entryDescription}
                  onChange={(e) => setEntryDescription(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Ref # (UPI/Cheque optional)"
                  value={entryRef}
                  onChange={(e) => setEntryRef(e.target.value)}
                  style={{
                    width: '180px',
                    padding: '8px 10px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                />
                <button
                  type="submit"
                  disabled={entrySubmitting}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: entrySubmitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {entrySubmitting ? 'Posting...' : 'Post Entry'}
                </button>
              </div>
            </form>

            {/* Immutable Ledger History List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px 24px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>
                Immutable Ledger History
              </div>

              {ledgerLoading ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                  Loading transactions...
                </div>
              ) : ledgerError ? (
                <div style={{ color: '#ef4444', fontSize: '13px' }}>{ledgerError}</div>
              ) : ledgerEntries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontSize: '13px' }}>
                  No transaction entries on record.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {ledgerEntries.map((entry) => (
                    <div
                      key={entry.id}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#f8fafc',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: '11px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor:
                              entry.type === 'ADVANCE'
                                ? '#fef2f2'
                                : entry.type === 'REPAYMENT'
                                ? '#ecfdf5'
                                : '#eff6ff',
                            color:
                              entry.type === 'ADVANCE'
                                ? '#b91c1c'
                                : entry.type === 'REPAYMENT'
                                ? '#047857'
                                : '#1d4ed8',
                          }}
                        >
                          {entry.type}
                        </span>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                          {formatPaiseToINR(entry.amountPaise)}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', color: '#334155', marginTop: '6px' }}>
                        {entry.description}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '11px',
                          color: '#64748b',
                          marginTop: '6px',
                          paddingTop: '6px',
                          borderTop: '1px solid #e2e8f0',
                        }}
                      >
                        <span>
                          {new Date(entry.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span>Balance After: {formatPaiseToINR(entry.balanceAfterPaise)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
