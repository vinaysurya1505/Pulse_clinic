import { getFirestore } from '../lib/firebase-admin';
import { COLLECTIONS } from '@pulseclinic/config';
import {
  calculateBillingQuote,
  BillingQuoteResult,
  BillingLineItemInput,
  MedicineMaster,
  BatchInventory,
  calculateUnitPrice,
  validateLooseSale,
  DiscountAllocationMethod,
  DoctorProfile,
} from '@pulseclinic/types';

export interface AuthoritativeQuoteRequest {
  items: Array<{
    medicineId: string;
    batchId: string;
    quantityUnits: number;
    discountBps?: number;
    customGstRateBps?: number;
  }>;
  overallDiscountBps?: number;
  customerStateCode?: string;
  doctorId?: string;
  discountAllocationMethod?: DiscountAllocationMethod;
  enableDoctorCommission?: boolean;
  doctorCommissionBps?: number;
  roundOffToRupee?: boolean;
}

export class BillingCalculationEngine {
  /**
   * Server-authoritative quote calculation (ADR-007, Section 3, 5, 6)
   * Fetches batch and medicine records directly from Firestore to ensure
   * zero trust in client-supplied prices, stock or tax rates.
   */
  static async calculateQuote(
    storeId: string,
    request: AuthoritativeQuoteRequest
  ): Promise<BillingQuoteResult> {
    const db = getFirestore();
    const medicinesCol = db.collection(COLLECTIONS.medicines(storeId));
    const batchesCol = db.collection(COLLECTIONS.batches(storeId));

    // Also get store details for state code
    const storeDoc = await db.collection(COLLECTIONS.stores).doc(storeId).get();
    const storeData = storeDoc.data();
    const storeStateCode = storeData?.address?.stateCode || '29';

    // Retrieve doctor commission configuration authoritatively from DB if doctorId is present
    let enableDoctorCommission = Boolean(request.enableDoctorCommission);
    let doctorCommissionBps = request.doctorCommissionBps || 0;

    if (request.doctorId) {
      const docSnap = await db.collection(COLLECTIONS.doctors(storeId)).doc(request.doctorId).get();
      if (docSnap.exists) {
        const docData = docSnap.data() as DoctorProfile;
        if (docData.isActive !== false && docData.commissionEnabled === true) {
          enableDoctorCommission = true;
          doctorCommissionBps = docData.commissionBps || 0;
        } else {
          enableDoctorCommission = false;
          doctorCommissionBps = 0;
        }
      } else {
        enableDoctorCommission = false;
        doctorCommissionBps = 0;
      }
    }

    // Validation: If discount > 0 and allocation is DOCTOR or BOTH, require a commission-enabled doctor
    const allocationMethod: DiscountAllocationMethod = request.discountAllocationMethod || 'STORE';
    const totalDiscountBps = Math.max(0, request.overallDiscountBps || 0);
    if (totalDiscountBps > 0 && (allocationMethod === 'DOCTOR' || allocationMethod === 'BOTH')) {
      if (!enableDoctorCommission || doctorCommissionBps <= 0) {
        throw new Error(
          `Cannot allocate discount to doctor commission: No doctor with active commission tracking is selected. Please select 'Store' allocation.`
        );
      }
    }

    const verifiedLineItems: BillingLineItemInput[] = [];

    for (const reqItem of request.items) {
      if (reqItem.quantityUnits <= 0) {
        throw new Error(`Quantity must be greater than 0 for item ${reqItem.medicineId}`);
      }

      const [medDoc, batchDoc] = await Promise.all([
        medicinesCol.doc(reqItem.medicineId).get(),
        batchesCol.doc(reqItem.batchId).get(),
      ]);

      if (!medDoc.exists) {
        throw new Error(`Medicine ${reqItem.medicineId} not found in store catalogue`);
      }
      if (!batchDoc.exists) {
        throw new Error(`Batch ${reqItem.batchId} not found in inventory`);
      }

      const medicine = medDoc.data() as MedicineMaster;
      const batch = batchDoc.data() as BatchInventory;

      // Safety check: Batch must belong to medicine
      if (batch.medicineId !== reqItem.medicineId) {
        throw new Error(`Batch ${batch.batchNumber} does not match medicine ${medicine.brandName}`);
      }

      // Check stock availability
      if (batch.stockUnits < reqItem.quantityUnits) {
        throw new Error(
          `Insufficient stock for ${medicine.brandName} (Batch ${batch.batchNumber}). Requested: ${reqItem.quantityUnits}, Available: ${batch.stockUnits}`
        );
      }

      // Validate loose sale policy
      const isLooseAllowed = validateLooseSale(
        reqItem.quantityUnits,
        medicine.stripSize || 1,
        medicine.allowLooseSales ?? true
      );
      if (!isLooseAllowed) {
        throw new Error(
          `Loose sales are not permitted for ${medicine.brandName}. Must purchase in full packs of ${medicine.stripSize} units.`
        );
      }

      // Authoritative unit price from batch MRP & strip size
      const unitPricePaise = calculateUnitPrice(batch.mrpPaise, medicine.stripSize || 1);
      // Section 6: Use configured medicine GST rate from backend catalogue (ignore client-supplied overrides)
      const gstRateBps = medicine.gstRateBps || 0;

      verifiedLineItems.push({
        medicineId: reqItem.medicineId,
        batchId: reqItem.batchId,
        medicineName: medicine.brandName,
        hsnCode: medicine.hsnCode,
        batchNumber: batch.batchNumber,
        expiryDate: batch.expiryDate,
        quantityUnits: reqItem.quantityUnits,
        unitPricePaise,
        gstRateBps,
        discountBps: reqItem.discountBps,
      });
    }

    // Execute pure calculation engine
    return calculateBillingQuote({
      items: verifiedLineItems,
      overallDiscountBps: request.overallDiscountBps,
      storeStateCode,
      customerStateCode: request.customerStateCode || storeStateCode,
      enableDoctorCommission,
      doctorCommissionBps,
      discountAllocationMethod: allocationMethod,
      roundOffToRupee: request.roundOffToRupee !== false,
    });
  }
}
