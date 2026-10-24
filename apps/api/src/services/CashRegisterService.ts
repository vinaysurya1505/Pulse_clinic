import { getFirestore } from '../lib/firebase-admin';
import { COLLECTIONS } from '@pulseclinic/config';
import {
  CashRegisterSession,
  OpenCashRegisterInput,
  CloseCashRegisterInput,
} from '@pulseclinic/types';

export class CashRegisterService {
  private static getRegisterCol(storeId: string) {
    const db = getFirestore();
    return db.collection(COLLECTIONS.cashRegister(storeId));
  }

  static async getActiveSession(storeId: string): Promise<CashRegisterSession | null> {
    const colRef = this.getRegisterCol(storeId);
    const snapshot = await colRef.where('status', '==', 'OPEN').limit(1).get();
    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    const session = { id: doc.id, ...(doc.data() as Omit<CashRegisterSession, 'id'>) };

    // Calculate live expected cash
    const liveMetrics = await this.calculateSessionCashFlow(storeId, session.openedAt);
    const expectedCashPaise = session.openingCashPaise + liveMetrics.cashSalesPaise - liveMetrics.cashRefundsPaise - liveMetrics.cashExpensesPaise;

    return {
      ...session,
      totalCashSalesPaise: liveMetrics.cashSalesPaise,
      totalCashExpensesPaise: liveMetrics.cashExpensesPaise,
      totalCashRefundsPaise: liveMetrics.cashRefundsPaise,
      expectedCashPaise,
    };
  }

  static async openRegister(
    storeId: string,
    input: OpenCashRegisterInput,
    openedBy: string
  ): Promise<CashRegisterSession> {
    const existing = await this.getActiveSession(storeId);
    if (existing) {
      throw new Error(`A cash drawer session is already open (Session #${existing.id}). Close the current session before opening a new one.`);
    }

    if (input.openingCashPaise < 0) {
      throw new Error('Opening cash amount cannot be negative');
    }

    const colRef = this.getRegisterCol(storeId);
    const docRef = colRef.doc();
    const now = new Date();
    const sessionDate = now.toISOString().split('T')[0];
    const openedAt = now.toISOString();

    const session: CashRegisterSession = {
      id: docRef.id,
      storeId,
      sessionDate,
      status: 'OPEN',
      openingCashPaise: Math.floor(input.openingCashPaise),
      ...(input.notes?.trim() ? { openingNotes: input.notes.trim() } : {}),
      openedBy,
      openedAt,
      totalCashSalesPaise: 0,
      totalCashExpensesPaise: 0,
      totalCashRefundsPaise: 0,
      expectedCashPaise: Math.floor(input.openingCashPaise),
      updatedAt: openedAt,
    };

    await docRef.set(session);
    return session;
  }

  static async closeRegister(
    storeId: string,
    input: CloseCashRegisterInput,
    closedBy: string
  ): Promise<CashRegisterSession> {
    const active = await this.getActiveSession(storeId);
    if (!active) {
      throw new Error('No open cash register session found to close');
    }

    if (input.actualCashCountPaise < 0) {
      throw new Error('Actual counted physical cash cannot be negative');
    }

    const liveMetrics = await this.calculateSessionCashFlow(storeId, active.openedAt);
    const expectedCashPaise =
      active.openingCashPaise +
      liveMetrics.cashSalesPaise -
      liveMetrics.cashRefundsPaise -
      liveMetrics.cashExpensesPaise;

    const discrepancyPaise = Math.floor(input.actualCashCountPaise) - expectedCashPaise;
    const now = new Date().toISOString();

    const colRef = this.getRegisterCol(storeId);
    const docRef = colRef.doc(active.id);

    const closedSession: Partial<CashRegisterSession> = {
      status: 'CLOSED',
      closingCashCountPaise: Math.floor(input.actualCashCountPaise),
      expectedCashPaise,
      discrepancyPaise,
      totalCashSalesPaise: liveMetrics.cashSalesPaise,
      totalCashExpensesPaise: liveMetrics.cashExpensesPaise,
      totalCashRefundsPaise: liveMetrics.cashRefundsPaise,
      ...(input.notes?.trim() ? { closingNotes: input.notes.trim() } : {}),
      closedBy,
      closedAt: now,
      updatedAt: now,
    };

    await docRef.update(closedSession);

    return {
      ...active,
      ...closedSession,
      status: 'CLOSED',
    } as CashRegisterSession;
  }

  /**
   * Calculates cash flow since openedAt
   */
  private static async calculateSessionCashFlow(
    storeId: string,
    openedAt: string
  ): Promise<{ cashSalesPaise: number; cashRefundsPaise: number; cashExpensesPaise: number }> {
    const db = getFirestore();

    // 1. Invoices salesLedger
    const salesSnapshot = await db.collection(COLLECTIONS.salesLedger(storeId)).get();
    let cashSalesPaise = 0;
    let cashRefundsPaise = 0;

    for (const doc of salesSnapshot.docs) {
      const data = doc.data();
      if ((data.createdAt || '') >= openedAt) {
        if (data.type === 'REFUND') {
          const cashPortion = (data.paymentModes || [])
            .filter((p: any) => p.mode === 'CASH')
            .reduce((sum: number, p: any) => sum + (p.amountPaise || 0), 0);
          cashRefundsPaise += Math.abs(cashPortion);
        } else {
          const cashPortion = (data.paymentModes || [])
            .filter((p: any) => p.mode === 'CASH')
            .reduce((sum: number, p: any) => sum + (p.amountPaise || 0), 0);
          cashSalesPaise += cashPortion;
        }
      }
    }

    // 2. Expenses paid in CASH
    const expensesSnapshot = await db.collection(COLLECTIONS.expenses(storeId)).get();
    let cashExpensesPaise = 0;

    for (const doc of expensesSnapshot.docs) {
      const data = doc.data();
      if ((data.createdAt || '') >= openedAt && data.paymentMode === 'CASH') {
        cashExpensesPaise += data.amountPaise || 0;
      }
    }

    return { cashSalesPaise, cashRefundsPaise, cashExpensesPaise };
  }
}
