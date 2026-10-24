import { getFirestore } from '../lib/firebase-admin';
import { COLLECTIONS } from '@pulseclinic/config';
import {
  SupplierProfile,
  CreateSupplierInput,
  SupplierLedgerEntry,
  RecordSupplierPaymentInput,
} from '@pulseclinic/types';

export class SupplierService {
  private static getSuppliersCol(storeId: string) {
    const db = getFirestore();
    return db.collection(COLLECTIONS.suppliers(storeId));
  }

  private static getLedgerCol(storeId: string) {
    const db = getFirestore();
    return db.collection(COLLECTIONS.supplierLedger(storeId));
  }

  static async list(
    storeId: string,
    options: { search?: string; limit?: number; cursor?: string } = {}
  ): Promise<{ suppliers: SupplierProfile[]; nextCursor?: string }> {
    const colRef = this.getSuppliersCol(storeId);
    const limitCount = Math.min(options.limit || 50, 100);

    let query: FirebaseFirestore.Query = colRef.orderBy('name', 'asc').limit(limitCount + 1);

    if (options.cursor) {
      const cursorDoc = await colRef.doc(options.cursor).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    const snapshot = await query.get();
    let docs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<SupplierProfile, 'id'>),
    }));

    if (options.search && options.search.trim().length > 0) {
      const q = options.search.toLowerCase().trim();
      docs = docs.filter(
        (s) =>
          s.name?.toLowerCase().includes(q) ||
          s.gstin?.toLowerCase().includes(q) ||
          s.phone?.toLowerCase().includes(q) ||
          s.contactPerson?.toLowerCase().includes(q)
      );
    }

    let nextCursor: string | undefined = undefined;
    if (docs.length > limitCount) {
      const nextDoc = docs[limitCount - 1];
      nextCursor = nextDoc.id;
      docs = docs.slice(0, limitCount);
    }

    return { suppliers: docs, nextCursor };
  }

  static async getById(storeId: string, id: string): Promise<SupplierProfile | null> {
    const docRef = this.getSuppliersCol(storeId).doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return null;
    return { id: snap.id, ...(snap.data() as Omit<SupplierProfile, 'id'>) };
  }

  static async create(storeId: string, input: CreateSupplierInput): Promise<SupplierProfile> {
    const colRef = this.getSuppliersCol(storeId);
    const docRef = colRef.doc();
    const now = new Date().toISOString();

    const newSupplier: SupplierProfile = {
      id: docRef.id,
      storeId,
      name: input.name.trim(),
      gstin: input.gstin?.trim().toUpperCase(),
      phone: input.phone.trim(),
      email: input.email?.trim(),
      contactPerson: input.contactPerson?.trim(),
      address: input.address,
      paymentTermsDays: input.paymentTermsDays || 30,
      currentBalancePaise: 0,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(newSupplier);
    return newSupplier;
  }

  static async update(
    storeId: string,
    id: string,
    input: Partial<CreateSupplierInput>
  ): Promise<SupplierProfile | null> {
    const docRef = this.getSuppliersCol(storeId).doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return null;

    const existing = snap.data() as SupplierProfile;
    const now = new Date().toISOString();
    const updatedData = {
      ...input,
      updatedAt: now,
    };

    await docRef.update(updatedData);
    return { ...existing, ...updatedData, id };
  }

  /**
   * Atomically records a payment made to a supplier and credits the ledger
   */
  static async recordPayment(
    storeId: string,
    input: RecordSupplierPaymentInput,
    userId: string,
    userName?: string
  ): Promise<{ supplier: SupplierProfile; ledgerEntry: SupplierLedgerEntry }> {
    const db = getFirestore();
    const supplierDocRef = this.getSuppliersCol(storeId).doc(input.supplierId);
    const ledgerDocRef = this.getLedgerCol(storeId).doc();
    const now = new Date().toISOString();

    let updatedSupplier!: SupplierProfile;
    let ledgerEntry!: SupplierLedgerEntry;

    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(supplierDocRef);
      if (!snap.exists) {
        throw new Error('SUPPLIER_NOT_FOUND');
      }

      const supplier = snap.data() as SupplierProfile;
      const beforeBalance = supplier.currentBalancePaise || 0;
      const afterBalance = beforeBalance - input.amountPaise;

      updatedSupplier = {
        ...supplier,
        id: snap.id,
        currentBalancePaise: afterBalance,
        updatedAt: now,
      };

      ledgerEntry = {
        id: ledgerDocRef.id,
        storeId,
        supplierId: supplier.id,
        supplierName: supplier.name,
        entryType: 'PAYMENT_MADE',
        amountPaise: -input.amountPaise,
        balanceAfterPaise: afterBalance,
        referenceType: 'PAYMENT',
        referenceId: ledgerDocRef.id,
        referenceNumber: input.referenceNumber.trim(),
        paymentMode: input.paymentMode,
        notes: input.notes,
        performedBy: userId,
        performedByName: userName || 'Pharmacist',
        createdAt: now,
      };

      transaction.update(supplierDocRef, {
        currentBalancePaise: afterBalance,
        updatedAt: now,
      });

      transaction.set(ledgerDocRef, ledgerEntry);
    });

    return { supplier: updatedSupplier, ledgerEntry };
  }

  /**
   * Retrieves supplier statement with current balance and chronological ledger
   */
  static async getStatement(
    storeId: string,
    supplierId: string,
    limit = 50
  ): Promise<{ currentBalancePaise: number; entries: SupplierLedgerEntry[] }> {
    const supplier = await this.getById(storeId, supplierId);
    if (!supplier) throw new Error('SUPPLIER_NOT_FOUND');

    const snap = await this.getLedgerCol(storeId)
      .where('supplierId', '==', supplierId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const entries = snap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<SupplierLedgerEntry, 'id'>),
    }));

    return {
      currentBalancePaise: supplier.currentBalancePaise || 0,
      entries,
    };
  }
}
