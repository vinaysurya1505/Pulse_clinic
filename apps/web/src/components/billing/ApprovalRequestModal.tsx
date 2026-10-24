'use client';

import React, { useState, useEffect } from 'react';
import { apiPost, ApiError } from '@/lib/api';
import { InvoiceRecord } from '@pulseclinic/types';

interface ApprovalRequestModalProps {
  invoice: InvoiceRecord;
  storeId: string;
  onClose: () => void;
  onRefundSuccess: () => void;
}

export function ApprovalRequestModal({
  invoice,
  storeId,
  onClose,
  onRefundSuccess,
}: ApprovalRequestModalProps) {
  // Step 1: REQUEST, Step 2: ENTER_CODE, Step 3: SUCCESS
  const [step, setStep] = useState<'REQUEST' | 'ENTER_CODE' | 'SUCCESS'>('REQUEST');
  const [reason, setReason] = useState('Customer Return');
  const [refundType, setRefundType] = useState<'FULL' | 'PARTIAL'>('FULL');

  // Request state
  const [requestId, setRequestId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(15 * 60);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verification state
  const [approvalCode, setApprovalCode] = useState('');
  const [attempts, setAttempts] = useState(0);

  // 15-minute countdown timer
  useEffect(() => {
    if (step !== 'ENTER_CODE' || !expiresAt) return;

    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [step, expiresAt]);

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSendRequest = async () => {
    if (!reason.trim()) {
      setError('Please provide a reason for cancellation / refund.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await apiPost<{
        success: boolean;
        requestId: string;
        expiresAt: string;
        message: string;
      }>(`/bills/${invoice.id}/request-approval`, { reason: reason.trim() }, storeId);

      if (res.success) {
        setRequestId(res.requestId);
        setExpiresAt(res.expiresAt);
        setStep('ENTER_CODE');
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to generate approval request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    if (!requestId) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await apiPost<{
        success: boolean;
        expiresAt: string;
        message: string;
      }>(`/bills/${invoice.id}/resend-approval`, { requestId }, storeId);

      if (res.success) {
        setExpiresAt(res.expiresAt);
        setApprovalCode('');
        alert('A new 8-character approval code was sent to the store administrator email.');
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to resend approval code.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExecuteRefund = async () => {
    const cleanedCode = approvalCode.trim().toUpperCase();
    if (cleanedCode.length !== 8) {
      setError('Please enter the full 8-character approval code.');
      return;
    }

    if (!requestId) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await apiPost<{
        success: boolean;
        refundId: string;
        invoiceStatus: string;
        message: string;
      }>(
        `/bills/${invoice.id}/refund`,
        {
          requestId,
          approvalCode: cleanedCode,
          reason,
          refundType,
        },
        storeId
      );

      if (res.success) {
        setStep('SUCCESS');
        setTimeout(() => {
          onRefundSuccess();
        }, 1500);
      }
    } catch (err: unknown) {
      setAttempts((prev) => prev + 1);
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to execute cancellation refund.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: 'var(--space-md)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 'var(--radius-xl)',
          width: '100%',
          maxWidth: '520px',
          boxShadow: 'var(--shadow-xl)',
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: 'var(--space-md) var(--space-lg)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#f8fafc',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 'var(--font-base)', fontWeight: 700, color: 'var(--color-text)' }}>
              Authorize Bill Cancellation & Refund
            </h3>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              Invoice {invoice.invoiceNumber} • ₹{((invoice.netPayablePaise || 0) / 100).toFixed(2)}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '18px',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: 'var(--space-lg)' }}>
          {error && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-xs)',
                marginBottom: 'var(--space-md)',
              }}
            >
              ⚠️ {error}
            </div>
          )}

          {step === 'REQUEST' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-sm) var(--space-md)',
                  fontSize: 'var(--font-xs)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                🔒 <strong>Dual Authorization Policy (ADR-015):</strong> To prevent fraudulent cancellations, a one-time 8-character approval code will be dispatched to the store administrator email.
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                  Refund Reason (Mandatory Audit Note)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Customer returned sealed items due to incorrect prescription..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--font-sm)',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                  Refund Scope
                </label>
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                  <button
                    type="button"
                    onClick={() => setRefundType('FULL')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--font-xs)',
                      fontWeight: 600,
                      border: refundType === 'FULL' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                      background: refundType === 'FULL' ? '#eff6ff' : '#ffffff',
                      color: refundType === 'FULL' ? 'var(--color-primary)' : 'var(--color-text)',
                      cursor: 'pointer',
                    }}
                  >
                    Full Invoice Refund (₹{((invoice.netPayablePaise || 0) / 100).toFixed(2)})
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'ENTER_CODE' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', textAlign: 'center' }}>
              <div style={{ fontSize: '36px' }}>📩</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 'var(--font-base)', color: 'var(--color-text)' }}>
                  Approval Code Sent
                </div>
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                  An 8-character authorization code was emailed to the store administrator.
                </div>
              </div>

              {/* Timer */}
              <div
                style={{
                  background: secondsRemaining > 60 ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${secondsRemaining > 60 ? '#bbf7d0' : '#fecaca'}`,
                  color: secondsRemaining > 60 ? '#166534' : '#991b1b',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 'var(--font-xs)',
                  fontWeight: 600,
                  display: 'inline-block',
                  margin: '0 auto',
                }}
              >
                ⏱️ Code expires in {formatTimer(secondsRemaining)}
              </div>

              {/* Code Input */}
              <div style={{ margin: '8px 0' }}>
                <label style={{ display: 'block', fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                  Enter 8-Character Approval Code
                </label>
                <input
                  type="text"
                  maxLength={8}
                  value={approvalCode}
                  onChange={(e) => setApprovalCode(e.target.value.toUpperCase())}
                  placeholder="XXXXXXXX"
                  style={{
                    width: '240px',
                    padding: '10px 14px',
                    textAlign: 'center',
                    fontSize: '24px',
                    fontWeight: 700,
                    letterSpacing: '6px',
                    fontFamily: 'monospace',
                    border: '2px solid var(--color-primary)',
                    borderRadius: 'var(--radius-md)',
                    outline: 'none',
                    background: '#ffffff',
                    color: 'var(--color-text)',
                  }}
                  autoFocus
                />
                <div style={{ fontSize: '11px', color: attempts > 0 ? '#dc2626' : 'var(--color-text-muted)', marginTop: '6px', fontWeight: attempts > 0 ? 600 : 400 }}>
                  {attempts > 0 ? `Failed attempt ${attempts} of 3. Code will lock on 3rd failure.` : 'Max 3 attempts permitted before lockout (RSK-012)'}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={submitting}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-primary)',
                    fontSize: 'var(--font-xs)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Didn't receive code? Resend
                </button>
              </div>
            </div>
          )}

          {step === 'SUCCESS' && (
            <div style={{ textAlign: 'center', padding: 'var(--space-lg) 0' }}>
              <div style={{ fontSize: '48px', color: '#16a34a', marginBottom: '8px' }}>✅</div>
              <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: 'var(--color-text)' }}>
                Bill Refunded Successfully
              </div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                Stock has been returned to inventory batches and sales reversal posted.
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {step !== 'SUCCESS' && (
          <div
            style={{
              padding: 'var(--space-md) var(--space-lg)',
              borderTop: '1px solid var(--color-border)',
              background: '#f8fafc',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 'var(--space-sm)',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                padding: '8px 16px',
                background: '#ffffff',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-sm)',
                fontWeight: 600,
                color: 'var(--color-text)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>

            {step === 'REQUEST' && (
              <button
                type="button"
                onClick={handleSendRequest}
                disabled={submitting}
                style={{
                  padding: '8px 16px',
                  background: 'var(--color-primary)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-sm)',
                  fontWeight: 600,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? 'Requesting...' : 'Request Approval Code'}
              </button>
            )}

            {step === 'ENTER_CODE' && (
              <button
                type="button"
                onClick={handleExecuteRefund}
                disabled={submitting || approvalCode.length !== 8}
                style={{
                  padding: '8px 16px',
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-sm)',
                  fontWeight: 600,
                  cursor: submitting || approvalCode.length !== 8 ? 'not-allowed' : 'pointer',
                  opacity: submitting || approvalCode.length !== 8 ? 0.6 : 1,
                }}
              >
                {submitting ? 'Verifying...' : 'Authorize & Return Stock'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
