'use client';

import React, { useEffect } from 'react';

interface InaugurationGreetingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InaugurationGreetingModal({ isOpen, onClose }: InaugurationGreetingModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.25s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          position: 'relative',
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          maxWidth: '560px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(226, 232, 240, 0.8)',
          border: '2px solid #e0e7ff',
          textAlign: 'center',
          padding: '28px 24px 24px',
          animation: 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Top-Right Close "X" Button */}
        <button
          onClick={onClose}
          aria-label="Close greeting"
          id="close-greeting-modal-btn"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: '#f1f5f9',
            border: '1px solid #cbd5e1',
            color: '#475569',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '18px',
            fontWeight: 700,
            transition: 'all 0.15s ease',
            zIndex: 10,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#ef4444';
            e.currentTarget.style.color = '#ffffff';
            e.currentTarget.style.borderColor = '#ef4444';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#f1f5f9';
            e.currentTarget.style.color = '#475569';
            e.currentTarget.style.borderColor = '#cbd5e1';
          }}
        >
          ✕
        </button>

        {/* Festive Badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 16px', borderRadius: '20px', background: 'linear-gradient(135deg, #fef3c7, #fde68a)', color: '#92400e', fontSize: '13px', fontWeight: 700, marginBottom: '14px', border: '1px solid #fcd34d' }}>
          <span>✨</span>
          <span>GRAND INAUGURATION • 26th OCTOBER</span>
          <span>✨</span>
        </div>

        {/* Main Title */}
        <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0', lineHeight: 1.3 }}>
          Heartiest Congratulations, Dearest Brother! 🎊
        </h2>
        <p style={{ fontSize: '13px', color: '#6366f1', fontWeight: 600, margin: '0 0 18px 0', letterSpacing: '0.02em' }}>
          Wishing You Immense Success, Healing Touch & Endless Prosperity!
        </p>

        {/* Brotherly Image */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '440px',
            height: '250px',
            margin: '0 auto 18px',
            borderRadius: '18px',
            overflow: 'hidden',
            boxShadow: '0 12px 28px -6px rgba(15, 23, 42, 0.18)',
            border: '3px solid #ffffff',
            outline: '1px solid #cbd5e1',
          }}
        >
          <img
            src="/images/image.png"
            alt="Brothers Together on Inauguration"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center 20%',
              display: 'block',
            }}
          />
        </div>

        {/* Heartfelt Message Box */}
        <div
          style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '18px 20px',
            textAlign: 'left',
            marginBottom: '20px',
            lineHeight: 1.6,
          }}
        >
          <p style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', margin: '0 0 8px 0' }}>
            To My Dearest Brother,
          </p>
          <p style={{ fontSize: '13px', color: '#334155', margin: '0 0 10px 0' }}>
            Seeing you take this big step and open your own pharmacy fills my heart with boundless pride and joy. May your counter always be a source of relief, wellness, and healing to every patient who walks in.
          </p>
          <p style={{ fontSize: '13px', color: '#334155', margin: '0 0 10px 0' }}>
            Step forward with confidence and passion. Remember that no matter how big your dreams are, your brother is standing right beside you, celebrating your every milestone.
          </p>
          <p style={{ fontSize: '13px', color: '#334155', margin: '0 0 14px 0' }}>
            May God bless your pharmacy with abundant prosperity, trusted goodwill, and glorious success!
          </p>
          <div style={{ textAlign: 'right', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
              With Endless Love & Blessings,
            </span>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#4f46e5' }}>
              Your Brother ❤️
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onClose}
          id="confirm-greeting-btn"
          style={{
            width: '100%',
            padding: '12px 24px',
            background: 'linear-gradient(135deg, #4f46e5, #0284c7)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 6px 18px rgba(79, 70, 229, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 14px rgba(79, 70, 229, 0.3)';
          }}
        >
          Thank You & Let&apos;s Begin ✨
        </button>
      </div>
    </div>
  );
}
