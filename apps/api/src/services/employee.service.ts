import { getFirestore } from '../lib/firebase-admin';
import { COLLECTIONS } from '@pulseclinic/config';
import {
  EmployeeProfileMasked,
  CreateEmployeeInput,
  UpdateEmployeeInput,
  EmployeeLedgerEntry,
  RecordEmployeeLedgerInput,
  validateAadhaarLastFour,
  validatePanLastFour,
} from '@pulseclinic/types';

export class EmployeeService {
  private static getEmployeesCol(storeId: string) {
    const db = getFirestore();
    return db.collection(COLLECTIONS.employees(storeId));
  }

  private static getLedgerCol(storeId: string) {
    const db = getFirestore();
    return db.collection(COLLECTIONS.employeeLedger(storeId));
  }

  static async list(
    storeId: string,
    options: { role?: string; status?: string; limit?: number; cursor?: string } = {}
  ): Promise<{ employees: EmployeeProfileMasked[]; nextCursor?: string }> {
    const colRef = this.getEmployeesCol(storeId);
    const limitCount = Math.min(options.limit || 50, 100);

    let query: FirebaseFirestore.Query = colRef.orderBy('fullName', 'asc').limit(limitCount + 1);

    if (options.role) {
      query = query.where('assignedRole', '==', options.role);
    }
    if (options.status) {
      query = query.where('status', '==', options.status);
    }

    if (options.cursor) {
      const cursorDoc = await colRef.doc(options.cursor).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    const snapshot = await query.get();
    let docs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<EmployeeProfileMasked, 'id'>),
    }));

    let nextCursor: string | undefined = undefined;
    if (docs.length > limitCount) {
      const nextDoc = docs[limitCount - 1];
      nextCursor = nextDoc.id;
      docs = docs.slice(0, limitCount);
    }

    return { employees: docs, nextCursor };
  }

  static async getById(storeId: string, employeeId: string): Promise<EmployeeProfileMasked | null> {
    const doc = await this.getEmployeesCol(storeId).doc(employeeId).get();
    if (!doc.exists) return null;
    return {
      id: doc.id,
      ...(doc.data() as Omit<EmployeeProfileMasked, 'id'>),
    };
  }

  static async create(storeId: string, input: CreateEmployeeInput): Promise<string> {
    if (!input.fullName || !input.fullName.trim()) {
      throw new Error('Employee full name is required');
    }
    if (!input.email || !input.email.trim()) {
      throw new Error('Employee email is required');
    }
    if (!input.phone || !input.phone.trim()) {
      throw new Error('Employee phone number is required');
    }

    // DPDP validation (DEC-OPEN-04) - REJECT raw 12-digit Aadhaar or raw 10-char PAN
    const aadhaarCheck = validateAadhaarLastFour(input.aadhaarLastFour);
    if (!aadhaarCheck.valid) {
      throw new Error(aadhaarCheck.error);
    }

    const panCheck = validatePanLastFour(input.panLastFour);
    if (!panCheck.valid) {
      throw new Error(panCheck.error);
    }

    const colRef = this.getEmployeesCol(storeId);
    const docRef = colRef.doc();
    const now = new Date().toISOString();

    const data: Omit<EmployeeProfileMasked, 'id'> = {
      storeId,
      fullName: input.fullName.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone.trim(),
      assignedRole: input.assignedRole || 'PHARMACIST',
      status: 'ACTIVE',
      salaryPaise: Math.max(0, Math.floor(Number(input.salaryPaise) || 0)),
      advanceBalancePaise: 0,
      aadhaarLastFour: input.aadhaarLastFour.trim(),
      panLastFour: input.panLastFour.trim().toUpperCase(),
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(data);
    return docRef.id;
  }

  static async update(
    storeId: string,
    employeeId: string,
    input: UpdateEmployeeInput
  ): Promise<void> {
    const docRef = this.getEmployeesCol(storeId).doc(employeeId);
    const doc = await docRef.get();
    if (!doc.exists) {
      throw new Error('Employee not found');
    }

    const updates: Partial<EmployeeProfileMasked> = {
      updatedAt: new Date().toISOString(),
    };

    if (input.fullName !== undefined) updates.fullName = input.fullName.trim();
    if (input.email !== undefined) updates.email = input.email.trim().toLowerCase();
    if (input.phone !== undefined) updates.phone = input.phone.trim();
    if (input.assignedRole !== undefined) updates.assignedRole = input.assignedRole;
    if (input.status !== undefined) updates.status = input.status;
    if (input.salaryPaise !== undefined) {
      updates.salaryPaise = Math.max(0, Math.floor(Number(input.salaryPaise) || 0));
    }

    await docRef.update(updates);
  }

  static async getLedger(
    storeId: string,
    employeeId: string,
    limitCount: number = 50
  ): Promise<{ entries: EmployeeLedgerEntry[]; currentBalancePaise: number }> {
    const employee = await this.getById(storeId, employeeId);
    if (!employee) {
      throw new Error('Employee not found');
    }

    const ledgerRef = this.getLedgerCol(storeId);
    const snapshot = await ledgerRef
      .where('employeeId', '==', employeeId)
      .orderBy('createdAt', 'desc')
      .limit(limitCount)
      .get();

    const entries = snapshot.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<EmployeeLedgerEntry, 'id'>),
    }));

    return {
      entries,
      currentBalancePaise: employee.advanceBalancePaise,
    };
  }

  static async recordLedgerEntry(
    storeId: string,
    employeeId: string,
    input: RecordEmployeeLedgerInput,
    recordedBy: string
  ): Promise<{ entryId: string; newBalancePaise: number }> {
    if (!input.amountPaise || input.amountPaise <= 0) {
      throw new Error('Amount must be a positive integer in paise');
    }
    if (!input.description || !input.description.trim()) {
      throw new Error('Description is required for ledger audit');
    }

    const db = getFirestore();
    const employeeRef = this.getEmployeesCol(storeId).doc(employeeId);
    const ledgerRef = this.getLedgerCol(storeId).doc();

    const result = await db.runTransaction(async (t) => {
      const empDoc = await t.get(employeeRef);
      if (!empDoc.exists) {
        throw new Error('Employee not found');
      }

      const empData = empDoc.data() as EmployeeProfileMasked;
      const currentAdvance = empData.advanceBalancePaise || 0;
      let newBalancePaise = currentAdvance;

      if (input.type === 'ADVANCE') {
        newBalancePaise = currentAdvance + input.amountPaise;
      } else if (input.type === 'REPAYMENT') {
        newBalancePaise = Math.max(0, currentAdvance - input.amountPaise);
      }
      // For SALARY_PAYMENT, it is a disbursement transaction; advance remains unless offset

      const now = new Date().toISOString();
      const ledgerEntry: Omit<EmployeeLedgerEntry, 'id'> = {
        storeId,
        employeeId,
        type: input.type,
        amountPaise: input.amountPaise,
        balanceAfterPaise: newBalancePaise,
        description: input.description.trim(),
        referenceNumber: input.referenceNumber?.trim() || undefined,
        recordedBy,
        createdAt: now,
      };

      t.set(ledgerRef, ledgerEntry);
      t.update(employeeRef, {
        advanceBalancePaise: newBalancePaise,
        updatedAt: now,
      });

      return {
        entryId: ledgerRef.id,
        newBalancePaise,
      };
    });

    return result;
  }
}
