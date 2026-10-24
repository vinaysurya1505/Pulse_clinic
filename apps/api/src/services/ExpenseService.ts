import { getFirestore } from '../lib/firebase-admin';
import { COLLECTIONS } from '@pulseclinic/config';
import { ExpenseRecord, CreateExpenseInput, ExpenseCategory } from '@pulseclinic/types';
import { AuditExplorerService } from './AuditExplorerService';

export class ExpenseService {
  private static getExpensesCol(storeId: string) {
    const db = getFirestore();
    return db.collection(COLLECTIONS.expenses(storeId));
  }

  static async list(
    storeId: string,
    options: {
      category?: ExpenseCategory;
      startDate?: string;
      endDate?: string;
      limit?: number;
    } = {}
  ): Promise<{ expenses: ExpenseRecord[]; totalAmountPaise: number }> {
    const colRef = this.getExpensesCol(storeId);
    const snapshot = await colRef.get();

    let docs = snapshot.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<ExpenseRecord, 'id'>),
    }));

    // In-memory sort to prevent Firestore index errors
    docs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    if (options.category) {
      docs = docs.filter((e) => e.category === options.category);
    }
    if (options.startDate) {
      docs = docs.filter((e) => e.createdAt >= options.startDate!);
    }
    if (options.endDate) {
      docs = docs.filter((e) => e.createdAt <= options.endDate!);
    }

    const totalAmountPaise = docs.reduce((sum, e) => sum + (e.amountPaise || 0), 0);

    if (options.limit && docs.length > options.limit) {
      docs = docs.slice(0, options.limit);
    }

    return { expenses: docs, totalAmountPaise };
  }

  static async create(
    storeId: string,
    input: CreateExpenseInput,
    paidByUid: string
  ): Promise<ExpenseRecord> {
    if (!input.amountPaise || input.amountPaise <= 0) {
      throw new Error('Expense amount must be a positive integer in paise');
    }
    if (!input.description || !input.description.trim()) {
      throw new Error('Expense description is required');
    }

    const colRef = this.getExpensesCol(storeId);
    const docRef = colRef.doc();
    const now = new Date().toISOString();

    const record: ExpenseRecord = {
      id: docRef.id,
      storeId,
      category: input.category,
      amountPaise: Math.floor(input.amountPaise),
      paymentMode: input.paymentMode,
      description: input.description.trim(),
      ...(input.vendorName?.trim() ? { vendorName: input.vendorName.trim() } : {}),
      ...(input.billInvoiceNumber?.trim() ? { billInvoiceNumber: input.billInvoiceNumber.trim() } : {}),
      paidByUid,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(record);

    try {
      await AuditExplorerService.logEvent(storeId, {
        action: 'EXPENSE_RECORDED',
        actorUid: paidByUid,
        summary: `Recorded ${record.category} expense of ₹${(record.amountPaise / 100).toFixed(2)}`,
        entityType: 'EXPENSE',
        entityId: record.id,
        payload: {
          category: record.category,
          amountPaise: record.amountPaise,
          description: record.description,
          paymentMode: record.paymentMode,
          vendorName: record.vendorName,
        },
      });
    } catch (auditErr) {
      console.error('Failed to write expense audit log:', auditErr);
    }

    return record;
  }
}
