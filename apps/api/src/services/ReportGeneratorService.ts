import { getFirestore } from '../lib/firebase-admin';
import { COLLECTIONS } from '@pulseclinic/config';
import { InvoiceRecord, FinancialReportResponse, StockLedgerEntry } from '@pulseclinic/types';

export class ReportGeneratorService {
  /**
   * Compiles comprehensive financial performance report (Prompt 21)
   */
  static async compileFinancialReport(
    storeId: string,
    startDate?: string,
    endDate?: string
  ): Promise<FinancialReportResponse> {
    const db = getFirestore();
    const start = startDate ? new Date(startDate).toISOString() : '2000-01-01T00:00:00.000Z';
    const end = endDate ? new Date(endDate).toISOString() : '2099-12-31T23:59:59.999Z';

    // 1. Invoices
    const invoicesSnapshot = await db.collection(COLLECTIONS.invoices(storeId)).get();
    let grossSalesPaise = 0;
    let totalDiscountsPaise = 0;
    let taxableSalesPaise = 0;
    let totalTaxPaise = 0;
    let netSalesPaise = 0;
    let invoiceCount = 0;

    const paymentModes = { cashPaise: 0, upiPaise: 0, cardPaise: 0 };
    const taxSlabMap = new Map<number, { taxablePaise: number; taxPaise: number }>();

    for (const doc of invoicesSnapshot.docs) {
      const inv = doc.data() as InvoiceRecord;
      if (inv.status === 'FINALIZED' && inv.createdAt >= start && inv.createdAt <= end) {
        invoiceCount++;
        grossSalesPaise += inv.grossTotalPaise || 0;
        totalDiscountsPaise += inv.totalDiscountPaise || 0;
        taxableSalesPaise += inv.taxableTotalPaise || 0;
        totalTaxPaise += inv.taxTotalPaise || 0;
        netSalesPaise += inv.netPayablePaise || 0;

        for (const pm of inv.paymentModes || []) {
          if (pm.mode === 'CASH') paymentModes.cashPaise += pm.amountPaise;
          else if (pm.mode === 'UPI') paymentModes.upiPaise += pm.amountPaise;
          else if (pm.mode === 'CARD') paymentModes.cardPaise += pm.amountPaise;
        }

        for (const item of inv.items || []) {
          const rate = item.gstRateBps || 0;
          const curr = taxSlabMap.get(rate) || { taxablePaise: 0, taxPaise: 0 };
          curr.taxablePaise += item.taxablePaise;
          curr.taxPaise += item.lineTaxPaise;
          taxSlabMap.set(rate, curr);
        }
      }
    }

    // 2. Refunds
    const refundsSnapshot = await db.collection(COLLECTIONS.refunds(storeId)).get();
    let totalRefundsPaise = 0;
    let refundCount = 0;
    for (const doc of refundsSnapshot.docs) {
      const ref = doc.data();
      if (ref.createdAt >= start && ref.createdAt <= end) {
        refundCount++;
        totalRefundsPaise += ref.netRefundPaise || 0;
      }
    }

    // 3. Expenses
    const expensesSnapshot = await db.collection(COLLECTIONS.expenses(storeId)).get();
    let totalExpensesPaise = 0;
    for (const doc of expensesSnapshot.docs) {
      const exp = doc.data();
      if (exp.createdAt >= start && exp.createdAt <= end) {
        totalExpensesPaise += exp.amountPaise || 0;
      }
    }

    const netProfitPaise = netSalesPaise - totalRefundsPaise - totalExpensesPaise;

    const taxSlabBreakdown = Array.from(taxSlabMap.entries())
      .map(([gstRateBps, vals]) => ({
        gstRateBps,
        taxablePaise: vals.taxablePaise,
        taxPaise: vals.taxPaise,
      }))
      .sort((a, b) => a.gstRateBps - b.gstRateBps);

    return {
      storeId,
      startDate: start.split('T')[0],
      endDate: end.split('T')[0],
      grossSalesPaise,
      totalDiscountsPaise,
      taxableSalesPaise,
      totalTaxPaise,
      netSalesPaise,
      totalRefundsPaise,
      totalExpensesPaise,
      netProfitPaise,
      invoiceCount,
      refundCount,
      paymentModeBreakdown: paymentModes,
      taxSlabBreakdown,
    };
  }

  /**
   * Compiles inventory movement summary from stock ledger
   */
  static async compileInventoryMovement(
    storeId: string,
    startDate?: string,
    endDate?: string
  ): Promise<{
    movements: Array<{ type: string; reason: string; totalUnits: number }>;
    totalChangeUnits: number;
  }> {
    const db = getFirestore();
    const start = startDate ? new Date(startDate).toISOString() : '2000-01-01T00:00:00.000Z';
    const end = endDate ? new Date(endDate).toISOString() : '2099-12-31T23:59:59.999Z';

    const ledgerSnapshot = await db.collection(COLLECTIONS.stockLedger(storeId)).get();

    const summaryMap = new Map<string, { type: string; reason: string; totalUnits: number }>();
    let totalChangeUnits = 0;

    for (const doc of ledgerSnapshot.docs) {
      const entry = doc.data() as StockLedgerEntry;
      if (entry.createdAt >= start && entry.createdAt <= end) {
        const key = `${entry.movementType}_${entry.reason || ''}`;
        const existing = summaryMap.get(key) || {
          type: entry.movementType,
          reason: entry.reason || 'General',
          totalUnits: 0,
        };
        existing.totalUnits += Math.abs(entry.changeUnits);
        totalChangeUnits += entry.changeUnits;
        summaryMap.set(key, existing);
      }
    }

    return {
      movements: Array.from(summaryMap.values()),
      totalChangeUnits,
    };
  }
}
