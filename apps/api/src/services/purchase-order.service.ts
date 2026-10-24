import { getFirestore } from '../lib/firebase-admin';
import { COLLECTIONS } from '@pulseclinic/config';
import {
  PurchaseOrder,
  CreatePOInput,
  ReceiveGRNInput,
  POLineItem,
  BatchInventory,
  StockLedgerEntry,
  SupplierLedgerEntry,
  SupplierProfile,
  BatchStatuses,
  getBatchExpiryStatus,
} from '@pulseclinic/types';
import { SupplierService } from './supplier.service';
import { MedicineService } from './medicine.service';

export class PurchaseOrderService {
  private static getPOsCol(storeId: string) {
    const db = getFirestore();
    return db.collection(COLLECTIONS.purchaseOrders(storeId));
  }

  static async list(
    storeId: string,
    options: { status?: string; supplierId?: string; limit?: number; cursor?: string } = {}
  ): Promise<{ purchaseOrders: PurchaseOrder[]; nextCursor?: string }> {
    const colRef = this.getPOsCol(storeId);
    const limitCount = Math.min(options.limit || 50, 100);

    let query: FirebaseFirestore.Query = colRef;

    if (options.status && options.status !== 'ALL') {
      query = query.where('status', '==', options.status);
    }

    if (options.supplierId) {
      query = query.where('supplierId', '==', options.supplierId);
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
      ...(doc.data() as Omit<PurchaseOrder, 'id'>),
    }));

    let nextCursor: string | undefined = undefined;
    if (docs.length > limitCount) {
      const nextDoc = docs[limitCount - 1];
      nextCursor = nextDoc.id;
      docs = docs.slice(0, limitCount);
    }

    return { purchaseOrders: docs, nextCursor };
  }

  static async getById(storeId: string, id: string): Promise<PurchaseOrder | null> {
    const docRef = this.getPOsCol(storeId).doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return null;
    return { id: snap.id, ...(snap.data() as Omit<PurchaseOrder, 'id'>) };
  }

  /**
   * Generates a sequential store PO serial number (PO-YYYYMM-XXXX)
   */
  private static async allocatePONumber(_storeId: string): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `PO-${yearMonth}-${randomSuffix}`;
  }

  /**
   * Creates a new purchase order
   */
  static async createPO(
    storeId: string,
    input: CreatePOInput,
    userId: string,
    userName?: string
  ): Promise<PurchaseOrder> {
    const supplier = await SupplierService.getById(storeId, input.supplierId);
    if (!supplier) throw new Error('SUPPLIER_NOT_FOUND');

    const poNumber = await this.allocatePONumber(storeId);
    const now = new Date().toISOString();
    const poDocRef = this.getPOsCol(storeId).doc();

    let totalAmountPaise = 0;
    const lineItems: POLineItem[] = [];

    for (const item of input.lineItems) {
      const med = await MedicineService.getById(storeId, item.medicineId);
      const totalCost = item.quantityPacks * item.unitCostPaise;
      totalAmountPaise += totalCost;

      lineItems.push({
        medicineId: item.medicineId,
        medicineBrandName: med?.brandName || 'Formulation',
        medicineGenericName: med?.genericName || '',
        strength: med?.strength,
        dosageForm: med?.dosageForm,
        stripSize: med?.stripSize || 10,
        quantityPacks: item.quantityPacks,
        unitCostPaise: item.unitCostPaise,
        totalCostPaise: totalCost,
      });
    }

    const newPO: PurchaseOrder = {
      id: poDocRef.id,
      storeId,
      poNumber,
      supplierId: supplier.id,
      supplierName: supplier.name,
      status: 'ISSUED',
      lineItems,
      totalAmountPaise,
      notes: input.notes,
      issuedAt: now,
      createdBy: userId,
      createdByName: userName || 'Pharmacist',
      createdAt: now,
      updatedAt: now,
    };

    await poDocRef.set(newPO);
    return newPO;
  }

  /**
   * Atomically receives a Goods Received Note (GRN):
   * 1. Creates inventory batches for each delivered drug batch.
   * 2. Credits base stock units in batches and stock movement ledger.
   * 3. Increases outstanding supplier balance.
   * 4. Logs purchase entry in supplier payment ledger.
   * 5. Marks PO status as 'RECEIVED'.
   */
  static async receiveGRN(
    storeId: string,
    input: ReceiveGRNInput,
    userId: string,
    userName?: string
  ): Promise<{ po: PurchaseOrder; batchesCreatedCount: number; invoiceTotalPaise: number }> {
    const db = getFirestore();
    const poDocRef = this.getPOsCol(storeId).doc(input.poId);
    const now = new Date().toISOString();

    let totalInvoicePaise = 0;
    let finalPO!: PurchaseOrder;
    let batchesCount = 0;

    await db.runTransaction(async (transaction) => {
      const poSnap = await transaction.get(poDocRef);
      if (!poSnap.exists) {
        throw new Error('PO_NOT_FOUND');
      }

      const po = poSnap.data() as PurchaseOrder;
      if (po.status === 'RECEIVED') {
        throw new Error('PO_ALREADY_RECEIVED');
      }
      if (po.status === 'CANCELLED') {
        throw new Error('PO_IS_CANCELLED');
      }

      const supplierDocRef = db.collection(COLLECTIONS.suppliers(storeId)).doc(po.supplierId);
      const supplierSnap = await transaction.get(supplierDocRef);
      if (!supplierSnap.exists) {
        throw new Error('SUPPLIER_NOT_FOUND');
      }
      const supplier = supplierSnap.data() as SupplierProfile;

      // 1. Process Batches & Stock Ledger
      for (const b of input.batches) {
        const batchTotalCost = b.quantityPacks * b.purchaseRatePaise;
        totalInvoicePaise += batchTotalCost;
        const totalBaseUnits = b.quantityPacks * b.stripSize;

        const isExpired = getBatchExpiryStatus(b.expiryDate) === 'EXPIRED';

        const batchDocRef = db.collection(COLLECTIONS.batches(storeId)).doc();
        const batchData: BatchInventory = {
          id: batchDocRef.id,
          storeId,
          medicineId: b.medicineId,
          batchNumber: b.batchNumber.trim().toUpperCase(),
          expiryDate: b.expiryDate,
          mrpPaise: b.mrpPaise,
          costPricePaise: b.purchaseRatePaise,
          stockUnits: totalBaseUnits,
          status: isExpired ? BatchStatuses.EXPIRED : BatchStatuses.ACTIVE,
          supplierId: po.supplierId,
          supplierName: po.supplierName,
          rackLocation: b.rackLocation,
          createdAt: now,
          updatedAt: now,
        };
        transaction.set(batchDocRef, batchData);

        const stockLedgerDocRef = db.collection(COLLECTIONS.stockLedger(storeId)).doc();
        const stockLedgerData: StockLedgerEntry = {
          id: stockLedgerDocRef.id,
          storeId,
          batchId: batchDocRef.id,
          medicineId: b.medicineId,
          batchNumber: batchData.batchNumber,
          movementType: 'PURCHASE_RECEIPT',
          changeUnits: totalBaseUnits,
          balanceUnitsBefore: 0,
          balanceUnitsAfter: totalBaseUnits,
          reason: `GRN Receipt (PO: ${po.poNumber}, Inv: ${input.supplierInvoiceNumber})`,
          referenceId: po.id,
          performedBy: userId,
          performedByName: userName || 'Pharmacist',
          createdAt: now,
        };
        transaction.set(stockLedgerDocRef, stockLedgerData);
        batchesCount++;
      }

      // 2. Update Supplier Balance & Ledger
      const beforeSupplierBalance = supplier.currentBalancePaise || 0;
      const afterSupplierBalance = beforeSupplierBalance + totalInvoicePaise;

      transaction.update(supplierDocRef, {
        currentBalancePaise: afterSupplierBalance,
        updatedAt: now,
      });

      const supplierLedgerDocRef = db.collection(COLLECTIONS.supplierLedger(storeId)).doc();
      const supplierLedgerEntry: SupplierLedgerEntry = {
        id: supplierLedgerDocRef.id,
        storeId,
        supplierId: supplier.id,
        supplierName: supplier.name,
        entryType: 'INVOICE_PURCHASE',
        amountPaise: totalInvoicePaise,
        balanceAfterPaise: afterSupplierBalance,
        referenceType: 'GRN',
        referenceId: po.id,
        referenceNumber: input.supplierInvoiceNumber.trim(),
        notes: `GRN for PO ${po.poNumber}`,
        performedBy: userId,
        performedByName: userName || 'Pharmacist',
        createdAt: now,
      };
      transaction.set(supplierLedgerDocRef, supplierLedgerEntry);

      // 3. Update PO to RECEIVED
      finalPO = {
        ...po,
        id: poSnap.id,
        status: 'RECEIVED',
        supplierInvoiceNumber: input.supplierInvoiceNumber.trim(),
        supplierInvoiceDate: input.supplierInvoiceDate,
        receivedAt: now,
        updatedAt: now,
      };

      transaction.update(poDocRef, {
        status: 'RECEIVED',
        supplierInvoiceNumber: input.supplierInvoiceNumber.trim(),
        supplierInvoiceDate: input.supplierInvoiceDate,
        receivedAt: now,
        updatedAt: now,
      });
    });

    return {
      po: finalPO,
      batchesCreatedCount: batchesCount,
      invoiceTotalPaise: totalInvoicePaise,
    };
  }
}
