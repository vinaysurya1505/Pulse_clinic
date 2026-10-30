import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';

const features = [
  {
    icon: '⚡',
    title: 'Lightning-Fast Billing',
    desc: 'Generate GST-compliant invoices in under 2 seconds. Barcode scanning, keyboard shortcuts, and instant WhatsApp receipts.',
    gradient: 'linear-gradient(135deg, #eef2ff, #e0e7ff)',
    border: '#c7d2fe',
  },
  {
    icon: '📦',
    title: 'Smart Inventory Radar',
    desc: 'AI-powered expiry alerts at 90, 60, and 30 days. Auto-generates purchase orders based on demand patterns.',
    gradient: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
    border: '#a7f3d0',
  },
  {
    icon: '🛡️',
    title: 'Schedule H1 Compliance',
    desc: 'Automated registers for controlled drugs. Doctor Rx verification, patient records, and tamper-proof audit trails.',
    gradient: 'linear-gradient(135deg, #fffbeb, #fef3c7)',
    border: '#fde68a',
  },
  {
    icon: '📊',
    title: 'Financial Dashboard',
    desc: 'Real-time margins, GST summaries, supplier payables, and daily cash reconciliation at a glance.',
    gradient: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
    border: '#bfdbfe',
  },
  {
    icon: '🔐',
    title: 'Role-Based Access',
    desc: 'Granular permissions for Owner, Pharmacist, Cashier, and Auditor. Every action is logged and traceable.',
    gradient: 'linear-gradient(135deg, #fdf2f8, #fce7f3)',
    border: '#fbcfe8',
  },
  {
    icon: '☁️',
    title: 'Cloud-First, Offline-Ready',
    desc: 'Secure Firebase backend with offline resilience. Your data syncs automatically when connectivity returns.',
    gradient: 'linear-gradient(135deg, #f0fdfa, #ccfbf1)',
    border: '#99f6e4',
  },
];

const tabs = [
  { id: 'billing', label: 'POS Billing' },
  { id: 'inventory', label: 'Stock & Expiry' },
  { id: 'store', label: 'Store Profile' },
  { id: 'compliance', label: 'Compliance' },
] as const;

type TabId = typeof tabs[number]['id'];

