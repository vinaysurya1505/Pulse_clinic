import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';

export default function HomePage() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  // State for interactive tab showcase
  const [activeTab, setActiveTab] = useState<'billing' | 'inventory' | 'multistore' | 'compliance'>('billing');

  // State for ROI Calculator
  const [storeCount, setStoreCount] = useState<number>(2);
  const [dailyBills, setDailyBills] = useState<number>(180);
  const [inventoryValue, setInventoryValue] = useState<number>(12); // In Lakhs INR

  // Computed ROI values
  const hoursSavedMonthly = Math.round(storeCount * dailyBills * 0.12);
  const expirySavedYearly = Math.round(inventoryValue * 100000 * 0.045);
  const revenueSpeedupPercent = Math.min(65, 30 + storeCount * 5);

  const handleLaunchApp = () => {
    if (!user) {
      router.push('/auth/signin');
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <>
      <Head>
        <title>PulseClinic | AI-Powered Next-Gen Pharmacy Management System</title>
        <meta
          name="description"
          content="The intelligent operating system for modern pharmacies. Lightning-fast POS billing, automated inventory forecasting, Schedule H1 compliance, and single-store ease."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', overflowX: 'hidden' }}>
        {/* Soft Ambient Light Glow & Grid */}
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundImage: 'radial-gradient(circle at 50% -10%, rgba(79, 70, 229, 0.08) 0%, rgba(2, 132, 199, 0.04) 40%, transparent 80%)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundImage: 'radial-gradient(rgba(15, 23, 42, 0.05) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
            pointerEvents: 'none',
            opacity: 0.8,
            zIndex: 0,
          }}
        />

        {/* Global Navigation Bar */}
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 50,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            borderBottom: '1px solid #e2e8f0',
            boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)',
          }}
        >
          <div
            style={{
              maxWidth: '1240px',
              margin: '0 auto',
              padding: '14px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            {/* Logo */}
            <div
              onClick={() => router.push('/')}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #4f46e5, #0284c7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)',
                  fontSize: '20px',
                  fontWeight: 800,
                  color: '#ffffff',
                }}
              >
                P
              </div>
              <div>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '20px',
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                    color: '#0f172a',
                  }}
                >
                  PulseClinic
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    color: '#0284c7',
                    fontWeight: 700,
                    marginTop: '-2px',
                  }}
                >
                  AI Pharmacy ERP
                </span>
              </div>
            </div>

            {/* Nav Links */}
            <nav style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
              <a href="#features" style={{ fontSize: '14px', color: '#475569', fontWeight: 600 }}>
                Features
              </a>
              <a href="#demo" style={{ fontSize: '14px', color: '#475569', fontWeight: 600 }}>
                Interactive Demo
              </a>
              <a href="#roi" style={{ fontSize: '14px', color: '#475569', fontWeight: 600 }}>
                ROI Calculator
              </a>
              <a href="#security" style={{ fontSize: '14px', color: '#475569', fontWeight: 600 }}>
                Compliance
              </a>
            </nav>

            {/* Right Action buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 10px',
                  borderRadius: '20px',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                }}
              >
                <div
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#059669',
                    boxShadow: '0 0 6px #059669',
                  }}
                />
                <span style={{ fontSize: '11px', color: '#15803d', fontWeight: 700 }}>v1.2 Online</span>
              </div>

              {!loading && user ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={handleLaunchApp}
                    id="nav-dashboard-btn"
                    style={{
                      padding: '8px 18px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #4f46e5, #0284c7)',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '13px',
                      boxShadow: '0 4px 14px rgba(79, 70, 229, 0.25)',
                      cursor: 'pointer',
                    }}
                  >
                    Go to Dashboard →
                  </button>
                  <button
                    onClick={signOut}
                    id="nav-signout-btn"
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      color: '#475569',
                      fontWeight: 600,
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Link
                    href="/auth/signin"
                    id="nav-signin-btn"
                    style={{
                      fontSize: '13px',
                      color: '#334155',
                      fontWeight: 600,
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                    }}
                  >
                    Sign In
                  </Link>
                  <button
                    onClick={handleLaunchApp}
                    id="nav-getstarted-btn"
                    style={{
                      padding: '8px 18px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #4f46e5, #0284c7)',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '13px',
                      boxShadow: '0 4px 14px rgba(79, 70, 229, 0.25)',
                      cursor: 'pointer',
                    }}
                  >
                    Launch Free Trial
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section style={{ position: 'relative', zIndex: 1, padding: '72px 24px 60px', maxWidth: '1240px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', maxWidth: '880px', margin: '0 auto' }}>
            {/* Pill Announcement */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 16px',
                borderRadius: '999px',
                background: '#eef2ff',
                border: '1px solid #c7d2fe',
                boxShadow: '0 2px 8px rgba(79, 70, 229, 0.08)',
                marginBottom: '24px',
              }}
            >
              <span style={{ fontSize: '14px' }}>✨</span>
              <span style={{ fontSize: '13px', color: '#4338ca', fontWeight: 700 }}>
                Next-Gen Pharmacy Intelligence 2.0
              </span>
              <span style={{ color: '#cbd5e1' }}>•</span>
              <span style={{ fontSize: '12px', color: '#0284c7', fontWeight: 700 }}>Schedule H1 Compliant</span>
            </div>

            {/* Main Headline */}
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(38px, 5.5vw, 68px)',
                fontWeight: 900,
                lineHeight: 1.1,
                letterSpacing: '-0.03em',
                marginBottom: '22px',
                color: '#0f172a',
              }}
            >
              Intelligent Pharmacy Operations,{' '}
              <span
                style={{
                  background: 'linear-gradient(135deg, #4f46e5 0%, #0284c7 50%, #059669 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Powered by AI
              </span>
            </h1>

            {/* Subtitle */}
            <p
              style={{
                fontSize: 'clamp(16px, 2vw, 19px)',
                lineHeight: 1.6,
                color: '#475569',
                maxWidth: '720px',
                margin: '0 auto 36px',
                fontWeight: 400,
              }}
            >
              Supercharge your dispensary with clinical precision. Lightning-speed GST billing in 1.2 seconds,
              predictive expiry radar, automated supplier PO generation, and tamper-proof compliance registers.
            </p>

            {/* CTA Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <button
                onClick={handleLaunchApp}
                id="hero-launch-btn"
                style={{
                  padding: '16px 36px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 50%, #0284c7 100%)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '16px',
                  fontWeight: 700,
                  boxShadow: '0 8px 24px rgba(79, 70, 229, 0.3)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <span>Launch Pharmacy Console</span>
                <span style={{ fontSize: '18px' }}>→</span>
              </button>

              <a
                href="#demo"
                id="hero-demo-btn"
                style={{
                  padding: '15px 28px',
                  borderRadius: '14px',
                  background: '#ffffff',
                  color: '#0f172a',
                  border: '1px solid #cbd5e1',
                  fontSize: '15px',
                  fontWeight: 600,
                  boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>⚡ Explore Interactive Demo</span>
              </a>
            </div>

            {/* Trust badge */}
            <div
              style={{
                marginTop: '42px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '24px',
                flexWrap: 'wrap',
                fontSize: '13px',
                color: '#64748b',
                fontWeight: 500,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#059669', fontWeight: 700 }}>✓</span> Zero Hardware Lock-in
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#059669', fontWeight: 700 }}>✓</span> Offline-Ready Architecture
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#059669', fontWeight: 700 }}>✓</span> 100% CDSCO Compliant
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#059669', fontWeight: 700 }}>✓</span> Secure Cloud Gateway
              </div>
            </div>
          </div>

          {/* Hero Visual Image Showcase */}
          <div
            style={{
              marginTop: '56px',
              position: 'relative',
              borderRadius: '24px',
              padding: '10px',
              background: 'linear-gradient(180deg, rgba(79, 70, 229, 0.12) 0%, rgba(2, 132, 199, 0.06) 50%, #ffffff 100%)',
              boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.1)',
              border: '1px solid #e2e8f0',
            }}
          >
            <div
              style={{
                position: 'relative',
                borderRadius: '18px',
                overflow: 'hidden',
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: 'auto',
                  aspectRatio: '16/9',
                  maxHeight: '580px',
                }}
              >
                <Image
                  src="/images/hero-dashboard.jpg"
                  alt="PulseClinic AI Pharmacy Intelligence Interface"
                  fill
                  priority
                  style={{ objectFit: 'cover' }}
                />

                {/* Overlaid Live Badges */}
                <div
                  style={{
                    position: 'absolute',
                    top: '20px',
                    left: '20px',
                    padding: '10px 16px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.94)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 6px 20px rgba(15, 23, 42, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <div
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: '#059669',
                      boxShadow: '0 0 8px #059669',
                    }}
                  />
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Live Pharmacy Telemetry</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                      Smart Reorder Active • 99.4% Stock Fill
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    position: 'absolute',
                    bottom: '20px',
                    right: '20px',
                    padding: '12px 18px',
                    borderRadius: '14px',
                    background: 'rgba(255, 255, 255, 0.94)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.1)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#0284c7',
                        fontWeight: 700,
                      }}
                    >
                      ⚡
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#0284c7', fontWeight: 700 }}>Checkout Velocity</div>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                        1.2s Average Bill Generation
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Real-time KPI Stats Bar */}
        <section
          style={{
            position: 'relative',
            zIndex: 1,
            borderTop: '1px solid #e2e8f0',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            padding: '40px 24px',
            boxShadow: '0 2px 10px rgba(15, 23, 42, 0.02)',
          }}
        >
          <div
            style={{
              maxWidth: '1240px',
              margin: '0 auto',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '32px',
              textAlign: 'center',
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '38px',
                  fontWeight: 900,
                  color: '#4f46e5',
                  letterSpacing: '-0.02em',
                }}
              >
                99.98%
              </div>
              <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 700, marginTop: '4px' }}>
                Inventory Audit Accuracy
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Automated batch & serial sync</div>
            </div>

            <div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '38px',
                  fontWeight: 900,
                  color: '#0284c7',
                  letterSpacing: '-0.02em',
                }}
              >
                &lt; 1.2s
              </div>
              <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 700, marginTop: '4px' }}>
                POS Checkout Speed
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Instant GST & tax breakdown</div>
            </div>

            <div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '38px',
                  fontWeight: 900,
                  color: '#059669',
                  letterSpacing: '-0.02em',
                }}
              >
                Zero Loss
              </div>
              <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 700, marginTop: '4px' }}>
                Expiry Waste Prevention
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>90/60/30-day proactive alerts</div>
            </div>

            <div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '38px',
                  fontWeight: 900,
                  color: '#d97706',
                  letterSpacing: '-0.02em',
                }}
              >
                100%
              </div>
              <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 700, marginTop: '4px' }}>
                CDSCO & Schedule H1 Safe
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Built-in doctor Rx compliance</div>
            </div>
          </div>
        </section>

        {/* Interactive Feature Workbench Showcase */}
        <section
          id="demo"
          style={{
            position: 'relative',
            zIndex: 1,
            padding: '96px 24px',
            maxWidth: '1240px',
            margin: '0 auto',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: '#4f46e5',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
              }}
            >
              Interactive Workbench Preview
            </span>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(28px, 4vw, 42px)',
                fontWeight: 800,
                marginTop: '8px',
                letterSpacing: '-0.02em',
                color: '#0f172a',
              }}
            >
              Explore the Power of PulseClinic
            </h2>
            <p style={{ color: '#475569', fontSize: '16px', maxWidth: '640px', margin: '8px auto 0' }}>
              Click between the modules below to see how PulseClinic handles critical retail & clinical pharmacy operations.
            </p>
          </div>

          {/* Feature Tabs */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '12px',
              flexWrap: 'wrap',
              marginBottom: '36px',
            }}
          >
            {[
              { id: 'billing', label: '⚡ Ultra-Fast POS Billing', icon: '🧾' },
              { id: 'inventory', label: '🤖 AI Stock & Expiry Agent', icon: '📦' },
              { id: 'multistore', label: '🏥 Pharmacy Master Profile', icon: '🏢' },
              { id: 'compliance', label: '🛡️ Schedule H1 & CDSCO', icon: '📑' },
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  id={`tab-${tab.id}`}
                  style={{
                    padding: '12px 22px',
                    borderRadius: '12px',
                    background: active ? '#4f46e5' : '#ffffff',
                    border: active ? '1px solid #4338ca' : '1px solid #cbd5e1',
                    color: active ? '#ffffff' : '#334155',
                    fontWeight: 700,
                    fontSize: '14px',
                    cursor: 'pointer',
                    boxShadow: active ? '0 4px 16px rgba(79, 70, 229, 0.25)' : '0 2px 6px rgba(15, 23, 42, 0.04)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Interactive Screen Display */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '20px',
              padding: '32px',
              boxShadow: '0 20px 45px rgba(15, 23, 42, 0.06)',
            }}
          >
            {activeTab === 'billing' && (
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid #e2e8f0',
                    paddingBottom: '20px',
                    marginBottom: '24px',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                      Fast POS Counter • Invoice #INV-2026-0891
                    </h3>
                    <p style={{ fontSize: '13px', color: '#64748b' }}>
                      Patient: Ramesh Patel (+91 98765-43210) • Doctor: Dr. S. Kulkarni (Reg #MH-44210)
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span
                      style={{
                        padding: '6px 12px',
                        background: '#f0fdf4',
                        color: '#15803d',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 700,
                        border: '1px solid #bbf7d0',
                      }}
                    >
                      Barcode Scanner Ready
                    </span>
                    <span
                      style={{
                        padding: '6px 12px',
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 700,
                        border: '1px solid #bfdbfe',
                      }}
                    >
                      GST Split Enabled
                    </span>
                  </div>
                </div>

                {/* Table Simulation */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ color: '#64748b', borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ padding: '12px' }}>Medicine / Salt</th>
                        <th style={{ padding: '12px' }}>Batch No.</th>
                        <th style={{ padding: '12px' }}>Expiry</th>
                        <th style={{ padding: '12px' }}>Qty</th>
                        <th style={{ padding: '12px' }}>MRP</th>
                        <th style={{ padding: '12px' }}>GST%</th>
                        <th style={{ padding: '12px' }}>Total (INR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px', fontWeight: 600, color: '#0f172a' }}>Augmentin 625 Duo Tab (Amoxycillin + Clavulanic)</td>
                        <td style={{ padding: '12px', color: '#0284c7', fontWeight: 600 }}>AUG-9912A</td>
                        <td style={{ padding: '12px', color: '#059669', fontWeight: 600 }}>10/2027</td>
                        <td style={{ padding: '12px' }}>2 Strips</td>
                        <td style={{ padding: '12px' }}>₹204.50</td>
                        <td style={{ padding: '12px' }}>12%</td>
                        <td style={{ padding: '12px', fontWeight: 700, color: '#0f172a' }}>₹409.00</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px', fontWeight: 600, color: '#0f172a' }}>Pan-D Capsule (Pantoprazole + Domperidone)</td>
                        <td style={{ padding: '12px', color: '#0284c7', fontWeight: 600 }}>PND-5541</td>
                        <td style={{ padding: '12px', color: '#059669', fontWeight: 600 }}>08/2027</td>
                        <td style={{ padding: '12px' }}>1 Strip</td>
                        <td style={{ padding: '12px' }}>₹198.00</td>
                        <td style={{ padding: '12px' }}>12%</td>
                        <td style={{ padding: '12px', fontWeight: 700, color: '#0f172a' }}>₹198.00</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px', fontWeight: 600, color: '#0f172a' }}>Azee 500mg Tablet (Azithromycin)</td>
                        <td style={{ padding: '12px', color: '#0284c7', fontWeight: 600 }}>AZ-3301B</td>
                        <td style={{ padding: '12px', color: '#059669', fontWeight: 600 }}>12/2027</td>
                        <td style={{ padding: '12px' }}>1 Strip</td>
                        <td style={{ padding: '12px' }}>₹119.50</td>
                        <td style={{ padding: '12px' }}>12%</td>
                        <td style={{ padding: '12px', fontWeight: 700, color: '#0f172a' }}>₹119.50</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '24px',
                    padding: '16px 20px',
                    background: '#f8fafc',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', gap: '20px', fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                    <span>Subtotal: ₹648.66</span>
                    <span>CGST (6%): ₹38.92</span>
                    <span>SGST (6%): ₹38.92</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>Total Payable: </span>
                      <span style={{ fontSize: '22px', fontWeight: 800, color: '#059669' }}>₹726.50</span>
                    </div>
                    <button
                      onClick={handleLaunchApp}
                      style={{
                        padding: '10px 20px',
                        background: '#059669',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 700,
                        fontSize: '14px',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)',
                      }}
                    >
                      Print & WhatsApp Bill
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'inventory' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div>
                    <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                      AI Stock Intelligence & Expiry Radar
                    </h3>
                    <p style={{ fontSize: '13px', color: '#64748b' }}>
                      Automated telemetry preventing out-of-stock events and near-expiry write-offs.
                    </p>
                  </div>
                  <span
                    style={{
                      padding: '6px 14px',
                      background: '#fffbeb',
                      color: '#b45309',
                      border: '1px solid #fde68a',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    2 Critical Actions Pending
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  <div
                    style={{
                      padding: '20px',
                      borderRadius: '14px',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#b91c1c', fontWeight: 700 }}>
                        ⚠️ Expiry Alert • 28 Days Left
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Batch #TEL-1102</span>
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 800, marginTop: '8px', color: '#0f172a' }}>
                      Telma-H 40mg Tablet
                    </div>
                    <p style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>
                      14 Strips remaining in Store Shelf B-4. AI Recommendation: Trigger vendor return or markdown to patient repeat queue.
                    </p>
                    <button
                      onClick={handleLaunchApp}
                      style={{
                        marginTop: '12px',
                        padding: '8px 14px',
                        background: '#dc2626',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 700,
                      }}
                    >
                      Process Return to Distributor
                    </button>
                  </div>

                  <div
                    style={{
                      padding: '20px',
                      borderRadius: '14px',
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: 700 }}>
                        🤖 AI Auto-Purchase Order
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Depletion Trend High</span>
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 800, marginTop: '8px', color: '#0f172a' }}>
                      Dolo 650mg (Paracetamol)
                    </div>
                    <p style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>
                      Current stock: 8 boxes. Daily run-rate: 4.5 boxes. Generated draft PO for 50 boxes from Sun Pharma distributor.
                    </p>
                    <button
                      onClick={handleLaunchApp}
                      style={{
                        marginTop: '12px',
                        padding: '8px 14px',
                        background: '#0284c7',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 700,
                      }}
                    >
                      Approve & Send PO via EDI
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'multistore' && (
              <div>
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                    Pharmacy Master Store Profile
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748b' }}>
                    Dedicated single-store pharmacy environment configured with full administrative privileges.
                  </p>
                </div>

                <div
                  style={{
                    padding: '24px',
                    borderRadius: '14px',
                    background: '#eef2ff',
                    border: '1px solid #c7d2fe',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#4338ca', textTransform: 'uppercase' }}>
                      PRIMARY ACTIVE STORE
                    </span>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#059669' }} />
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '6px', color: '#0f172a' }}>
                    PulseClinic Pharmacy
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                    Store ID: pulseclinic-main
                  </div>
                  <div style={{ marginTop: '16px', display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '13px', color: '#334155' }}>
                    <div>Assigned Access: <strong>Full Pharmacy Owner</strong></div>
                    <div>Cloud Sync: <strong>Connected (Firebase)</strong></div>
                    <div>GST Billing: <strong>Standard CGST/SGST</strong></div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'compliance' && (
              <div>
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                    Schedule H & H1 Drug Regulatory Register
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748b' }}>
                    Automated antibiotic & scheduled narcotic audit logs meeting CDSCO & State FDA regulations.
                  </p>
                </div>

                <div
                  style={{
                    padding: '18px',
                    borderRadius: '12px',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '22px' }}>✅</span>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#15803d' }}>
                        Tamper-Proof Audit Trail Active
                      </div>
                      <div style={{ fontSize: '12px', color: '#475569' }}>
                        All Schedule H1 dispense events record: Prescriber Registration Number, Patient Address, Batch No, and Sign-off Pharmacist UID.
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '13px', color: '#64748b', fontStyle: 'italic', textAlign: 'center' }}>
                  Exportable in FDA-approved Excel and signed PDF formats at any time.
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Feature Highlights Grid */}
        <section
          id="features"
          style={{
            position: 'relative',
            zIndex: 1,
            padding: '80px 24px',
            maxWidth: '1240px',
            margin: '0 auto',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: '#0284c7',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
              }}
            >
              Enterprise Capabilities
            </span>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(28px, 4vw, 40px)',
                fontWeight: 800,
                marginTop: '8px',
                letterSpacing: '-0.02em',
                color: '#0f172a',
              }}
            >
              Engineered for High-Volume Pharmacies
            </h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '24px',
            }}
          >
            {[
              {
                icon: '⚡',
                title: 'High-Velocity POS Terminal',
                desc: 'Sub-second barcode lookup, keyboard-first navigation (Alt+N, Alt+S), instant GST invoice generation, and WhatsApp billing.',
              },
              {
                icon: '🤖',
                title: 'AI Stock Forecasting Agent',
                desc: 'Predict demand surges based on seasonal epidemiology, supplier lead times, and automated economic order quantity (EOQ).',
              },
              {
                icon: '🛡️',
                title: 'CDSCO Schedule H1 Lock',
                desc: 'Strict enforcement preventing dispensing of controlled antibiotics without valid doctor registration numbers and digital Rx proof.',
              },
              {
                icon: '🏢',
                title: 'Dedicated Store Security',
                desc: 'Complete Firestore security rules ensuring strict encryption and tamper-proof records for all inventory transactions.',
              },
              {
                icon: '📊',
                title: 'Real-time Financial Telemetry',
                desc: 'Live tracking of gross margin, supplier payables, GST-1/3B audit summaries, and daily counter cash reconciliation.',
              },
              {
                icon: '🔐',
                title: 'Role-Based Access Control',
                desc: 'Pre-configured granular roles: Owner, Pharmacy Manager, Dispensing Chemist, Billing Cashier, and Compliance Auditor.',
              },
            ].map((feature, idx) => (
              <div
                key={idx}
                style={{
                  padding: '28px',
                  borderRadius: '16px',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: '#eef2ff',
                    border: '1px solid #c7d2fe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    marginBottom: '18px',
                  }}
                >
                  {feature.icon}
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '8px', color: '#0f172a' }}>
                  {feature.title}
                </h3>
                <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#475569' }}>{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Interactive ROI Calculator */}
        <section
          id="roi"
          style={{
            position: 'relative',
            zIndex: 1,
            padding: '80px 24px',
            maxWidth: '1080px',
            margin: '0 auto',
          }}
        >
          <div
            style={{
              padding: '48px 36px',
              borderRadius: '24px',
              background: 'linear-gradient(135deg, #eef2ff 0%, #f0fdf4 100%)',
              border: '1px solid #c7d2fe',
              boxShadow: '0 10px 30px rgba(79, 70, 229, 0.08)',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '36px' }}>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#4338ca',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                }}
              >
                Pharmacy Scale & Value Impact
              </span>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '32px',
                  fontWeight: 800,
                  marginTop: '6px',
                  color: '#0f172a',
                }}
              >
                Estimate Your Return on Investment
              </h2>
              <p style={{ color: '#475569', fontSize: '15px', marginTop: '6px' }}>
                Adjust your pharmacy network parameters below to see estimated monthly time and capital savings.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '32px' }}>
              {/* Sliders */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>Number of Store Branches</span>
                    <span style={{ fontSize: '15px', fontWeight: 800, color: '#4f46e5' }}>{storeCount} Locations</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="15"
                    value={storeCount}
                    onChange={(e) => setStoreCount(parseInt(e.target.value))}
                    style={{ width: '100%', accentColor: '#4f46e5', cursor: 'pointer' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>Avg Bills Per Day (Per Store)</span>
                    <span style={{ fontSize: '15px', fontWeight: 800, color: '#0284c7' }}>{dailyBills} Bills</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="600"
                    step="10"
                    value={dailyBills}
                    onChange={(e) => setDailyBills(parseInt(e.target.value))}
                    style={{ width: '100%', accentColor: '#0284c7', cursor: 'pointer' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>Avg Inventory Holding Value</span>
                    <span style={{ fontSize: '15px', fontWeight: 800, color: '#059669' }}>₹{inventoryValue} Lakhs</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="50"
                    value={inventoryValue}
                    onChange={(e) => setInventoryValue(parseInt(e.target.value))}
                    style={{ width: '100%', accentColor: '#059669', cursor: 'pointer' }}
                  />
                </div>
              </div>

              {/* Dynamic ROI Metrics */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  gap: '16px',
                  background: '#ffffff',
                  padding: '28px',
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 16px rgba(15, 23, 42, 0.05)',
                }}
              >
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Estimated Hours Saved Monthly</div>
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '32px',
                      fontWeight: 800,
                      color: '#4f46e5',
                    }}
                  >
                    ~{hoursSavedMonthly} hrs / mo
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Prevented Expiry Losses Yearly</div>
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '32px',
                      fontWeight: 800,
                      color: '#059669',
                    }}
                  >
                    ₹{expirySavedYearly.toLocaleString('en-IN')} / yr
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Counter Checkout Speed Boost</div>
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '28px',
                      fontWeight: 800,
                      color: '#0284c7',
                    }}
                  >
                    +{revenueSpeedupPercent}% Velocity
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Security & Compliance Section */}
        <section
          id="security"
          style={{
            position: 'relative',
            zIndex: 1,
            padding: '80px 24px',
            maxWidth: '1240px',
            margin: '0 auto',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '40px',
              alignItems: 'center',
            }}
          >
            <div>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#059669',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                }}
              >
                Bank-Grade Architecture
              </span>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '36px',
                  fontWeight: 800,
                  marginTop: '8px',
                  lineHeight: 1.2,
                  color: '#0f172a',
                }}
              >
                Security and Regulatory Compliance Built-in
              </h2>
              <p style={{ color: '#475569', fontSize: '15px', lineHeight: 1.6, marginTop: '14px' }}>
                Pharmacy data demands clinical precision and absolute privacy. PulseClinic enforces cryptographic isolation,
                Firebase Cloud authentication, tamper-proof audit logging, and continuous automated backups.
              </p>

              <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {[
                  'Firestore Security Rules verifying active store permissions on every operation',
                  'Doctor Registration and Patient Address enforcement for Schedule H & H1',
                  'Auditor read-only inspection roles with non-repudiation export logs',
                  '99.99% multi-region cloud uptime SLA with offline client resilience',
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#059669',
                        fontSize: '11px',
                        fontWeight: 700,
                      }}
                    >
                      ✓
                    </div>
                    <span style={{ fontSize: '14px', color: '#334155', fontWeight: 500 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '20px',
                padding: '32px',
                boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
              }}
            >
              <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '16px', color: '#0f172a' }}>
                Compliance Matrix Verification
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { reg: 'Drugs and Cosmetics Act, 1940', status: 'Compliant', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
                  { reg: 'Schedule H1 Antibiotic Register Rule 65', status: 'Enforced', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
                  { reg: 'GST Invoice Standard Rule 46 (CGST)', status: 'Certified', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
                  { reg: 'HIPAA & ISO 27001 Cloud Isolation', status: 'Verified', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
                  { reg: 'Role-Based Access Control (RBAC)', status: 'Active', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
                ].map((row, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      background: '#f8fafc',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <span style={{ fontSize: '13px', color: '#334155', fontWeight: 600 }}>{row.reg}</span>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        color: row.color,
                        padding: '3px 10px',
                        borderRadius: '20px',
                        background: row.bg,
                        border: `1px solid ${row.border}`,
                      }}
                    >
                      {row.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Call to Action Banner */}
        <section
          style={{
            position: 'relative',
            zIndex: 1,
            padding: '80px 24px',
            maxWidth: '1240px',
            margin: '0 auto',
          }}
        >
          <div
            style={{
              padding: '60px 36px',
              borderRadius: '28px',
              background: 'linear-gradient(135deg, #4338ca 0%, #3730a3 50%, #0284c7 100%)',
              textAlign: 'center',
              boxShadow: '0 20px 50px rgba(79, 70, 229, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(28px, 4.5vw, 48px)',
                fontWeight: 900,
                color: '#ffffff',
                marginBottom: '16px',
                letterSpacing: '-0.02em',
              }}
            >
              Ready to Upgrade Your Pharmacy Operations?
            </h2>
            <p
              style={{
                fontSize: '17px',
                color: '#e0e7ff',
                maxWidth: '640px',
                margin: '0 auto 32px',
                lineHeight: 1.6,
              }}
            >
              Experience faster checkout times, zero drug expiry losses, and a seamless clinical dispensary experience.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <button
                onClick={handleLaunchApp}
                id="cta-launch-btn"
                style={{
                  padding: '16px 38px',
                  borderRadius: '14px',
                  background: '#ffffff',
                  color: '#4338ca',
                  border: 'none',
                  fontSize: '16px',
                  fontWeight: 800,
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
                  cursor: 'pointer',
                }}
              >
                Launch PulseClinic Now →
              </button>
            </div>
          </div>
        </section>

        {/* Global Footer */}
        <footer
          style={{
            position: 'relative',
            zIndex: 1,
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            padding: '60px 24px 36px',
          }}
        >
          <div
            style={{
              maxWidth: '1240px',
              margin: '0 auto',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '40px',
              marginBottom: '48px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #4f46e5, #0284c7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '16px',
                    color: '#ffffff',
                  }}
                >
                  P
                </div>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                  PulseClinic
                </span>
              </div>
              <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.6 }}>
                AI-powered clinical pharmacy ERP and POS operating system.
              </p>
            </div>

            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '14px' }}>Platform</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: '#475569' }}>
                <a href="#features">POS Terminal</a>
                <a href="#features">Inventory Telemetry</a>
                <a href="#features">Store RBAC</a>
                <a href="#security">Schedule H1 Compliance</a>
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '14px' }}>Quick Access</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: '#475569' }}>
                <Link href="/auth/signin">Sign In to Store</Link>
                <Link href="/dashboard">Pharmacist Console</Link>
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '14px' }}>Legal & Security</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: '#64748b' }}>
                <span>CDSCO Rule 65 Compliance</span>
                <span>GST Rule 46 Certified</span>
                <span>HIPAA Data Guard</span>
                <span>ISO 27001 Controls</span>
              </div>
            </div>
          </div>

          <div
            style={{
              maxWidth: '1240px',
              margin: '0 auto',
              borderTop: '1px solid #e2e8f0',
              paddingTop: '24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              fontSize: '12px',
              color: '#64748b',
            }}
          >
            <div>© {new Date().getFullYear()} PulseClinic Systems Inc. All rights reserved.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#059669' }} />
              <span>All Systems Operational • Cloud Sync Active</span>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
