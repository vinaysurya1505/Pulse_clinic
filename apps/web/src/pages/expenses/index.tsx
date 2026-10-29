'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { useStore } from '@/context/StoreContext';
import { useAuth } from '@/context/AuthContext';
import { apiGet, apiPost, ApiError } from '@/lib/api';
import {
  ExpenseRecord,
  ExpenseCategory,
  ExpensePaymentMode,
  CashRegisterSession,
} from '@pulseclinic/types';

interface ExpensesResponse {
  success: boolean;
  expenses: ExpenseRecord[];
  totalAmountPaise: number;
}

interface CashRegisterResponse {
  success: boolean;
  session: CashRegisterSession | null;
}

const CATEGORIES: { label: string; value: ExpenseCategory }[] = [
  { label: 'Petty Cash', value: 'PETTY_CASH' },
  { label: 'Utilities (Electricity, Water, Internet)', value: 'UTILITIES' },
  { label: 'Maintenance & Repairs', value: 'MAINTENANCE' },
  { label: 'Packaging & Bags', value: 'PACKAGING' },
  { label: 'Rent', value: 'RENT' },
  { label: 'Salary / Wages', value: 'SALARY' },
  { label: 'Marketing & Promotion', value: 'MARKETING' },
  { label: 'Miscellaneous', value: 'MISCELLANEOUS' },
];

