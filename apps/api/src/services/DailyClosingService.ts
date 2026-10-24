import { getFirestore } from '../lib/firebase-admin';
import { COLLECTIONS } from '@pulseclinic/config';
import { BatchInventory, InvoiceRecord } from '@pulseclinic/types';
import { AuditExplorerService } from './AuditExplorerService';

export interface DailySummaryDoc {
  id: string;
  storeId: string;
  summaryDate: string; // YYYY-MM-DD
  grossSalesPaise: number;
  totalTaxPaise: number;
  totalRefundsPaise: number;
  totalExpensesPaise: number;
  netRevenuePaise: number;
  invoiceCount: number;
  refundCount: number;
  cashSalesPaise: number;
  upiSalesPaise: number;
  cardSalesPaise: number;
  isClosed: boolean;
  closedBy?: string;
  closedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardMetricsResponse {
  todaySalesPaise: number;
  todayTaxPaise: number;
  todayRefundsPaise: number;
  todayExpensesPaise: number;
  todayNetRevenuePaise: number;
  todayInvoiceCount: number;
  lowStockItemsCount: number;
  expiringSoonItemsCount: number;
  recentInvoices: InvoiceRecord[];
  isDayClosed: boolean;
  summaryDate: string;
}

export class DailyClosingService {
  /**
   * Computes or fetches live executive store dashboard metrics
   */
  static async getDashboardMetrics(storeId: string): Promise<DashboardMetricsResponse> {
    const db = getFirestore();
    const today = new Date().toISOString().split('T')[0];

    // Check if day is already closed in dailySummaries
    const summaryRef = db.collection(COLLECTIONS.dailySummaries(storeId)).doc(today);
    const summaryDoc = await summaryRef.get();
    const isDayClosed = summaryDoc.exists && summaryDoc.data()?.isClosed === true;

    // Fetch invoices for today
    const invoicesSnapshot = await db.collection(COLLECTIONS.invoices(storeId)).get();
    let todaySalesPaise = 0;
    let todayTaxPaise = 0;
    let todayInvoiceCount = 0;

    let allInvoices: InvoiceRecord[] = [];

    for (const doc of invoicesSnapshot.docs) {
      const inv = { id: doc.id, ...(doc.data() as Omit<InvoiceRecord, 'id'>) };
      allInvoices.push(inv);

      if (inv.createdAt.startsWith(today)) {
        if (inv.status === 'FINALIZED') {
          todaySalesPaise += inv.netPayablePaise || 0;
          todayTaxPaise += inv.taxTotalPaise || 0;
          todayInvoiceCount++;
        }
      }
    }

    // Sort recent invoices by createdAt desc
    allInvoices.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    const recentInvoices = allInvoices.slice(0, 5);

    // Fetch today's refunds
    const refundsSnapshot = await db.collection(COLLECTIONS.refunds(storeId)).get();
    let todayRefundsPaise = 0;
    for (const doc of refundsSnapshot.docs) {
      const ref = doc.data();
      if ((ref.createdAt || '').startsWith(today)) {
        todayRefundsPaise += ref.netRefundPaise || 0;
      }
    }

    // Fetch today's expenses
    const expensesSnapshot = await db.collection(COLLECTIONS.expenses(storeId)).get();
    let todayExpensesPaise = 0;
    for (const doc of expensesSnapshot.docs) {
      const exp = doc.data();
      if ((exp.createdAt || '').startsWith(today)) {
        todayExpensesPaise += exp.amountPaise || 0;
      }
    }

    // Today's Net Revenue = Sales - Refunds - Expenses
    const todayNetRevenuePaise = todaySalesPaise - todayRefundsPaise - todayExpensesPaise;

    // Inventory Health: Low stock & Expiring soon
    const batchesSnapshot = await db.collection(COLLECTIONS.batches(storeId)).get();
    let lowStockItemsCount = 0;
    let expiringSoonItemsCount = 0;

    const ninetyDaysFromNow = new Date();
    ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);
    const ninetyDaysStr = ninetyDaysFromNow.toISOString().split('T')[0];

    for (const doc of batchesSnapshot.docs) {
      const batch = doc.data() as BatchInventory;
      if (batch.status !== 'RECALLED') {
        if ((batch.stockUnits || 0) <= 20) {
          lowStockItemsCount++;
        }
        if (batch.expiryDate && batch.expiryDate <= ninetyDaysStr) {
          expiringSoonItemsCount++;
        }
      }
    }

    return {
      todaySalesPaise,
      todayTaxPaise,
      todayRefundsPaise,
      todayExpensesPaise,
      todayNetRevenuePaise,
      todayInvoiceCount,
      lowStockItemsCount,
      expiringSoonItemsCount,
      recentInvoices,
      isDayClosed,
      summaryDate: today,
    };
  }

  /**
   * Executes daily closing procedure (Prompt 20)
   */
  static async executeDailyClosing(
    storeId: string,
    closedByUid: string,
    notes?: string
  ): Promise<DailySummaryDoc> {
    const db = getFirestore();
    const today = new Date().toISOString().split('T')[0];
    const summaryRef = db.collection(COLLECTIONS.dailySummaries(storeId)).doc(today);

    const metrics = await this.getDashboardMetrics(storeId);
    const now = new Date().toISOString();

    const summaryRecord: DailySummaryDoc = {
      id: today,
      storeId,
      summaryDate: today,
      grossSalesPaise: metrics.todaySalesPaise,
      totalTaxPaise: metrics.todayTaxPaise,
      totalRefundsPaise: metrics.todayRefundsPaise,
      totalExpensesPaise: metrics.todayExpensesPaise,
      netRevenuePaise: metrics.todayNetRevenuePaise,
      invoiceCount: metrics.todayInvoiceCount,
      refundCount: 0,
      cashSalesPaise: 0,
      upiSalesPaise: 0,
      cardSalesPaise: 0,
      isClosed: true,
      closedBy: closedByUid,
      closedAt: now,
      ...(notes?.trim() ? { notes: notes.trim() } : {}),
      createdAt: now,
      updatedAt: now,
    };

    await summaryRef.set(summaryRecord, { merge: true });

    try {
      await AuditExplorerService.logEvent(storeId, {
        action: 'DAILY_CLOSING_EXECUTED',
        actorUid: closedByUid,
        summary: `Daily register closed for ${today} with net revenue ₹${(summaryRecord.netRevenuePaise / 100).toFixed(2)}`,
        entityType: 'DAILY_SUMMARY',
        entityId: today,
        payload: {
          date: today,
          grossSalesPaise: summaryRecord.grossSalesPaise,
          netRevenuePaise: summaryRecord.netRevenuePaise,
          totalExpensesPaise: summaryRecord.totalExpensesPaise,
          invoiceCount: summaryRecord.invoiceCount,
          notes: summaryRecord.notes,
        },
      });
    } catch (auditErr) {
      console.error('Failed to write daily closing audit log:', auditErr);
    }

    return summaryRecord;
  }
}
