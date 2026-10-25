import { getFirestore } from '../lib/firebase-admin';
import { COLLECTIONS } from '@pulseclinic/config';
import {
  BillingCalculationEngine,
  AuthoritativeQuoteRequest,
} from './BillingCalculationEngine';
import {
  PaymentEntry,
  BillingQuoteResult,
  BatchInventory,
  InvoiceRecord,
  DiscountAllocationMethod,
  DoctorCommissionRecord,
} from '@pulseclinic/types';
import { AuditExplorerService } from './AuditExplorerService';

export interface FinalizeBillInput {
  items: Array<{
    medicineId: string;
    batchId: string;
    quantityUnits: number;
    discountBps?: number;
    customGstRateBps?: number;
  }>;
  overallDiscountBps?: number;
  discountAllocationMethod?: DiscountAllocationMethod;
  paymentModes: PaymentEntry[];
  customer?: {
    name?: string;
    phone?: string;
    stateCode?: string;
  };
  doctorId?: string;
  doctorName?: string;
  prescriptionNumber?: string;
  idempotencyKey?: string;
}

export class BillFinalizationService {


  /**
   * Finalizes bill atomically (Prompt 13, ADR-007, ADR-014, ADR-012)
   */
  static async finalizeBill(
    storeId: string,
    input: FinalizeBillInput,
    billerUid: string
  ): Promise<InvoiceRecord> {
    if (!input.items || input.items.length === 0) {
      throw new Error('Cannot finalize an empty cart');
    }
    if (!input.paymentModes || input.paymentModes.length === 0) {
      throw new Error('At least one payment mode is required');
    }

    // Step 1: Pre-calculate server-authoritative quote
    const quoteReq: AuthoritativeQuoteRequest = {
      items: input.items,
      overallDiscountBps: input.overallDiscountBps,
      customerStateCode: input.customer?.stateCode,
      doctorId: input.doctorId,
      discountAllocationMethod: input.discountAllocationMethod,
    };
    const quote: BillingQuoteResult = await BillingCalculationEngine.calculateQuote(storeId, quoteReq);

    // Step 2: Validate split payments exact sum (Prompt 14)
    const totalPaidPaise = input.paymentModes.reduce((acc, p) => acc + (p.amountPaise || 0), 0);
    if (totalPaidPaise !== quote.netPayablePaise) {
      throw new Error(
        `Payment total (₹${(totalPaidPaise / 100).toFixed(2)}) does not match net payable (₹${(quote.netPayablePaise / 100).toFixed(2)})`
      );
    }

    const db = getFirestore();
    const now = new Date().toISOString();

    const invoiceRef = db.collection(COLLECTIONS.invoices(storeId)).doc();
    const batchesCol = db.collection(COLLECTIONS.batches(storeId));
    const stockLedgerCol = db.collection(COLLECTIONS.stockLedger(storeId));
    const salesLedgerCol = db.collection(COLLECTIONS.salesLedger(storeId));

    // Execute atomic transaction for invoice allocation, stock decrement, and ledger entries
    const invoiceRecord = await db.runTransaction(async (t) => {
      // PHASE 1: ALL READS FIRST (Strict Firestore transaction requirement)
      const counterRef = db.collection(COLLECTIONS.counters(storeId)).doc('invoices');
      const counterDoc = await t.get(counterRef);

      const batchDocs = await Promise.all(
        quote.items.map((item) => t.get(batchesCol.doc(item.batchId)))
      );

      const medicinesCol = db.collection(COLLECTIONS.medicines(storeId));
      const medDocs = await Promise.all(
        quote.items.map((it) => t.get(medicinesCol.doc(it.medicineId)))
      );

      // PHASE 2: CALCULATIONS & IN-MEMORY VALIDATION
      const nowObj = new Date();
      const yearMonth = `${nowObj.getFullYear()}${String(nowObj.getMonth() + 1).padStart(2, '0')}`;
      let nextSeq = 1001;
      if (counterDoc.exists) {
        const data = counterDoc.data();
        if (typeof data?.lastSequence === 'number' && data.lastSequence >= 1001) {
          nextSeq = data.lastSequence + 1;
        }
      }
      const invoiceNumber = `SMSC${nextSeq}`;

      // Verify stock availability inside transaction
      for (let i = 0; i < quote.items.length; i++) {
        const item = quote.items[i];
        const bDoc = batchDocs[i];

        if (!bDoc.exists) {
          throw new Error(`Batch ${item.batchId} not found in inventory during checkout`);
        }

        const bData = bDoc.data() as BatchInventory;
        if (bData.stockUnits < item.quantityUnits) {
          throw new Error(
            `Insufficient stock for ${item.medicineName} (Batch ${bData.batchNumber}). Requested: ${item.quantityUnits}, Available: ${bData.stockUnits}`
          );
        }
      }

      const hasScheduleH = medDocs.some((d) => {
        const data = d.data();
        return data?.scheduleCategory && ['H', 'H1', 'X'].includes(data.scheduleCategory);
      });

      // PHASE 3: ALL WRITES
      // 1. Increment sequential invoice counter
      t.set(
        counterRef,
        {
          yearMonth,
          lastSequence: nextSeq,
          updatedAt: now,
        },
        { merge: true }
      );

      // 2. Decrement stock and write stock ledger entries
      for (let i = 0; i < quote.items.length; i++) {
        const item = quote.items[i];
        const bDoc = batchDocs[i];
        const bData = bDoc.data() as BatchInventory;
        const newStock = bData.stockUnits - item.quantityUnits;

        t.update(batchesCol.doc(item.batchId), {
          stockUnits: newStock,
          updatedAt: now,
        });

        // Write immutable stock ledger entry (ADR-012)
        const stockLedgerEntryRef = stockLedgerCol.doc();
        t.set(stockLedgerEntryRef, {
          storeId,
          batchId: item.batchId,
          medicineId: item.medicineId,
          type: 'OUT',
          reason: 'SALE',
          changeUnits: -item.quantityUnits,
          stockAfterUnits: newStock,
          referenceId: invoiceNumber,
          recordedBy: billerUid,
          createdAt: now,
        });
      }

      // 3. Write sales ledger entry
      const salesLedgerEntryRef = salesLedgerCol.doc();
      t.set(salesLedgerEntryRef, {
        storeId,
        invoiceId: invoiceRef.id,
        invoiceNumber,
        grandTotalPaise: quote.grandTotalPaise,
        netPayablePaise: quote.netPayablePaise,
        taxTotalPaise: quote.taxTotalPaise,
        paymentModes: input.paymentModes,
        billerUid,
        createdAt: now,
      });

      // 4. Write master invoice document (clean all undefined fields)
      const record: InvoiceRecord = {
        id: invoiceRef.id,
        storeId,
        invoiceNumber,
        status: 'FINALIZED',
        calculationVersion: quote.calculationVersion,
        items: quote.items,
        grossTotalPaise: quote.grossTotalPaise,
        totalDiscountPaise: quote.totalDiscountPaise,
        taxableTotalPaise: quote.taxableTotalPaise,
        cgstTotalPaise: quote.cgstTotalPaise,
        sgstTotalPaise: quote.sgstTotalPaise,
        igstTotalPaise: quote.igstTotalPaise,
        taxTotalPaise: quote.taxTotalPaise,
        grandTotalPaise: quote.grandTotalPaise,
        roundOffPaise: quote.roundOffPaise,
        netPayablePaise: quote.netPayablePaise,
        paymentModes: input.paymentModes,
        ...(input.customer ? { customer: input.customer } : {}),
        ...(input.doctorId ? { doctorId: input.doctorId } : {}),
        ...(input.doctorName ? { doctorName: input.doctorName } : {}),
        ...(input.prescriptionNumber ? { prescriptionNumber: input.prescriptionNumber } : {}),
        hasScheduleH,
        billerUid,
        ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
        ...(quote.doctorCommissionBps !== undefined ? { doctorCommissionBps: quote.doctorCommissionBps } : {}),
        ...(quote.originalDoctorCommissionPaise !== undefined ? { originalDoctorCommissionPaise: quote.originalDoctorCommissionPaise } : {}),
        ...(quote.discountAllocationMethod ? { discountAllocationMethod: quote.discountAllocationMethod } : {}),
        ...(quote.nominalStoreDiscountPaise !== undefined ? { nominalStoreDiscountPaise: quote.nominalStoreDiscountPaise } : {}),
        ...(quote.nominalDoctorDiscountPaise !== undefined ? { nominalDoctorDiscountPaise: quote.nominalDoctorDiscountPaise } : {}),
        ...(quote.actualStoreDiscountPaise !== undefined ? { actualStoreDiscountPaise: quote.actualStoreDiscountPaise } : {}),
        ...(quote.actualDoctorDiscountPaise !== undefined ? { actualDoctorDiscountPaise: quote.actualDoctorDiscountPaise } : {}),
        ...(quote.unallocatedDiscountPaise !== undefined ? { unallocatedDiscountPaise: quote.unallocatedDiscountPaise } : {}),
        ...(quote.finalDoctorCommissionPaise !== undefined ? { finalDoctorCommissionPaise: quote.finalDoctorCommissionPaise } : {}),
        createdAt: now,
        updatedAt: now,
      };

      t.set(invoiceRef, record);

      // 5. Write doctor commission audit record if commission is tracked
      if (input.doctorId && (quote.originalDoctorCommissionPaise > 0 || quote.finalDoctorCommissionPaise > 0)) {
        const commissionRef = db.collection(COLLECTIONS.doctorCommissions(storeId)).doc(invoiceRef.id);
        const commissionRecord: DoctorCommissionRecord = {
          id: invoiceRef.id,
          storeId,
          invoiceId: invoiceRef.id,
          invoiceNumber,
          doctorId: input.doctorId,
          ...(input.doctorName ? { doctorName: input.doctorName } : {}),
          commissionRateBps: quote.doctorCommissionBps || 0,
          commissionBasis: 'GROSS_TOTAL_BEFORE_DISCOUNT',
          originalGrossTotalPaise: quote.grossTotalPaise,
          originalDoctorCommissionPaise: quote.originalDoctorCommissionPaise,
          patientDiscountBps: input.overallDiscountBps || 0,
          totalPatientDiscountPaise: quote.totalDiscountPaise,
          discountAllocationMethod: quote.discountAllocationMethod,
          nominalStoreDiscountPaise: quote.nominalStoreDiscountPaise,
          nominalDoctorDiscountPaise: quote.nominalDoctorDiscountPaise,
          actualStoreDiscountPaise: quote.actualStoreDiscountPaise,
          actualDoctorDiscountPaise: quote.actualDoctorDiscountPaise,
          unallocatedDiscountPaise: quote.unallocatedDiscountPaise,
          finalDoctorCommissionPaise: quote.finalDoctorCommissionPaise,
          invoiceStatus: 'FINALIZED',
          createdAt: now,
          updatedAt: now,
        };
        t.set(commissionRef, commissionRecord);
      }

      return record;
    });

    // Step 3: Async increment doctor prescriptions count if linked
    if (input.doctorId) {
      try {
        const { DoctorService } = await import('./doctor.service');
        await DoctorService.incrementPrescriptionsCount(storeId, input.doctorId);
      } catch (err) {
        console.error('Failed to increment doctor prescription count:', err);
      }
    }

    // Step 4: Write immutable forensic audit log (ADR-012, Prompt 23)
    try {
      await AuditExplorerService.logEvent(storeId, {
        action: 'BILL_FINALIZED',
        actorUid: billerUid,
        summary: `Finalized bill ${invoiceRecord.invoiceNumber} for ₹${(invoiceRecord.grandTotalPaise / 100).toFixed(2)}`,
        entityType: 'INVOICE',
        entityId: invoiceRecord.id,
        payload: {
          invoiceNumber: invoiceRecord.invoiceNumber,
          customerName: invoiceRecord.customer?.name,
          customerPhone: invoiceRecord.customer?.phone,
          itemCount: invoiceRecord.items.length,
          grandTotalPaise: invoiceRecord.grandTotalPaise,
          paymentModes: invoiceRecord.paymentModes.map((p) => p.mode),
        },
      });
    } catch (auditErr) {
      console.error('Failed to write audit log:', auditErr);
    }

    return invoiceRecord;
  }
}
