import type { User } from 'firebase/auth';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import { syncUserProfile } from '../services/workshopService';
import {
  ADMIN_EMAIL,
  type Customer,
  type ServiceHistory,
  type SparePart,
  type Transaction,
  type UserProfile,
} from '../types/workshop';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

interface WorkshopContextValue {
  user: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  authReady: boolean;
  authBusy: boolean;
  authError: string | null;
  dataLoading: boolean;
  dataError: string | null;
  spareParts: SparePart[];
  customers: Customer[];
  transactions: Transaction[];
  serviceHistories: ServiceHistory[];
  toasts: ToastMessage[];
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  notify: (type: ToastMessage['type'], text: string) => void;
  dismissToast: (id: string) => void;
  refreshProfileState: (workshopName: string) => void;
}

const WorkshopContext = createContext<WorkshopContextValue | null>(null);

function sortByCreatedDesc<T extends { createdAt?: { toMillis?: () => number } | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return tB - tA;
  });
}

export function WorkshopProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [serviceHistories, setServiceHistories] = useState<ServiceHistory[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const notify = useCallback((type: ToastMessage['type'], text: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const isAdmin = useMemo(() => {
    if (!user) return false;
    return Boolean(user.emailVerified && user.email === ADMIN_EMAIL) || profile?.role === 'admin';
  }, [user, profile]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthError(null);
      if (!nextUser) {
        setProfile(null);
        setSpareParts([]);
        setCustomers([]);
        setTransactions([]);
        setServiceHistories([]);
        setDataLoading(false);
        setAuthReady(true);
        return;
      }

      try {
        const synced = await syncUserProfile(nextUser);
        setProfile(synced);
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Gagal memuat profil pengguna.');
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !user) {
      return;
    }

    setDataLoading(true);
    setDataError(null);

    const isEmailAdmin = Boolean(user.emailVerified && user.email === ADMIN_EMAIL);
    let loadedCount = 0;
    const markLoaded = () => {
      loadedCount += 1;
      if (loadedCount >= 4) {
        setDataLoading(false);
      }
    };

    const makeQuery = (colName: string) => {
      const colRef = collection(db, colName);
      return isEmailAdmin ? colRef : query(colRef, where('ownerId', '==', user.uid));
    };

    const handleListenerError = (err: unknown, path: string) => {
      try {
        handleFirestoreError(err, OperationType.LIST, path);
      } catch (wrapped) {
        setDataError(wrapped instanceof Error ? wrapped.message : 'Gagal menyinkronkan data Firestore.');
      }
      setDataLoading(false);
    };

    const unsubParts = onSnapshot(
      makeQuery('spareParts'),
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SparePart, 'id'>),
        }));
        setSpareParts(sortByCreatedDesc(items));
        markLoaded();
      },
      (err) => handleListenerError(err, 'spareParts')
    );

    const unsubCustomers = onSnapshot(
      makeQuery('customers'),
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Customer, 'id'>),
        }));
        setCustomers(sortByCreatedDesc(items));
        markLoaded();
      },
      (err) => handleListenerError(err, 'customers')
    );

    const unsubTransactions = onSnapshot(
      makeQuery('transactions'),
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Transaction, 'id'>),
        }));
        setTransactions(sortByCreatedDesc(items));
        markLoaded();
      },
      (err) => handleListenerError(err, 'transactions')
    );

    const unsubHistories = onSnapshot(
      makeQuery('serviceHistories'),
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ServiceHistory, 'id'>),
        }));
        setServiceHistories(sortByCreatedDesc(items));
        markLoaded();
      },
      (err) => handleListenerError(err, 'serviceHistories')
    );

    return () => {
      unsubParts();
      unsubCustomers();
      unsubTransactions();
      unsubHistories();
    };
  }, [authReady, user]);

  const signInWithGoogle = useCallback(async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal masuk dengan Google.';
      if (msg.includes('popup-closed-by-user')) {
        setAuthError('Jendela masuk Google ditutup sebelum selesai.');
      } else {
        setAuthError(msg);
      }
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const signOutUser = useCallback(async () => {
    setAuthBusy(true);
    try {
      await signOut(auth);
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const refreshProfileState = useCallback((workshopName: string) => {
    setProfile((prev) => (prev ? { ...prev, workshopName } : prev));
  }, []);

  const value: WorkshopContextValue = {
    user,
    profile,
    isAdmin,
    authReady,
    authBusy,
    authError,
    dataLoading,
    dataError,
    spareParts,
    customers,
    transactions,
    serviceHistories,
    toasts,
    signInWithGoogle,
    signOutUser,
    notify,
    dismissToast,
    refreshProfileState,
  };

  return <WorkshopContext.Provider value={value}>{children}</WorkshopContext.Provider>;
}

export function useWorkshop(): WorkshopContextValue {
  const ctx = useContext(WorkshopContext);
  if (!ctx) {
    throw new Error('useWorkshop harus digunakan di dalam WorkshopProvider.');
  }
  return ctx;
}
