'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { apiPost } from '@/lib/api';
import type { MembershipInfo } from '@pulseclinic/types';

interface AuthState {
  user: User | null;
  memberships: MembershipInfo[];
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshMemberships: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    memberships: [],
    loading: true,
    error: null,
  });

  const fetchMemberships = useCallback(async (user: User) => {
    try {
      const idToken = await user.getIdToken();
      const response = await apiPost<{
        success: boolean;
        memberships: MembershipInfo[];
      }>('/auth/session', { idToken });
      setState((prev) => ({
        ...prev,
        memberships: response.memberships || [],
        error: null,
      }));
    } catch {
      setState((prev) => ({ ...prev, memberships: [], error: 'Failed to load memberships.' }));
    }
  }, []);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setState((prev) => ({ ...prev, user, loading: true }));
        await fetchMemberships(user);
        setState((prev) => ({ ...prev, loading: false }));
      } else {
        setState({ user: null, memberships: [], loading: false, error: null });
      }
    });
    return unsubscribe;
  }, [fetchMemberships]);

  const clearError = () => {
    setState((prev) => ({ ...prev, error: null }));
  };

  const signInWithEmail = async (email: string, password: string): Promise<boolean> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const auth = getFirebaseAuth();
      await signInWithEmailAndPassword(auth, email.trim(), password);
      return true;
    } catch (err: any) {
      let message = 'Failed to sign in. Please verify your credentials.';
      const code = err?.code || '';
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        message = 'Invalid email or password. Please contact your store administrator.';
      } else if (code === 'auth/user-disabled') {
        message = 'This user account has been deactivated.';
      } else if (code === 'auth/too-many-requests') {
        message = 'Too many attempts. Access blocked temporarily.';
      } else if (code === 'auth/invalid-email') {
        message = 'Please provide a valid email format.';
      }
      setState((prev) => ({ ...prev, loading: false, error: message }));
      return false;
    }
  };

  const signInWithGoogle = async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const auth = getFirebaseAuth();
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch {
      setState((prev) => ({ ...prev, loading: false, error: 'Sign-in failed. Please try again.' }));
    }
  };

  const signOut = async () => {
    const auth = getFirebaseAuth();
    await firebaseSignOut(auth);
    setState({ user: null, memberships: [], loading: false, error: null });
  };

  const refreshMemberships = async () => {
    if (state.user) {
      await fetchMemberships(state.user);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signInWithEmail,
        signInWithGoogle,
        signOut,
        refreshMemberships,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
