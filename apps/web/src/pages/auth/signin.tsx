import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

export default function SignInPage() {
  const router = useRouter();
  const { user, loading, error, signInWithEmail, signOut, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setSubmitting(true);
    const success = await signInWithEmail(email, password);
    setSubmitting(false);

    if (success) {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('inauguration_greeting_dismissed');
      }
      router.replace('/dashboard');
    }
  };

  if (loading && user) return null;

  return (
    <>
      <Head>
        <title>Sign In | PulseClinic Pharmacy Management</title>
      </Head>

      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 50%, #f0fdf4 100%)',
          padding: 'var(--space-md)',
          position: 'relative',
        }}
      >
        {/* Soft Ambient Light Glow */}
        <div
          style={{
            position: 'absolute',
            width: '450px',
            height: '450px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <Card
          padding="var(--space-2xl)"
          style={{
            width: '100%',
            maxWidth: '440px',
            position: 'relative',
            zIndex: 1,
            background: '#ffffff',
            boxShadow: '0 20px 45px rgba(15, 23, 42, 0.08)',
            border: '1px solid #e2e8f0',
            borderRadius: '20px',
          }}
        >
          {/* Logo & Header */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <Link href="/" style={{ textDecoration: 'none' }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '18px',
                  background: 'linear-gradient(135deg, #4f46e5, #0284c7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  fontSize: '28px',
                  color: '#ffffff',
                  fontWeight: 800,
                  boxShadow: '0 8px 20px rgba(79, 70, 229, 0.25)',
                }}
              >
                P
              </div>
            </Link>

            <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
              Sign In to PulseClinic
            </h1>
            <p style={{ color: '#64748b', fontSize: '13px' }}>
              Authorized Pharmacy & Clinical Staff Console
            </p>
          </div>

          {/* Access Policy Badge */}
          <div
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '20px',
              fontSize: '12px',
              color: '#15803d',
              fontWeight: 500,
            }}
          >
            <span>🔒</span>
            <span>Restricted Access: Only pre-approved staff accounts.</span>
          </div>

          {/* Error Message */}
          {error && (
            <div
              style={{
                padding: '10px 14px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#b91c1c',
                fontSize: '13px',
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
              role="alert"
            >
              <span>{error}</span>
              <button
                type="button"
                onClick={clearError}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#b91c1c',
                  cursor: 'pointer',
                  fontWeight: 700,
                  padding: '0 4px',
                }}
              >
                ✕
              </button>
            </div>
          )}

          {/* If already signed in */}
          {user ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <p style={{ fontSize: '14px', color: '#334155', marginBottom: '16px' }}>
                Currently signed in as <strong>{user.email}</strong>
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <Button size="lg" fullWidth onClick={() => router.push('/dashboard')}>
                  Go to Dashboard →
                </Button>
                <Button variant="secondary" size="md" fullWidth onClick={signOut}>
                  Sign Out / Switch Account
                </Button>
              </div>
            </div>
          ) : (
            /* Email / Password Form */
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <Input
                  label="Staff Email Address"
                  id="staff-email"
                  type="email"
                  placeholder="chemist@pulseclinic.in"
                  value={email}
                  onChange={(e) => {
                    clearError();
                    setEmail(e.target.value);
                  }}
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2px' }}>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#4f46e5',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {showPassword ? 'Hide Password' : 'Show Password'}
                  </button>
                </div>
                <Input
                  label="Password"
                  id="staff-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => {
                    clearError();
                    setPassword(e.target.value);
                  }}
                  required
                  autoComplete="current-password"
                />
              </div>

              <Button
                type="submit"
                size="lg"
                fullWidth
                loading={submitting || (loading && !user)}
                style={{
                  marginTop: '8px',
                  background: 'linear-gradient(135deg, #4f46e5, #0284c7)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '14px',
                  boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)',
                }}
              >
                Sign In to Pharmacy
              </Button>
            </form>
          )}

          {/* Back to Home Navigation */}
          <div
            style={{
              marginTop: '24px',
              paddingTop: '16px',
              borderTop: '1px solid #f1f5f9',
              textAlign: 'center',
            }}
          >
            <Link
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#4f46e5',
                textDecoration: 'none',
                padding: '8px 14px',
                borderRadius: '8px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
              }}
            >
              <span>←</span>
              <span>Back to Home</span>
            </Link>
          </div>
        </Card>
      </div>
    </>
  );
}
