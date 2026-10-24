import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import { useStore } from '@/context/StoreContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { apiPost } from '@/lib/api';

export default function StoreSelectPage() {
  const router = useRouter();
  const { user, loading: authLoading, memberships, refreshMemberships } = useAuth();
  const { selectStore, activeStore } = useStore();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/auth/signin');
      return;
    }

    if (activeStore) {
      router.replace('/dashboard');
      return;
    }

    if (!authLoading && user && memberships.length > 0) {
      selectStore(memberships[0].storeId).then(() => {
        router.replace('/dashboard');
      });
    }
  }, [user, authLoading, activeStore, memberships, selectStore, router]);

  if (authLoading || !user) return null;

  const filtered = memberships.filter((m) =>
    m.storeName.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSelect = async (storeId: string) => {
    await selectStore(storeId);
  };

  const handleCreate = async () => {
    if (!newStoreName.trim()) return;
    setCreateLoading(true);
    try {
      const res = await apiPost<{ success: boolean; store: { id: string } }>('/stores', {
        storeName: newStoreName.trim(),
      });
      await refreshMemberships();
      await selectStore(res.store.id);
    } catch {
      // handled by redirect
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg)',
        padding: 'var(--space-md)',
      }}
    >
      <div style={{ width: '100%', maxWidth: '520px' }}>
        {/* User header */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 'var(--radius-full)',
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-md)',
              color: 'white',
              fontSize: '22px',
              fontWeight: 700,
            }}
          >
            {user.displayName?.[0]?.toUpperCase() || '?'}
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Welcome, {user.displayName || user.email}</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Select a store to continue
          </p>
        </div>

        {/* Search */}
        {memberships.length > 3 && (
          <div style={{ marginBottom: 'var(--space-md)' }}>
            <Input
              placeholder="Search stores..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}

        {/* Store list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {filtered.length === 0 && !creating ? (
            <Card padding="var(--space-xl)" style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-md)' }}>
                No active store memberships found.
              </p>
              <Button onClick={() => setCreating(true)}>Create New Store</Button>
            </Card>
          ) : (
            filtered.map((m) => (
              <Card key={m.storeId} onClick={() => handleSelect(m.storeId)} padding="var(--space-md)">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '15px' }}>{m.storeName}</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      ID: {m.storeId}
                    </div>
                  </div>
                  <Badge variant="info">{m.role}</Badge>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Create store */}
        {!creating && memberships.length > 0 && (
          <Button
            variant="ghost"
            fullWidth
            onClick={() => setCreating(true)}
            style={{ marginTop: 'var(--space-md)' }}
          >
            + Create New Store
          </Button>
        )}

        {creating && (
          <Card padding="var(--space-lg)" style={{ marginTop: 'var(--space-md)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: 'var(--space-md)' }}>
              Create a New Store
            </h3>
            <Input
              label="Store Name"
              placeholder="My Pharmacy"
              value={newStoreName}
              onChange={(e) => setNewStoreName(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
              <Button
                onClick={handleCreate}
                loading={createLoading}
                disabled={!newStoreName.trim()}
              >
                Create Store
              </Button>
              <Button variant="ghost" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
