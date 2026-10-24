import { getFirebaseAuth } from './firebase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const auth = getFirebaseAuth();
  if (typeof auth.authStateReady === 'function') {
    await auth.authStateReady();
  }
  let user = auth.currentUser;
  if (!user) {
    await new Promise<void>((resolve) => {
      const unsub = auth.onAuthStateChanged((u) => {
        user = u;
        unsub();
        resolve();
      });
      setTimeout(() => {
        unsub();
        resolve();
      }, 1500);
    });
  }
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

export async function apiGet<T>(path: string, storeId?: string): Promise<T> {
  const headers: Record<string, string> = {
    ...(await getAuthHeaders()),
  };
  if (storeId) headers['x-store-id'] = storeId;

  const res = await fetch(`${API_URL}${path}`, { headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = typeof body?.error === 'string' ? body.error : body?.error?.message || res.statusText;
    const code = typeof body?.error === 'object' ? body.error?.code : 'REQUEST_FAILED';
    throw new ApiError(res.status, code, msg);
  }
  return res.json();
}

export async function apiGetBlob(path: string, storeId?: string): Promise<Blob> {
  const headers: Record<string, string> = {
    ...(await getAuthHeaders()),
  };
  if (storeId) headers['x-store-id'] = storeId;

  const res = await fetch(`${API_URL}${path}`, { headers });
  if (!res.ok) {
    throw new ApiError(res.status, 'DOWNLOAD_FAILED', 'Failed to download file');
  }
  return res.blob();
}

export async function apiPost<T>(path: string, body: unknown, storeId?: string): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(await getAuthHeaders()),
  };
  if (storeId) headers['x-store-id'] = storeId;

  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = typeof data?.error === 'string' ? data.error : data?.error?.message || res.statusText;
    const code = typeof data?.error === 'object' ? data.error?.code : 'REQUEST_FAILED';
    throw new ApiError(res.status, code, msg);
  }
  return res.json();
}

export async function apiPut<T>(path: string, body: unknown, storeId?: string): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(await getAuthHeaders()),
  };
  if (storeId) headers['x-store-id'] = storeId;

  const res = await fetch(`${API_URL}${path}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data?.error?.code || 'REQUEST_FAILED', data?.error?.message || res.statusText);
  }
  return res.json();
}

export async function apiDelete<T>(path: string, storeId?: string): Promise<T> {
  const headers: Record<string, string> = {
    ...(await getAuthHeaders()),
  };
  if (storeId) headers['x-store-id'] = storeId;

  const res = await fetch(`${API_URL}${path}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data?.error?.code || 'REQUEST_FAILED', data?.error?.message || res.statusText);
  }
  return res.json();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
