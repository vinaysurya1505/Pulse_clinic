import { getFirestore } from '../lib/firebase-admin';
import { COLLECTIONS } from '@pulseclinic/config';
import { StockLedgerEntry } from '@pulseclinic/types';

export class StockLedgerService {
  private static getCollection(storeId: string) {
    const db = getFirestore();
    return db.collection(COLLECTIONS.stockLedger(storeId));
  }

  static async list(
    storeId: string,
    options: {
      batchId?: string;
      medicineId?: string;
      movementType?: string;
      limit?: number;
      cursor?: string;
    } = {}
  ): Promise<{ entries: StockLedgerEntry[]; nextCursor?: string }> {
    const colRef = this.getCollection(storeId);
    const limitCount = Math.min(options.limit || 50, 100);

    let query: FirebaseFirestore.Query = colRef;

    if (options.batchId) {
      query = query.where('batchId', '==', options.batchId);
    }

    if (options.medicineId) {
      query = query.where('medicineId', '==', options.medicineId);
    }

    if (options.movementType && options.movementType !== 'ALL') {
      query = query.where('movementType', '==', options.movementType);
    }

    query = query.orderBy('createdAt', 'desc').limit(limitCount + 1);

    if (options.cursor) {
      const cursorDoc = await colRef.doc(options.cursor).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    const snapshot = await query.get();
    let docs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<StockLedgerEntry, 'id'>),
    }));

    let nextCursor: string | undefined = undefined;
    if (docs.length > limitCount) {
      const nextDoc = docs[limitCount - 1];
      nextCursor = nextDoc.id;
      docs = docs.slice(0, limitCount);
    }

    return { entries: docs, nextCursor };
  }
}
