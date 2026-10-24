import { getFirestore } from '../lib/firebase-admin';
import { COLLECTIONS } from '@pulseclinic/config';
import type { MedicineMaster, CreateMedicineInput, UpdateMedicineInput } from '@pulseclinic/types';

export class MedicineService {
  private static getCollection(storeId: string) {
    const db = getFirestore();
    return db.collection(COLLECTIONS.medicines(storeId));
  }

  static async list(
    storeId: string,
    options: { search?: string; category?: string; scheduleCategory?: string; limit?: number; cursor?: string } = {}
  ): Promise<{ medicines: MedicineMaster[]; nextCursor?: string }> {
    const colRef = this.getCollection(storeId);
    const limitCount = Math.min(options.limit || 50, 100);

    const snapshot = await colRef.where('isArchived', '==', false).get();
    let docs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<MedicineMaster, 'id'>),
    }));

    if (options.category && options.category !== 'ALL') {
      docs = docs.filter((m) => m.category === options.category);
    }
    if (options.scheduleCategory && options.scheduleCategory !== 'ALL') {
      docs = docs.filter((m) => m.scheduleCategory === options.scheduleCategory);
    }

    docs.sort((a, b) => (a.brandName || '').localeCompare(b.brandName || ''));

    // In-memory search filter if search term is provided (covers brandName, genericName, barcode)
    if (options.search && options.search.trim().length > 0) {
      const q = options.search.toLowerCase().trim();
      docs = docs.filter(
        (m) =>
          m.brandName?.toLowerCase().includes(q) ||
          m.genericName?.toLowerCase().includes(q) ||
          m.barcode?.toLowerCase().includes(q) ||
          m.hsnCode?.toLowerCase().includes(q)
      );
    }

    let nextCursor: string | undefined = undefined;
    if (docs.length > limitCount) {
      const nextDoc = docs[limitCount - 1];
      nextCursor = nextDoc.id;
      docs = docs.slice(0, limitCount);
    }

    return { medicines: docs, nextCursor };
  }

  static async getById(storeId: string, medicineId: string): Promise<MedicineMaster | null> {
    const docRef = this.getCollection(storeId).doc(medicineId);
    const snap = await docRef.get();
    if (!snap.exists) return null;
    const data = snap.data() as Omit<MedicineMaster, 'id'>;
    if (data.isArchived) return null;
    return { id: snap.id, ...data };
  }

  static async create(storeId: string, input: CreateMedicineInput): Promise<MedicineMaster> {
    const colRef = this.getCollection(storeId);
    const docRef = colRef.doc();
    const now = new Date().toISOString();

    const newMedicine: MedicineMaster = {
      ...input,
      id: docRef.id,
      storeId,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(newMedicine);
    return newMedicine;
  }

  static async update(
    storeId: string,
    medicineId: string,
    input: UpdateMedicineInput
  ): Promise<MedicineMaster | null> {
    const docRef = this.getCollection(storeId).doc(medicineId);
    const snap = await docRef.get();
    if (!snap.exists) return null;

    const existing = snap.data() as MedicineMaster;
    if (existing.isArchived) return null;

    const now = new Date().toISOString();
    const updatedData = {
      ...input,
      updatedAt: now,
    };

    await docRef.update(updatedData);
    return { ...existing, ...updatedData, id: medicineId };
  }

  static async archive(storeId: string, medicineId: string): Promise<boolean> {
    const docRef = this.getCollection(storeId).doc(medicineId);
    const snap = await docRef.get();
    if (!snap.exists) return false;

    await docRef.update({
      isArchived: true,
      updatedAt: new Date().toISOString(),
    });
    return true;
  }
}
