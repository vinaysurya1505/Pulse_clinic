import { getFirestore } from '../lib/firebase-admin';
import { COLLECTIONS } from '@pulseclinic/config';
import {
  ExecuteRefundInput,
  RefundRecord,
  InvoiceRecord,
  BatchInventory,
  RefundLineItem,
  PaymentEntry,
} from '@pulseclinic/types';
import { ApprovalCodeService } from './ApprovalCodeService';
import { AuditExplorerService } from './AuditExplorerService';

export class RefundExecutionEngine {
  /**
   * Executes atomic refund and cancellation (Prompt 18, ADR-015)
   */
  static async executeRefund(
    storeId: string,
    invoiceId: string,
    input: ExecuteRefundInput,
    operatorUid: string
  ): Promise<{ refundRecord: RefundRecord; invoiceStatus: string }> {
    const db = getFirestore();
    const invoiceRef = db.collection(COLLECTIONS.invoices(storeId)).doc(invoiceId);
    const refundsCol = db.collection(COLLECTIONS.refunds(storeId));
    const batchesCol = db.collection(COLLECTIONS.batches(storeId));
    const stockLedgerCol = db.collection(COLLECTIONS.stockLedger(storeId));
    const salesLedgerCol = db.collection(COLLECTIONS.salesLedger(storeId));

    const refundDocRef = refundsCol.doc();
    const now = new Date().toISOString();

    const result = await db.runTransaction(async (t) => {
      // PHASE 1: READS FIRST
      const invoiceDoc = await t.get(invoiceRef);
      if (!invoiceDoc.exists) {
        throw new Error(`Invoice ${invoiceId} not found`);
      }
      const invoice = invoiceDoc.data() as InvoiceRecord;

      const doctorCommissionRef = db.collection(COLLECTIONS.doctorCommissions(storeId)).doc(invoiceId);
      const doctorCommissionDoc = await t.get(doctorCommissionRef);

      // Read commission summary for the doctor if applicable
      let commSummaryRef: FirebaseFirestore.DocumentReference | null = null;
      let commSummarySnap: FirebaseFirestore.DocumentSnapshot | null = null;
      if (doctorCommissionDoc.exists) {
        const commData = doctorCommissionDoc.data()!;
        commSummaryRef = db.collection(COLLECTIONS.doctorCommissionSummaries(storeId)).doc(commData.doctorId);
        commSummarySnap = await t.get(commSummaryRef);
      }

      if (invoice.status !== 'FINALIZED' && invoice.status !== 'PARTIALLY_REFUNDED') {
        throw new Error(`Cannot refund invoice with status "${invoice.status}".`);
      }

      // Determine items to refund
      const refundType = input.refundType || 'FULL';
      let itemsToRefund: RefundLineItem[] = [];

      if (refundType === 'FULL') {
        itemsToRefund = invoice.items.map((it) => ({
          medicineId: it.medicineId,
          medicineName: it.medicineName,
          batchId: it.batchId,
          batchNumber: it.batchNumber,
          quantityUnits: it.quantityUnits,
          lineTotalPaise: it.lineTotalPaise,
        }));
      } else {
        if (!input.lineItems || input.lineItems.length === 0) {
          throw new Error('Line items are required for partial refund');
        }
        for (const reqItem of input.lineItems) {
          const matched = invoice.items.find((it) => it.batchId === reqItem.batchId);
          if (!matched) {
            throw new Error(`Batch ${reqItem.batchId} does not belong to invoice ${invoice.invoiceNumber}`);
          }
          if (reqItem.quantityUnits > matched.quantityUnits) {
            throw new Error(`Refund quantity (${reqItem.quantityUnits}) exceeds billed quantity (${matched.quantityUnits}) for ${matched.medicineName}`);
          }
          const unitRatePaise = Math.round(matched.lineTotalPaise / matched.quantityUnits);
          itemsToRefund.push({
            medicineId: matched.medicineId,
            medicineName: matched.medicineName,
            batchId: matched.batchId,
            batchNumber: matched.batchNumber,
            quantityUnits: reqItem.quantityUnits,
            lineTotalPaise: unitRatePaise * reqItem.quantityUnits,
          });
        }
      }

      // Read all batch documents inside the transaction
      const batchDocs = await Promise.all(
        itemsToRefund.map((it) => t.get(batchesCol.doc(it.batchId)))
      );

      // Verify and atomically consume approval code
      await ApprovalCodeService.verifyAndConsumeCode(
        t,
        storeId,
        input.requestId,
        input.approvalCode
      );

      // PHASE 2: CALCULATIONS
      const netRefundPaise = itemsToRefund.reduce((sum, it) => sum + it.lineTotalPaise, 0);

      // Default refund mode to CASH or invoice's primary mode
      const refundModes: PaymentEntry[] =
        input.refundModes && input.refundModes.length > 0
          ? input.refundModes
          : [{ mode: 'CASH', amountPaise: netRefundPaise }];

      const newInvoiceStatus = refundType === 'FULL' ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

      // PHASE 3: WRITES
      // 1. Restore batch stock and write stock ledger entries
      for (let i = 0; i < itemsToRefund.length; i++) {
        const item = itemsToRefund[i];
        const bDoc = batchDocs[i];

        if (bDoc.exists) {
          const bData = bDoc.data() as BatchInventory;
          const restoredStock = (bData.stockUnits || 0) + item.quantityUnits;

          t.update(batchesCol.doc(item.batchId), {
            stockUnits: restoredStock,
            updatedAt: now,
          });

          // Write immutable stock reversal entry (ADR-012)
          const stockLedgerEntryRef = stockLedgerCol.doc();
          t.set(stockLedgerEntryRef, {
            storeId,
            batchId: item.batchId,
            medicineId: item.medicineId,
            type: 'IN',
            reason: 'SALE_RETURN',
            changeUnits: item.quantityUnits,
            stockAfterUnits: restoredStock,
            referenceId: invoice.invoiceNumber,
            recordedBy: operatorUid,
            createdAt: now,
          });
        }
      }

      // 2. Write sales reversal entry into salesLedger
      const salesReversalRef = salesLedgerCol.doc();
      t.set(salesReversalRef, {
        storeId,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        refundId: refundDocRef.id,
        type: 'REFUND',
        grandTotalPaise: -netRefundPaise,
        netPayablePaise: -netRefundPaise,
        paymentModes: refundModes,
        billerUid: operatorUid,
        createdAt: now,
      });

      // 3. Create refund audit record
      const refundRecord: RefundRecord = {
        id: refundDocRef.id,
        storeId,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        approvalRequestId: input.requestId,
        refundType,
        items: itemsToRefund,
        netRefundPaise,
        refundModes,
        reason: input.reason || 'Customer Return',
        processedBy: operatorUid,
        createdAt: now,
      };
      t.set(refundDocRef, refundRecord);

      // 4. Update invoice status
      t.update(invoiceRef, {
        status: newInvoiceStatus,
        updatedAt: now,
      });

      // 5. Update doctor commission record if exists
      if (doctorCommissionDoc.exists) {
        const commData = doctorCommissionDoc.data()!;
        const reversedAmount = commData.finalDoctorCommissionPaise || 0;

        t.update(doctorCommissionRef, {
          invoiceStatus: newInvoiceStatus,
          finalDoctorCommissionPaise: 0,
          updatedAt: now,
        });

        // 5b. Write REFUND ledger entry
        if (reversedAmount > 0) {
          const ledgerRef = db.collection(COLLECTIONS.doctorCommissionLedger(storeId, commData.doctorId)).doc();
          t.set(ledgerRef, {
            id: ledgerRef.id,
            storeId,
            doctorId: commData.doctorId,
            doctorName: commData.doctorName || '',
            type: 'REFUND',
            amountPaise: -reversedAmount,
            invoiceId,
            invoiceNumber: invoice.invoiceNumber,
            billAmountPaise: invoice.netPayablePaise,
            profitPaise: commData.totalProfitPaise || 0,
            customerName: invoice.customer?.name || '',
            recordedBy: operatorUid,
            createdAt: now,
          });

          // 5c. Update commission summary
          if (commSummaryRef && commSummarySnap && commSummarySnap.exists) {
            const existing = commSummarySnap.data()!;
            t.update(commSummaryRef, {
              totalRefundedPaise: (existing.totalRefundedPaise || 0) + reversedAmount,
              remainingPaise: (existing.remainingPaise || 0) - reversedAmount,
              lastUpdatedAt: now,
            });
          }
        }
      }

      return { refundRecord, invoiceStatus: newInvoiceStatus };
    });

    try {
      await AuditExplorerService.logEvent(storeId, {
        action: 'INVOICE_REFUNDED',
        actorUid: operatorUid,
        summary: `Refunded invoice ${result.refundRecord.invoiceNumber} (₹${(result.refundRecord.netRefundPaise / 100).toFixed(2)})`,
        entityType: 'INVOICE',
        entityId: invoiceId,
        payload: {
          invoiceNumber: result.refundRecord.invoiceNumber,
          refundAmountPaise: result.refundRecord.netRefundPaise,
          reason: result.refundRecord.reason,
          refundModes: result.refundRecord.refundModes.map((m) => m.mode),
        },
      });
    } catch (auditErr) {
      console.error('Failed to write refund audit log:', auditErr);
    }

    return result;
  }
}