export default function ExpensesPage() {
  const { activeStore } = useStore();
  const { user, loading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<'EXPENSES' | 'REGISTER'>('EXPENSES');
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [activeSession, setActiveSession] = useState<CashRegisterSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Modals
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isOpenRegisterOpen, setIsOpenRegisterOpen] = useState(false);
  const [isCloseRegisterOpen, setIsCloseRegisterOpen] = useState(false);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Add Expense Form State
  const [formCategory, setFormCategory] = useState<ExpenseCategory>('PETTY_CASH');
  const [formAmountRupees, setFormAmountRupees] = useState('');
  const [formPaymentMode, setFormPaymentMode] = useState<ExpensePaymentMode>('CASH');
  const [formDescription, setFormDescription] = useState('');
  const [formVendor, setFormVendor] = useState('');
  const [formBillNumber, setFormBillNumber] = useState('');

  // Register Form State
  const [openingFloatRupees, setOpeningFloatRupees] = useState('2000');
  const [openingNotes, setOpeningNotes] = useState('');
  const [countedCashRupees, setCountedCashRupees] = useState('');
  const [closingNotes, setClosingNotes] = useState('');

  const fetchExpensesAndRegister = async () => {
    if (!activeStore || authLoading || !user) return;
    setLoading(true);
    setError(null);

    try {
      let expUrl = '/expenses?limit=100';
      if (selectedCategory !== 'ALL') {
        expUrl += `&category=${selectedCategory}`;
      }

      const [expRes, regRes] = await Promise.all([
        apiGet<ExpensesResponse>(expUrl, activeStore.storeId),
        apiGet<CashRegisterResponse>('/expenses/cash-register', activeStore.storeId),
      ]);

      if (expRes.success) setExpenses(expRes.expenses || []);
      if (regRes.success) setActiveSession(regRes.session || null);
    } catch (err: unknown) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to load expense and register records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user && activeStore) {
      fetchExpensesAndRegister();
    }
  }, [activeStore?.storeId, selectedCategory, authLoading, user]);

  const metrics = useMemo(() => {
    const totalExpensesPaise = expenses.reduce((sum, e) => sum + (e.amountPaise || 0), 0);
    const pettyCashPaise = expenses
      .filter((e) => e.category === 'PETTY_CASH')
      .reduce((sum, e) => sum + (e.amountPaise || 0), 0);

    return {
      totalRupees: (totalExpensesPaise / 100).toFixed(2),
      pettyRupees: (pettyCashPaise / 100).toFixed(2),
      count: expenses.length,
    };
  }, [expenses]);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore) return;

    const amountPaise = Math.round(parseFloat(formAmountRupees || '0') * 100);
    if (isNaN(amountPaise) || amountPaise <= 0) {
      setModalError('Please enter a valid expense amount.');
      return;
    }
    if (!formDescription.trim()) {
      setModalError('Please provide a description.');
      return;
    }

    setModalSubmitting(true);
    setModalError(null);

    try {
      const res = await apiPost<{ success: boolean; message: string }>(
        '/expenses',
        {
          category: formCategory,
          amountPaise,
          paymentMode: formPaymentMode,
          description: formDescription.trim(),
          vendorName: formVendor.trim() || undefined,
          billInvoiceNumber: formBillNumber.trim() || undefined,
        },
        activeStore.storeId
      );

      if (res.success) {
        setIsAddExpenseOpen(false);
        setFormAmountRupees('');
        setFormDescription('');
        setFormVendor('');
        setFormBillNumber('');
        fetchExpensesAndRegister();
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) setModalError(err.message);
      else setModalError('Failed to record expense.');
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleOpenRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore) return;

    const openingPaise = Math.round(parseFloat(openingFloatRupees || '0') * 100);
    if (isNaN(openingPaise) || openingPaise < 0) {
      setModalError('Opening cash amount cannot be negative.');
      return;
    }

    setModalSubmitting(true);
    setModalError(null);

    try {
      const res = await apiPost<{ success: boolean; message: string }>(
        '/expenses/cash-register/open',
        { openingCashPaise: openingPaise, notes: openingNotes.trim() || undefined },
        activeStore.storeId
      );

      if (res.success) {
        setIsOpenRegisterOpen(false);
        fetchExpensesAndRegister();
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) setModalError(err.message);
      else setModalError('Failed to open cash register session.');
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleCloseRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore) return;

    const countedPaise = Math.round(parseFloat(countedCashRupees || '0') * 100);
    if (isNaN(countedPaise) || countedPaise < 0) {
      setModalError('Counted cash amount cannot be negative.');
      return;
    }

    setModalSubmitting(true);
    setModalError(null);

    try {
      const res = await apiPost<{ success: boolean; message: string }>(
        '/expenses/cash-register/close',
        { actualCashCountPaise: countedPaise, notes: closingNotes.trim() || undefined },
        activeStore.storeId
      );

      if (res.success) {
        setIsCloseRegisterOpen(false);
        setCountedCashRupees('');
        setClosingNotes('');
        fetchExpensesAndRegister();
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) setModalError(err.message);
      else setModalError('Failed to reconcile and close register.');
    } finally {
      setModalSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <Head>
        <title>Expenses & Cash Drawer Reconciliation | New Sanjivani Clinic</title>
      </Head>

      <div style={{ padding: 'var(--space-lg)', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em', margin: 0 }}>
              Store Expenses & Petty Cash
            </h1>
            <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-secondary)', fontSize: 'var(--font-sm)' }}>
              Operational expenditure logging, petty cash tracking, and daily cash drawer reconciliation.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            {!activeSession ? (
              <button
                id="btn-open-register"
                onClick={() => {
                  setModalError(null);
                  setIsOpenRegisterOpen(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  background: '#059669',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-sm)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                💵 Open Cash Drawer
              </button>
            ) : (
              <button
                id="btn-close-register"
                onClick={() => {
                  setModalError(null);
                  setCountedCashRupees(((activeSession.expectedCashPaise || 0) / 100).toString());
                  setIsCloseRegisterOpen(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  background: '#d97706',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-sm)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                🔒 Reconcile & Close Drawer
              </button>
            )}

            <button
              id="btn-add-expense"
              onClick={() => {
                setModalError(null);
                setIsAddExpenseOpen(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                background: 'var(--color-primary)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-sm)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              + Record Expense
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-md)' }}>
          <div style={{ background: '#ffffff', padding: 'var(--space-md)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Total Expenses
            </div>
            <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: '#dc2626', marginTop: '4px' }}>
              ₹{metrics.totalRupees}
            </div>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              {metrics.count} recorded entries
            </div>
          </div>

          <div style={{ background: '#ffffff', padding: 'var(--space-md)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Petty Cash
            </div>
            <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--color-text)', marginTop: '4px' }}>
              ₹{metrics.pettyRupees}
            </div>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              Day-to-day store purchases
            </div>
          </div>

          <div style={{ background: '#ffffff', padding: 'var(--space-md)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Cash Drawer Status
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <span
                style={{
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '12px',
                  fontWeight: 700,
                  background: activeSession ? '#dcfce7' : '#fee2e2',
                  color: activeSession ? '#15803d' : '#b91c1c',
                }}
              >
                {activeSession ? 'DRAWER OPEN' : 'DRAWER CLOSED'}
              </span>
            </div>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              {activeSession ? `Opened at ${new Date(activeSession.openedAt).toLocaleTimeString()}` : 'No active session'}
            </div>
          </div>

          <div style={{ background: '#ffffff', padding: 'var(--space-md)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Live Cash in Drawer
            </div>
            <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: '#059669', marginTop: '4px' }}>
              ₹{activeSession ? ((activeSession.expectedCashPaise || 0) / 100).toFixed(2) : '0.00'}
            </div>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              {activeSession ? `Float: ₹${((activeSession.openingCashPaise || 0) / 100).toFixed(2)}` : 'Register locked'}
            </div>
          </div>
        </div>

        {/* Tab & Filter Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
          <div style={{ display: 'flex', background: '#e2e8f0', padding: '3px', borderRadius: 'var(--radius-md)' }}>
            <button
              onClick={() => setActiveTab('EXPENSES')}
              style={{
                padding: '6px 14px',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--font-sm)',
                fontWeight: 600,
                cursor: 'pointer',
                background: activeTab === 'EXPENSES' ? '#ffffff' : 'transparent',
                color: activeTab === 'EXPENSES' ? 'var(--color-text)' : 'var(--color-text-secondary)',
              }}
            >
              Expense Ledger
            </button>
            <button
              onClick={() => setActiveTab('REGISTER')}
              style={{
                padding: '6px 14px',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--font-sm)',
                fontWeight: 600,
                cursor: 'pointer',
                background: activeTab === 'REGISTER' ? '#ffffff' : 'transparent',
                color: activeTab === 'REGISTER' ? 'var(--color-text)' : 'var(--color-text-secondary)',
              }}
            >
              Cash Register Summary
            </button>
          </div>

          {activeTab === 'EXPENSES' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                Category:
              </span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  fontSize: 'var(--font-xs)',
                  background: '#ffffff',
                  outline: 'none',
                }}
              >
                <option value="ALL">All Categories</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Tab 1: Expense Ledger Table */}
        {activeTab === 'EXPENSES' && (
          <div style={{ background: '#ffffff', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-sm)' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Date & Time</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Category</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Description</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Vendor / Invoice</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Payment Mode</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      Loading expenses...
                    </td>
                  </tr>
                ) : expenses.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      No expenses logged yet. Click "+ Record Expense" to log your first expenditure.
                    </td>
                  </tr>
                ) : (
                  expenses.map((exp) => (
                    <tr
                      key={exp.id}
                      style={{ borderBottom: '1px solid var(--color-border)' }}
                    >
                      <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)' }}>
                        {new Date(exp.createdAt).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: exp.category === 'PETTY_CASH' ? '#ecfdf5' : '#f1f5f9',
                            color: exp.category === 'PETTY_CASH' ? '#047857' : 'var(--color-text)',
                            border: '1px solid var(--color-border)',
                          }}
                        >
                          {exp.category}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-text)' }}>
                        {exp.description}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)', fontSize: 'var(--font-xs)' }}>
                        {exp.vendorName || '-'} {exp.billInvoiceNumber ? `(#${exp.billInvoiceNumber})` : ''}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: exp.paymentMode === 'CASH' ? '#fef3c7' : '#eff6ff',
                            color: exp.paymentMode === 'CASH' ? '#92400e' : '#1d4ed8',
                          }}
                        >
                          {exp.paymentMode}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>
                        ₹{((exp.amountPaise || 0) / 100).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Cash Register Live Reconciliation */}
        {activeTab === 'REGISTER' && (
          <div style={{ background: '#ffffff', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', padding: 'var(--space-lg)', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ margin: '0 0 var(--space-md) 0', fontSize: 'var(--font-lg)', fontWeight: 700, color: 'var(--color-text)' }}>
              Current Register Shift Details
            </h3>

            {activeSession ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-lg)' }}>
                <div style={{ background: '#f8fafc', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Session Info</div>
                  <div style={{ fontSize: 'var(--font-base)', fontWeight: 700, color: 'var(--color-text)', marginTop: '4px' }}>
                    Session #{activeSession.id.slice(0, 8)}
                  </div>
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                    Opened by: {activeSession.openedBy}
                  </div>
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)' }}>
                    Opened at: {new Date(activeSession.openedAt).toLocaleString('en-IN')}
                  </div>
                  {activeSession.openingNotes && (
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', marginTop: '6px' }}>
                      Notes: {activeSession.openingNotes}
                    </div>
                  )}
                </div>

                <div style={{ background: '#f8fafc', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: 'var(--font-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Opening Float:</span>
                    <span style={{ fontWeight: 600 }}>₹{((activeSession.openingCashPaise || 0) / 100).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669' }}>
                    <span>+ Cash Sales Collected:</span>
                    <span style={{ fontWeight: 600 }}>+₹{((activeSession.totalCashSalesPaise || 0) / 100).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}>
                    <span>- Cash Refunds Paid:</span>
                    <span style={{ fontWeight: 600 }}>-₹{((activeSession.totalCashRefundsPaise || 0) / 100).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}>
                    <span>- Cash Petty Expenses:</span>
                    <span style={{ fontWeight: 600 }}>-₹{((activeSession.totalCashExpensesPaise || 0) / 100).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--color-border)', paddingTop: '8px', fontWeight: 700, fontSize: 'var(--font-base)', color: 'var(--color-primary)' }}>
                    <span>Expected Physical Cash:</span>
                    <span>₹{((activeSession.expectedCashPaise || 0) / 100).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--color-text-muted)' }}>
                <div style={{ fontSize: '36px', marginBottom: '8px' }}>🔒</div>
                <div style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: 'var(--font-base)' }}>
                  Cash drawer is currently closed.
                </div>
                <div style={{ fontSize: 'var(--font-xs)', marginTop: '4px' }}>
                  Open the register shift with your morning float to begin logging transactions.
                </div>
                <button
                  onClick={() => setIsOpenRegisterOpen(true)}
                  style={{
                    marginTop: '16px',
                    padding: '8px 16px',
                    background: '#059669',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--font-sm)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Open Cash Drawer
                </button>
              </div>
            )}
          </div>
        )}

        {/* Modal: Add Expense */}
        {isAddExpenseOpen && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(15, 23, 42, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1100,
              padding: 'var(--space-md)',
            }}
            onClick={() => setIsAddExpenseOpen(false)}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: 'var(--radius-xl)',
                width: '100%',
                maxWidth: '500px',
                padding: 'var(--space-lg)',
                boxShadow: 'var(--shadow-xl)',
                border: '1px solid var(--color-border)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: '0 0 var(--space-md) 0', fontSize: 'var(--font-lg)', fontWeight: 700, color: 'var(--color-text)' }}>
                Record Store Expenditure
              </h3>

              {modalError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '8px 12px', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-xs)', marginBottom: 'var(--space-md)' }}>
                  ⚠️ {modalError}
                </div>
              )}

              <form onSubmit={handleCreateExpense} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as ExpenseCategory)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-sm)', outline: 'none' }}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                      Amount (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="e.g. 250.00"
                      value={formAmountRupees}
                      onChange={(e) => setFormAmountRupees(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-sm)', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                      Payment Mode
                    </label>
                    <select
                      value={formPaymentMode}
                      onChange={(e) => setFormPaymentMode(e.target.value as ExpensePaymentMode)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-sm)', outline: 'none' }}
                    >
                      <option value="CASH">Cash (Petty Cash Drawer)</option>
                      <option value="UPI">UPI</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="CARD">Card</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                    Description (Audit Note)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Purchased 500 medicine carry bags"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-sm)', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                      Vendor / Store Name (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Sri Balaji Plastics"
                      value={formVendor}
                      onChange={(e) => setFormVendor(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-sm)', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                      Bill / Receipt # (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. RCP-8491"
                      value={formBillNumber}
                      onChange={(e) => setFormBillNumber(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-sm)', outline: 'none' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
                  <button
                    type="button"
                    onClick={() => setIsAddExpenseOpen(false)}
                    style={{ padding: '8px 16px', background: '#ffffff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={modalSubmitting}
                    style={{ padding: '8px 16px', background: 'var(--color-primary)', color: '#ffffff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {modalSubmitting ? 'Saving...' : 'Save Expense'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Open Cash Drawer */}
        {isOpenRegisterOpen && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(15, 23, 42, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1100,
              padding: 'var(--space-md)',
            }}
            onClick={() => setIsOpenRegisterOpen(false)}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: 'var(--radius-xl)',
                width: '100%',
                maxWidth: '450px',
                padding: 'var(--space-lg)',
                boxShadow: 'var(--shadow-xl)',
                border: '1px solid var(--color-border)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: '0 0 var(--space-md) 0', fontSize: 'var(--font-lg)', fontWeight: 700, color: 'var(--color-text)' }}>
                💵 Open Daily Cash Register Shift
              </h3>

              {modalError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '8px 12px', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-xs)', marginBottom: 'var(--space-md)' }}>
                  ⚠️ {modalError}
                </div>
              )}

              <form onSubmit={handleOpenRegister} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                    Opening Cash Float (₹)
                  </label>
                  <input
                    type="number"
                    step="1"
                    required
                    placeholder="e.g. 2000"
                    value={openingFloatRupees}
                    onChange={(e) => setOpeningFloatRupees(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-base)', fontWeight: 700, outline: 'none' }}
                  />
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                    Count physical notes & coins placed in cash drawer at shift start.
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                    Opening Notes (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Morning shift float counted"
                    value={openingNotes}
                    onChange={(e) => setOpeningNotes(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-sm)', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
                  <button
                    type="button"
                    onClick={() => setIsOpenRegisterOpen(false)}
                    style={{ padding: '8px 16px', background: '#ffffff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={modalSubmitting}
                    style={{ padding: '8px 16px', background: '#059669', color: '#ffffff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {modalSubmitting ? 'Opening...' : 'Confirm & Open Shift'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Close & Reconcile Register */}
        {isCloseRegisterOpen && activeSession && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(15, 23, 42, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1100,
              padding: 'var(--space-md)',
            }}
            onClick={() => setIsCloseRegisterOpen(false)}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: 'var(--radius-xl)',
                width: '100%',
                maxWidth: '480px',
                padding: 'var(--space-lg)',
                boxShadow: 'var(--shadow-xl)',
                border: '1px solid var(--color-border)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: '0 0 var(--space-md) 0', fontSize: 'var(--font-lg)', fontWeight: 700, color: 'var(--color-text)' }}>
                🔒 Reconcile & Close Cash Drawer
              </h3>

              {modalError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '8px 12px', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-xs)', marginBottom: 'var(--space-md)' }}>
                  ⚠️ {modalError}
                </div>
              )}

              <form onSubmit={handleCloseRegister} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)' }}>
                    <span>Opening Float:</span>
                    <span>₹{((activeSession.openingCashPaise || 0) / 100).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', marginTop: '2px' }}>
                    <span>Cash Sales:</span>
                    <span>+₹{((activeSession.totalCashSalesPaise || 0) / 100).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626', marginTop: '2px' }}>
                    <span>Refunds & Petty Cash:</span>
                    <span>-₹{(((activeSession.totalCashRefundsPaise || 0) + (activeSession.totalCashExpensesPaise || 0)) / 100).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #cbd5e1', paddingTop: '6px', marginTop: '6px', fontWeight: 700, color: 'var(--color-primary)' }}>
                    <span>Expected Physical Cash:</span>
                    <span>₹{((activeSession.expectedCashPaise || 0) / 100).toFixed(2)}</span>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                    Actual Counted Physical Cash in Drawer (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={countedCashRupees}
                    onChange={(e) => setCountedCashRupees(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '2px solid var(--color-primary)', fontSize: 'var(--font-lg)', fontWeight: 700, outline: 'none' }}
                  />
                  {countedCashRupees && (
                    <div style={{ marginTop: '6px', fontSize: 'var(--font-xs)', fontWeight: 600 }}>
                      {(() => {
                        const counted = Math.round(parseFloat(countedCashRupees) * 100);
                        const expected = activeSession.expectedCashPaise || 0;
                        const diff = counted - expected;
                        if (diff === 0) {
                          return <span style={{ color: '#059669' }}>✅ Exact match! Zero discrepancy.</span>;
                        } else if (diff > 0) {
                          return <span style={{ color: '#2563eb' }}>ℹ️ Cash Surplus: +₹{(diff / 100).toFixed(2)}</span>;
                        } else {
                          return <span style={{ color: '#dc2626' }}>⚠️ Cash Shortage: -₹{(Math.abs(diff) / 100).toFixed(2)}</span>;
                        }
                      })()}
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                    Closing Audit Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. End of day register closing count"
                    value={closingNotes}
                    onChange={(e) => setClosingNotes(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-sm)', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
                  <button
                    type="button"
                    onClick={() => setIsCloseRegisterOpen(false)}
                    style={{ padding: '8px 16px', background: '#ffffff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={modalSubmitting}
                    style={{ padding: '8px 16px', background: '#d97706', color: '#ffffff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {modalSubmitting ? 'Closing...' : 'Confirm Reconciliation & Lock'}
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
