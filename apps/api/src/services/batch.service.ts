import { getFirestore } from '../lib/firebase-admin';
import { COLLECTIONS } from '@pulseclinic/config';
import {
  BatchInventory,
  CreateBatchInput,
  StockAdjustmentInput,
  StockLedgerEntry,
  BatchStatuses,
  sortBatchesFEFO,
  getBatchExpiryStatus,
} from '@pulseclinic/types';
import { MedicineService } from './medicine.service';

export class BatchService {
  private static getBatchesCol(storeId: string) {
    const db = getFirestore();
    return db.collection(COLLECTIONS.batches(storeId));
  }

  private static getLedgerCol(storeId: string) {
    const db = getFirestore();
    return db.collection(COLLECTIONS.stockLedger(storeId));
  }

  static async list(
    storeId: string,
    options: {
      medicineId?: string;
      expiryStatus?: 'ALL' | 'EXPIRED' | 'NEAR_EXPIRY' | 'VALID';
      search?: string;
      limit?: number;
      cursor?: string;
    } = {}
  ): Promise<{ batches: BatchInventory[]; nextCursor?: string }> {
    const colRef = this.getBatchesCol(storeId);
    const limitCount = Math.min(options.limit || 50, 100);

    let query: FirebaseFirestore.Query = colRef;

    if (options.medicineId) {
      query = query.where('medicineId', '==', options.medicineId);
    }

    const snapshot = await query.get();
    let docs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<BatchInventory, 'id'>),
    }));

    // Sort by expiryDate ascending (FEFO) in memory
    docs.sort((a, b) => (a.expiryDate || '').localeCompare(b.expiryDate || ''));

    // In-memory filter for search or expiry tier
    if (options.search && options.search.trim().length > 0) {
      const q = options.search.toLowerCase().trim();
      docs = docs.filter(
        (b) =>
          b.batchNumber?.toLowerCase().includes(q) ||
          b.medicineBrandName?.toLowerCase().includes(q) ||
          b.medicineGenericName?.toLowerCase().includes(q) ||
          b.rackLocation?.toLowerCase().includes(q) ||
          b.supplierName?.toLowerCase().includes(q)
      );
    }

    if (options.expiryStatus && options.expiryStatus !== 'ALL') {
      const now = new Date();
      docs = docs.filter((b) => {
        const tier = getBatchExpiryStatus(b.expiryDate, now);
        if (options.expiryStatus === 'EXPIRED') return tier === 'EXPIRED';
        if (options.expiryStatus === 'NEAR_EXPIRY')
          return tier === 'CRITICAL_30' || tier === 'WARNING_60' || tier === 'ATTENTION_90';
        if (options.expiryStatus === 'VALID') return tier === 'VALID';
        return true;
      });
    }

    let nextCursor: string | undefined = undefined;
    if (docs.length > limitCount) {
      const nextDoc = docs[limitCount - 1];
      nextCursor = nextDoc.id;
      docs = docs.slice(0, limitCount);
    }

    return { batches: docs, nextCursor };
  }

  static async getById(storeId: string, batchId: string): Promise<BatchInventory | null> {
    const docRef = this.getBatchesCol(storeId).doc(batchId);
    const snap = await docRef.get();
    if (!snap.exists) return null;
    return { id: snap.id, ...(snap.data() as Omit<BatchInventory, 'id'>) };
  }

  /**
   * Returns sellable batches for a medicine strictly sorted by FEFO (expiryDate ASC)
   * Expired batches and depleted stock are omitted.
   */
  static async getSellableBatchesFEFO(storeId: string, medicineId: string): Promise<BatchInventory[]> {
    const todayIso = new Date().toISOString().slice(0, 10);
    const colRef = this.getBatchesCol(storeId);

    const snapshot = await colRef.where('medicineId', '==', medicineId).get();

    const batches = snapshot.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<BatchInventory, 'id'>) }))
      .filter(
        (b) =>
          b.status === BatchStatuses.ACTIVE &&
          b.expiryDate > todayIso &&
          b.stockUnits > 0
      );

    return sortBatchesFEFO(batches);
  }

  /**
   * Create new batch and atomically record INITIAL_STOCK in the stock ledger (ADR-012)
   */
  static async createBatch(
    storeId: string,
    input: CreateBatchInput,
    userId: string,
    userName?: string
  ): Promise<BatchInventory> {
    const db = getFirestore();
    const batchDocRef = this.getBatchesCol(storeId).doc();
    const ledgerDocRef = this.getLedgerCol(storeId).doc();
    const now = new Date().toISOString();

    // Fetch medicine details for denormalized search & audit
    const medicine = await MedicineService.getById(storeId, input.medicineId);

    const isExpired = getBatchExpiryStatus(input.expiryDate) === 'EXPIRED';

    const newBatch: BatchInventory = {
      id: batchDocRef.id,
      storeId,
      medicineId: input.medicineId,
      medicineBrandName: medicine?.brandName || '',
      medicineGenericName: medicine?.genericName || '',
      dosageForm: medicine?.dosageForm || '',
      strength: medicine?.strength || '',
      batchNumber: input.batchNumber.trim().toUpperCase(),
      expiryDate: input.expiryDate,
      mrpPaise: input.mrpPaise,
      costPricePaise: input.costPricePaise || 0,
      stockUnits: input.initialStockUnits,
      status: isExpired ? BatchStatuses.EXPIRED : BatchStatuses.ACTIVE,
      supplierId: input.supplierId || '',
      supplierName: input.supplierName || '',
      rackLocation: input.rackLocation || medicine?.rackLocation || '',
      createdAt: now,
      updatedAt: now,
    };

    const ledgerEntry: StockLedgerEntry = {
      id: ledgerDocRef.id,
      storeId,
      batchId: batchDocRef.id,
      medicineId: input.medicineId,
      medicineBrandName: medicine?.brandName || '',
      batchNumber: newBatch.batchNumber,
      movementType: 'INITIAL_STOCK',
      changeUnits: input.initialStockUnits,
      balanceUnitsBefore: 0,
      balanceUnitsAfter: input.initialStockUnits,
      reason: 'Initial stock on batch registration',
      performedBy: userId,
      performedByName: userName || 'Pharmacist',
      createdAt: now,
    };

    await db.runTransaction(async (transaction) => {
      transaction.set(batchDocRef, newBatch);
      transaction.set(ledgerDocRef, ledgerEntry);
    });

    return newBatch;
  }

  /**
   * Atomically adjust stock with mandatory reason and immutable ledger write (ADR-012)
   */
  static async adjustStock(
    storeId: string,
    input: StockAdjustmentInput,
    userId: string,
    userName?: string
  ): Promise<{ batch: BatchInventory; ledgerEntry: StockLedgerEntry }> {
    const db = getFirestore();
    const batchDocRef = this.getBatchesCol(storeId).doc(input.batchId);
    const ledgerDocRef = this.getLedgerCol(storeId).doc();
    const now = new Date().toISOString();

    let updatedBatch!: BatchInventory;
    let ledgerEntry!: StockLedgerEntry;

    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(batchDocRef);
      if (!snap.exists) {
        throw new Error('BATCH_NOT_FOUND');
      }

      const current = snap.data() as BatchInventory;
      const beforeUnits = current.stockUnits;
      const afterUnits = beforeUnits + input.adjustmentUnits;

      if (afterUnits < 0) {
        throw new Error(`INSUFFICIENT_STOCK: Current stock is ${beforeUnits}, cannot deduct ${Math.abs(input.adjustmentUnits)} units.`);
      }

      const movementType =
        input.movementType || (input.adjustmentUnits >= 0 ? 'ADJUSTMENT_ADD' : 'ADJUSTMENT_SUBTRACT');

      const isDepleted = afterUnits === 0;
      const newStatus = isDepleted && current.status === BatchStatuses.ACTIVE ? BatchStatuses.DEPLETED : current.status;

      updatedBatch = {
        ...current,
        id: snap.id,
        stockUnits: afterUnits,
        status: newStatus,
        updatedAt: now,
      };

      ledgerEntry = {
        id: ledgerDocRef.id,
        storeId,
        batchId: snap.id,
        medicineId: current.medicineId,
        medicineBrandName: current.medicineBrandName || '',
        batchNumber: current.batchNumber,
        movementType,
        changeUnits: input.adjustmentUnits,
        balanceUnitsBefore: beforeUnits,
        balanceUnitsAfter: afterUnits,
        reason: input.reason.trim(),
        performedBy: userId,
        performedByName: userName || 'Pharmacist',
        createdAt: now,
      };

      transaction.update(batchDocRef, {
        stockUnits: afterUnits,
        status: newStatus,
        updatedAt: now,
      });

      transaction.set(ledgerDocRef, ledgerEntry);
    });

    return { batch: updatedBatch, ledgerEntry };
  }
}
