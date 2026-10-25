import { getFirestore } from '../lib/firebase-admin';
import { COLLECTIONS } from '@pulseclinic/config';
import { DoctorProfile, CreateDoctorInput, UpdateDoctorInput } from '@pulseclinic/types';

export class DoctorService {
  private static getDoctorsCol(storeId: string) {
    const db = getFirestore();
    return db.collection(COLLECTIONS.doctors(storeId));
  }

  static async list(
    storeId: string,
    options: { search?: string; isActive?: boolean; limit?: number; cursor?: string } = {}
  ): Promise<{ doctors: DoctorProfile[]; nextCursor?: string }> {
    const colRef = this.getDoctorsCol(storeId);
    const limitCount = Math.min(options.limit || 50, 100);

    // Single-field orderBy avoids requiring composite index in Firestore
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
      ...(doc.data() as Omit<DoctorProfile, 'id'>),
    }));

    if (options.isActive !== undefined) {
      docs = docs.filter((d) => (options.isActive ? d.isActive !== false : d.isActive === false));
    }

    if (options.search && options.search.trim().length > 0) {
      const q = options.search.toLowerCase().trim();
      docs = docs.filter(
        (d) =>
          d.name?.toLowerCase().includes(q) ||
          d.registrationNumber?.toLowerCase().includes(q) ||
          d.specialization?.toLowerCase().includes(q) ||
          d.phone?.toLowerCase().includes(q)
      );
    }

    let nextCursor: string | undefined = undefined;
    if (docs.length > limitCount) {
      const nextDoc = docs[limitCount - 1];
      nextCursor = nextDoc.id;
      docs = docs.slice(0, limitCount);
    }

    return { doctors: docs, nextCursor };
  }

  static async getById(storeId: string, doctorId: string): Promise<DoctorProfile | null> {
    const doc = await this.getDoctorsCol(storeId).doc(doctorId).get();
    if (!doc.exists) return null;
    return {
      id: doc.id,
      ...(doc.data() as Omit<DoctorProfile, 'id'>),
    };
  }

  static async create(storeId: string, input: CreateDoctorInput): Promise<string> {
    if (!input.name || !input.name.trim()) {
      throw new Error('Doctor name is required');
    }
    if (!input.registrationNumber || !input.registrationNumber.trim()) {
      throw new Error('Medical registration number is required');
    }

    const now = new Date().toISOString();
    const colRef = this.getDoctorsCol(storeId);
    const docRef = colRef.doc();

    const data: Omit<DoctorProfile, 'id'> = {
      storeId,
      name: input.name.trim(),
      registrationNumber: input.registrationNumber.trim().toUpperCase(),
      specialization: input.specialization?.trim() || 'General Medicine',
      phone: input.phone?.trim() || '',
      email: input.email?.trim() || '',
      hospitalClinic: input.hospitalClinic?.trim() || '',
      commissionBps: Number(input.commissionBps) || 0,
      // DEC-OPEN-02: Doctor commission must be configurable and disabled by default
      commissionEnabled: input.commissionEnabled === true,
      prescriptionsLinkedCount: 0,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(data);
    return docRef.id;
  }

  static async update(storeId: string, doctorId: string, input: UpdateDoctorInput): Promise<void> {
    const docRef = this.getDoctorsCol(storeId).doc(doctorId);
    const doc = await docRef.get();
    if (!doc.exists) {
      throw new Error('Doctor not found');
    }

    const updates: Partial<DoctorProfile> = {
      updatedAt: new Date().toISOString(),
    };

    if (input.name !== undefined) updates.name = input.name.trim();
    if (input.registrationNumber !== undefined) updates.registrationNumber = input.registrationNumber.trim().toUpperCase();
    if (input.specialization !== undefined) updates.specialization = input.specialization.trim();
    if (input.phone !== undefined) updates.phone = input.phone.trim();
    if (input.email !== undefined) updates.email = input.email.trim();
    if (input.hospitalClinic !== undefined) updates.hospitalClinic = input.hospitalClinic.trim();
    if (input.commissionBps !== undefined) updates.commissionBps = Number(input.commissionBps);
    if (input.commissionEnabled !== undefined) updates.commissionEnabled = input.commissionEnabled === true;
    if (input.isActive !== undefined) updates.isActive = input.isActive;

    await docRef.update(updates);
  }

  static async incrementPrescriptionsCount(storeId: string, doctorId: string): Promise<void> {
    const docRef = this.getDoctorsCol(storeId).doc(doctorId);
    const { FieldValue } = await import('firebase-admin/firestore');
    await docRef.update({
      prescriptionsLinkedCount: FieldValue.increment(1),
      updatedAt: new Date().toISOString(),
    });
  }
}