export default function HomePage() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('billing');

  const [storeCount, setStoreCount] = useState(2);
  const [dailyBills, setDailyBills] = useState(180);
  const [inventoryValue, setInventoryValue] = useState(12);

  const hoursSavedMonthly = Math.round(storeCount * dailyBills * 0.12);
  const expirySavedYearly = Math.round(inventoryValue * 100000 * 0.045);
  const speedBoost = Math.min(65, 30 + storeCount * 5);

  const goToApp = () => router.push(user ? '/dashboard' : '/auth/signin');

  return (
    <>
      <Head>
        <title>New Sanjivani Multispeciality Clinic | Pharmacy Management</title>
        <meta
          name="description"
          content="Intelligent pharmacy management for New Sanjivani Clinic. Fast billing, smart inventory, Schedule H1 compliance, and real-time analytics."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)', overflowX: 'hidden' }}>
        {/* Ambient background */}
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'radial-gradient(ellipse at 50% -20%, rgba(79, 70, 229, 0.06) 0%, rgba(2, 132, 199, 0.03) 40%, transparent 70%)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        {/* ─── Navigation ─── */}
        <header className="home-nav">
          <div className="home-nav-inner">
            <div onClick={() => router.push('/')} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: 'var(--gradient-brand)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'var(--glow-primary)',
                  fontSize: 20,
                  fontWeight: 800,
                  color: '#fff',
                }}
              >
                S
              </div>
              <div>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>
                  New Sanjivani
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    color: 'var(--color-secondary-hover)',
                    fontWeight: 700,
                    marginTop: -2,
                  }}
                >
                  Pharmacy Management
                </span>
              </div>
            </div>

            <nav className="home-nav-links">
              <a href="#features" className="home-nav-link">Features</a>
              <a href="#demo" className="home-nav-link">Demo</a>
              <a href="#roi" className="home-nav-link">ROI Calculator</a>
              <a href="#compliance" className="home-nav-link">Compliance</a>
            </nav>

            <div className="home-nav-actions" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                className="home-nav-version"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 12px',
                  borderRadius: 20,
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                }}
              >
                <span className="home-live-dot" />
                <span style={{ fontSize: 11, color: '#15803d', fontWeight: 700 }}>Online</span>
              </div>

              {!loading && user ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={goToApp} className="home-btn-small" style={{ background: 'var(--gradient-brand)', color: '#fff', boxShadow: 'var(--glow-primary)' }}>
                    Dashboard →
                  </button>
                  <button onClick={signOut} className="home-btn-small" style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                    Sign Out
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Link
                    href="/auth/signin"
                    style={{
                      fontSize: 13,
                      color: 'var(--color-text-secondary)',
                      fontWeight: 600,
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: '1px solid var(--color-border)',
                      background: '#fff',
                    }}
                  >
                    Sign In
                  </Link>
                  <button onClick={goToApp} className="home-btn-small" style={{ background: 'var(--gradient-brand)', color: '#fff', boxShadow: 'var(--glow-primary)' }}>
                    Get Started
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ─── Hero ─── */}
        <section className="home-hero">
          <div style={{ maxWidth: 860, margin: '0 auto' }}>
            <div className="home-pill home-fade-in">
              <span style={{ color: '#4338ca', fontWeight: 700 }}>Next-Gen Pharmacy Intelligence</span>
              <span style={{ color: 'var(--color-border)' }}>|</span>
              <span style={{ fontSize: 12, color: 'var(--color-secondary-hover)', fontWeight: 700 }}>Schedule H1 Compliant</span>
            </div>

            <h1 className="home-fade-in home-fade-in-delay-1">
              Your Pharmacy,{' '}
              <span className="text-gradient">Brilliantly Managed</span>
            </h1>

            <p className="home-hero-sub home-fade-in home-fade-in-delay-2">
              Everything your dispensary needs in one place — fast GST billing, smart expiry alerts,
              automated stock orders, and airtight compliance registers.
            </p>

            <div className="home-fade-in home-fade-in-delay-3" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
              <button onClick={goToApp} className="home-btn-primary">
                <span>Open Pharmacy Console</span>
                <span style={{ fontSize: 18 }}>→</span>
              </button>
              <a href="#demo" className="home-btn-secondary">
                See It In Action
              </a>
            </div>

            <div className="home-trust-row home-fade-in home-fade-in-delay-4">
              {['Zero Hardware Lock-in', 'Offline-Ready', '100% CDSCO Compliant', 'Secure Cloud'].map((t) => (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#059669', fontWeight: 700, fontSize: 14 }}>✓</span> {t}
                </div>
              ))}
            </div>
          </div>

          {/* Hero Image */}
          <div className="home-hero-frame home-fade-in home-fade-in-delay-4">
            <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
              <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', maxHeight: 560 }}>
                <Image
                  src="/images/hero-dashboard.jpg"
                  alt="New Sanjivani Clinic Dashboard"
                  fill
                  priority
                  style={{ objectFit: 'cover' }}
                />

                <div className="home-floating-badge" style={{ top: 20, left: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="home-live-dot" />
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>Live Pharmacy Status</div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>Smart Reorder Active</div>
                    </div>
                  </div>
                </div>

                <div className="home-floating-badge" style={{ bottom: 20, right: 20, animationDelay: '3s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 16,
                      }}
                    >
                      ⚡
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--color-secondary-hover)', fontWeight: 700 }}>Checkout Speed</div>
                      <div style={{ fontSize: 14, fontWeight: 800 }}>1.2s Avg Bill Time</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── KPI Stats ─── */}
        <section className="home-stats">
          <div className="home-stats-grid">
            {[
              { value: '99.98%', label: 'Inventory Accuracy', desc: 'Batch & serial sync', color: '#4f46e5' },
              { value: '< 1.2s', label: 'Checkout Speed', desc: 'With instant GST split', color: '#0284c7' },
              { value: 'Zero', label: 'Expiry Waste', desc: '90/60/30-day alerts', color: '#059669' },
              { value: '100%', label: 'CDSCO Compliant', desc: 'Schedule H & H1 safe', color: '#d97706' },
            ].map((s) => (
              <div key={s.label}>
                <div className="home-stat-value" style={{ color: s.color }}>{s.value}</div>
                <div className="home-stat-label">{s.label}</div>
                <div className="home-stat-desc">{s.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Interactive Demo ─── */}
        <section id="demo" className="home-section">
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <span className="home-section-label" style={{ color: 'var(--color-primary)' }}>Interactive Preview</span>
            <h2 className="home-section-title">See How It Works</h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 16, maxWidth: 560, margin: '8px auto 0' }}>
              Explore each module to see how New Sanjivani handles your pharmacy operations.
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 32 }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`home-tab ${activeTab === tab.id ? 'home-tab-active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="home-demo-panel">
            {activeTab === 'billing' && <BillingDemo onAction={goToApp} />}
            {activeTab === 'inventory' && <InventoryDemo onAction={goToApp} />}
            {activeTab === 'store' && <StoreDemo />}
            {activeTab === 'compliance' && <ComplianceDemo />}
          </div>
        </section>

        {/* ─── Features ─── */}
        <section id="features" className="home-section" style={{ paddingTop: 0 }}>
          <div style={{ textAlign: 'center' }}>
            <span className="home-section-label" style={{ color: 'var(--color-secondary-hover)' }}>Capabilities</span>
            <h2 className="home-section-title">Everything Your Pharmacy Needs</h2>
          </div>

          <div className="home-feature-grid">
            {features.map((f, i) => (
              <div key={i} className="home-feature-card">
                <div className="home-feature-icon" style={{ background: f.gradient, border: `1px solid ${f.border}` }}>
                  {f.icon}
                </div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── ROI Calculator ─── */}
        <section id="roi" className="home-section" style={{ maxWidth: 1080 }}>
          <div className="home-roi">
            <div style={{ textAlign: 'center', marginBottom: 36 }}>
              <span className="home-section-label" style={{ color: '#4338ca' }}>Value Calculator</span>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, marginTop: 6 }}>
                Estimate Your Savings
              </h2>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 15, marginTop: 6 }}>
                Adjust your pharmacy parameters to see estimated monthly savings.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 32 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                <SliderInput label="Store Branches" value={storeCount} unit="Locations" min={1} max={15} color="#4f46e5" onChange={setStoreCount} />
                <SliderInput label="Avg Bills Per Day" value={dailyBills} unit="Bills" min={30} max={600} step={10} color="#0284c7" onChange={setDailyBills} />
                <SliderInput label="Inventory Value" value={inventoryValue} unit={`₹${inventoryValue} Lakhs`} min={3} max={50} color="#059669" onChange={setInventoryValue} />
              </div>

              <div className="home-roi-results">
                <div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>Hours Saved Monthly</div>
                  <div className="home-roi-value" style={{ fontSize: 32, color: '#4f46e5' }}>~{hoursSavedMonthly} hrs</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>Prevented Expiry Losses / Year</div>
                  <div className="home-roi-value" style={{ fontSize: 32, color: '#059669' }}>₹{expirySavedYearly.toLocaleString('en-IN')}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>Checkout Speed Boost</div>
                  <div className="home-roi-value" style={{ fontSize: 28, color: '#0284c7' }}>+{speedBoost}% Faster</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Compliance ─── */}
        <section id="compliance" className="home-section">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 48, alignItems: 'center' }}>
            <div>
              <span className="home-section-label" style={{ color: '#059669' }}>Security & Compliance</span>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 800, marginTop: 8, lineHeight: 1.2 }}>
                Built for Trust and Regulation
              </h2>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 15, lineHeight: 1.7, marginTop: 14 }}>
                Pharmacy data demands precision and privacy. New Sanjivani enforces cryptographic isolation,
                tamper-proof audit logging, and continuous automated backups.
              </p>
              <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  'Firestore security rules on every read and write',
                  'Doctor Rx verification for Schedule H & H1 drugs',
                  'Auditor read-only roles with export logs',
                  'Multi-region cloud with offline client resilience',
                ].map((item) => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#059669',
                        fontSize: 11,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      ✓
                    </div>
                    <span style={{ fontSize: 14, color: 'var(--color-text-secondary)', fontWeight: 500 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 20, padding: 28, boxShadow: '0 10px 30px rgba(15, 23, 42, 0.05)' }}>
              <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 16 }}>Compliance Verification</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { reg: 'Drugs & Cosmetics Act, 1940', status: 'Compliant' },
                  { reg: 'Schedule H1 Register Rule 65', status: 'Enforced' },
                  { reg: 'GST Invoice Rule 46 (CGST)', status: 'Certified' },
                  { reg: 'Cloud Data Isolation (ISO 27001)', status: 'Verified' },
                  { reg: 'Role-Based Access Control', status: 'Active' },
                ].map((row) => (
                  <div key={row.reg} className="home-compliance-row">
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{row.reg}</span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#15803d',
                        padding: '3px 10px',
                        borderRadius: 20,
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        whiteSpace: 'nowrap',
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

        {/* ─── CTA Banner ─── */}
        <section className="home-section">
          <div className="home-cta-banner">
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(28px, 4.5vw, 46px)',
                fontWeight: 900,
                color: '#fff',
                marginBottom: 16,
                letterSpacing: '-0.02em',
                position: 'relative',
              }}
            >
              Ready to Transform Your Pharmacy?
            </h2>
            <p style={{ fontSize: 17, color: '#e0e7ff', maxWidth: 600, margin: '0 auto 32px', lineHeight: 1.6, position: 'relative' }}>
              Faster billing, zero expiry losses, and complete regulatory peace of mind.
            </p>
            <button onClick={goToApp} className="home-cta-btn" style={{ position: 'relative' }}>
              Launch Dashboard →
            </button>
          </div>
        </section>

        {/* ─── Footer ─── */}
        <footer className="home-footer">
          <div
            style={{
              maxWidth: 1200,
              margin: '0 auto',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 40,
              marginBottom: 48,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'var(--gradient-brand)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: 16,
                    color: '#fff',
                  }}
                >
                  S
                </div>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800 }}>New Sanjivani</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                Beside Hero Bike Agency, Padrauna Road,
                <br />
                Naurangia, Kushinagar 274305
              </p>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6, marginTop: 4 }}>
                Ph: 8114000119 / 8004807785
              </p>
            </div>

            <div>
              <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Platform</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                <a href="#features">POS Billing</a>
                <a href="#features">Inventory Management</a>
                <a href="#features">Access Control</a>
                <a href="#compliance">Compliance</a>
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Quick Access</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                <Link href="/auth/signin">Sign In</Link>
                <Link href="/dashboard">Dashboard</Link>
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Regulatory</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: 'var(--color-text-muted)' }}>
                <span>CDSCO Rule 65</span>
                <span>GST Rule 46</span>
                <span>ISO 27001 Controls</span>
              </div>
            </div>
          </div>

          <div
            style={{
              maxWidth: 1200,
              margin: '0 auto',
              borderTop: '1px solid var(--color-border)',
              paddingTop: 24,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16,
              fontSize: 13,
              color: 'var(--color-text-muted)',
            }}
          >
            <div>&copy; {new Date().getFullYear()} New Sanjivani Multispeciality Clinic. All rights reserved.</div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 16px',
                borderRadius: 9999,
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.06), rgba(99, 102, 241, 0.06))',
                border: '1px solid rgba(239, 68, 68, 0.15)',
                fontSize: 12.5,
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
              }}
            >
              Engineered with love — from a brother&apos;s heart to his brother&apos;s success.
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

/* ─── Sub-components ─── */

function SliderInput({ label, value, unit, min, max, step = 1, color, onChange }: {
  label: string; value: number; unit: string; min: number; max: number; step?: number; color: string; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 15, fontWeight: 800, color }}>{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        style={{ width: '100%', accentColor: color, cursor: 'pointer' }}
      />
    </div>
  );
}

function BillingDemo({ onAction }: { onAction: () => void }) {
  const items = [
    { name: 'Augmentin 625 Duo Tab', batch: 'AUG-9912A', exp: '10/2027', qty: '2 Strips', mrp: '₹204.50', gst: '12%', total: '₹409.00' },
    { name: 'Pan-D Capsule', batch: 'PND-5541', exp: '08/2027', qty: '1 Strip', mrp: '₹198.00', gst: '12%', total: '₹198.00' },
    { name: 'Azee 500mg Tablet', batch: 'AZ-3301B', exp: '12/2027', qty: '1 Strip', mrp: '₹119.50', gst: '12%', total: '₹119.50' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: 18, marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 800 }}>POS Counter &bull; INV-2026-0891</h3>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Patient: Ramesh Patel &bull; Dr. S. Kulkarni (MH-44210)</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ padding: '5px 10px', background: '#f0fdf4', color: '#15803d', borderRadius: 6, fontSize: 12, fontWeight: 700, border: '1px solid #bbf7d0' }}>
            Barcode Ready
          </span>
          <span style={{ padding: '5px 10px', background: '#eff6ff', color: '#1d4ed8', borderRadius: 6, fontSize: 12, fontWeight: 700, border: '1px solid #bfdbfe' }}>
            GST Split
          </span>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
          <thead>
            <tr style={{ color: 'var(--color-text-muted)', borderBottom: '2px solid var(--color-border)' }}>
              {['Medicine', 'Batch', 'Expiry', 'Qty', 'MRP', 'GST', 'Total'].map((h) => (
                <th key={h} style={{ padding: '10px 12px', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.batch} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                <td style={{ padding: '10px 12px', fontWeight: 600 }}>{item.name}</td>
                <td style={{ padding: '10px 12px', color: 'var(--color-secondary-hover)', fontWeight: 600 }}>{item.batch}</td>
                <td style={{ padding: '10px 12px', color: '#059669', fontWeight: 600 }}>{item.exp}</td>
                <td style={{ padding: '10px 12px' }}>{item.qty}</td>
                <td style={{ padding: '10px 12px' }}>{item.mrp}</td>
                <td style={{ padding: '10px 12px' }}>{item.gst}</td>
                <td style={{ padding: '10px 12px', fontWeight: 700 }}>{item.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, padding: '14px 18px', background: 'var(--color-bg)', borderRadius: 12, border: '1px solid var(--color-border)', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--color-text-muted)' }}>
          <span>Subtotal: ₹648.66</span>
          <span>CGST: ₹38.92</span>
          <span>SGST: ₹38.92</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Total: </span>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#059669' }}>₹726.50</span>
          </div>
          <button
            onClick={onAction}
            style={{ padding: '10px 18px', background: '#059669', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 12px rgba(5,150,105,0.2)' }}
          >
            Print & Send Bill
          </button>
        </div>
      </div>
    </div>
  );
}

function InventoryDemo({ onAction }: { onAction: () => void }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 800 }}>Stock Intelligence & Expiry Radar</h3>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Preventing out-of-stock and near-expiry write-offs automatically.</p>
        </div>
        <span style={{ padding: '5px 12px', background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
          2 Actions Pending
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <div style={{ padding: 20, borderRadius: 14, background: '#fef2f2', border: '1px solid #fecaca' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#b91c1c', fontWeight: 700 }}>Expiry Alert &bull; 28 Days</span>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Batch #TEL-1102</span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, marginTop: 8 }}>Telma-H 40mg Tablet</div>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>
            14 strips in Shelf B-4. AI suggests vendor return or markdown to repeat-patient queue.
          </p>
          <button onClick={onAction} style={{ marginTop: 12, padding: '8px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            Process Return
          </button>
        </div>

        <div style={{ padding: 20, borderRadius: 14, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#1d4ed8', fontWeight: 700 }}>Auto Purchase Order</span>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>High depletion</span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, marginTop: 8 }}>Dolo 650mg (Paracetamol)</div>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>
            8 boxes left, 4.5/day run-rate. Draft PO for 50 boxes from distributor ready.
          </p>
          <button onClick={onAction} style={{ marginTop: 12, padding: '8px 14px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            Approve & Send PO
          </button>
        </div>
      </div>
    </div>
  );
}

function StoreDemo() {
  return (
    <div>
      <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Store Profile</h3>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>
        Your pharmacy environment with full administrative access.
      </p>

      <div style={{ padding: 24, borderRadius: 14, background: '#eef2ff', border: '1px solid #c7d2fe' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#4338ca', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Primary Store
          </span>
          <span className="home-live-dot" />
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 8 }}>New Sanjivani Multispeciality Clinic</div>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>Padrauna Road, Naurangia, Kushinagar 274305</div>
        <div style={{ marginTop: 16, display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13, color: 'var(--color-text-secondary)' }}>
          <div>Access: <strong>Full Owner</strong></div>
          <div>Sync: <strong>Firebase Connected</strong></div>
          <div>Billing: <strong>CGST/SGST</strong></div>
        </div>
      </div>
    </div>
  );
}

function ComplianceDemo() {
  return (
    <div>
      <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Schedule H & H1 Register</h3>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>
        Automated audit logs meeting CDSCO & State FDA regulations.
      </p>

      <div style={{ padding: 16, borderRadius: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>✅</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#15803d' }}>Tamper-Proof Audit Trail Active</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              Every H1 dispense records: prescriber registration, patient address, batch number, and pharmacist sign-off.
            </div>
          </div>
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', fontStyle: 'italic', textAlign: 'center' }}>
        Exportable in FDA-approved Excel and signed PDF formats.
      </p>
    </div>
  );
}
