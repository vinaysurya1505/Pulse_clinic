export declare const CURRENT_CALCULATION_VERSION = 1;
export type PaymentMode = 'CASH' | 'UPI' | 'CARD';
export type InvoiceStatus = 'FINALIZED' | 'CANCELLED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
export interface PaymentEntry {
    mode: PaymentMode;
    amountPaise: number;
    reference?: string;
}
export interface BillingLineItemInput {
    medicineId: string;
    batchId: string;
    medicineName?: string;
    hsnCode?: string;
    batchNumber?: string;
    expiryDate?: string;
    quantityUnits: number;
    unitPricePaise: number;
    gstRateBps: number;
    discountBps?: number;
}
export interface CalculatedLineItem {
    medicineId: string;
    batchId: string;
    medicineName: string;
    hsnCode?: string;
    batchNumber?: string;
    expiryDate?: string;
    quantityUnits: number;
    unitPricePaise: number;
    grossLinePaise: number;
    discountBps: number;
    discountPaise: number;
    taxablePaise: number;
    gstRateBps: number;
    cgstRateBps: number;
    sgstRateBps: number;
    igstRateBps: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    lineTaxPaise: number;
    lineTotalPaise: number;
}
export interface GstTaxSlabBreakdown {
    gstRateBps: number;
    taxablePaise: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    totalTaxPaise: number;
}
export type DiscountAllocationMethod = 'STORE' | 'DOCTOR' | 'BOTH';
export interface BillingCalculationInput {
    calculationVersion?: number;
    items: BillingLineItemInput[];
    overallDiscountBps?: number;
    storeStateCode?: string;
    customerStateCode?: string;
    enableDoctorCommission?: boolean;
    doctorCommissionBps?: number;
    discountAllocationMethod?: DiscountAllocationMethod;
    roundOffToRupee?: boolean;
}
export interface BillingQuoteResult {
    calculationVersion: number;
    items: CalculatedLineItem[];
    grossTotalPaise: number;
    totalDiscountPaise: number;
    taxableTotalPaise: number;
    cgstTotalPaise: number;
    sgstTotalPaise: number;
    igstTotalPaise: number;
    taxTotalPaise: number;
    grandTotalPaise: number;
    roundOffPaise: number;
    netPayablePaise: number;
    taxSlabs: GstTaxSlabBreakdown[];
    doctorCommissionBps?: number;
    originalDoctorCommissionPaise: number;
    discountAllocationMethod: DiscountAllocationMethod;
    nominalStoreDiscountPaise: number;
    nominalDoctorDiscountPaise: number;
    actualStoreDiscountPaise: number;
    actualDoctorDiscountPaise: number;
    unallocatedDiscountPaise: number;
    finalDoctorCommissionPaise: number;
    doctorCommissionPaise: number;
    isInterState: boolean;
}
/**
 * Version 1 Billing Calculation Engine (Prompt 11, ADR-007, ADR-008, ADR-009)
 * Pure integer paise arithmetic with zero floating point drift.
 */
export declare function calculateBillingQuote(input: BillingCalculationInput): BillingQuoteResult;
export interface InvoiceRecord {
    id: string;
    storeId: string;
    invoiceNumber: string;
    status: InvoiceStatus;
    calculationVersion: number;
    items: CalculatedLineItem[];
    grossTotalPaise: number;
    totalDiscountPaise: number;
    taxableTotalPaise: number;
    cgstTotalPaise: number;
    sgstTotalPaise: number;
    igstTotalPaise: number;
    taxTotalPaise: number;
    grandTotalPaise: number;
    roundOffPaise: number;
    netPayablePaise: number;
    paymentModes: PaymentEntry[];
    customer?: {
        name?: string;
        phone?: string;
        stateCode?: string;
    };
    doctorId?: string;
    doctorName?: string;
    prescriptionNumber?: string;
    hasScheduleH: boolean;
    billerUid: string;
    idempotencyKey?: string;
    doctorCommissionBps?: number;
    originalDoctorCommissionPaise?: number;
    discountAllocationMethod?: DiscountAllocationMethod;
    nominalStoreDiscountPaise?: number;
    nominalDoctorDiscountPaise?: number;
    actualStoreDiscountPaise?: number;
    actualDoctorDiscountPaise?: number;
    unallocatedDiscountPaise?: number;
    finalDoctorCommissionPaise?: number;
    createdAt: string;
    updatedAt: string;
}
export interface DoctorCommissionRecord {
    id: string;
    storeId: string;
    invoiceId: string;
    invoiceNumber: string;
    doctorId: string;
    doctorName?: string;
    commissionRateBps: number;
    commissionBasis: 'GROSS_TOTAL_BEFORE_DISCOUNT';
    originalGrossTotalPaise: number;
    originalDoctorCommissionPaise: number;
    patientDiscountBps: number;
    totalPatientDiscountPaise: number;
    discountAllocationMethod: DiscountAllocationMethod;
    nominalStoreDiscountPaise: number;
    nominalDoctorDiscountPaise: number;
    actualStoreDiscountPaise: number;
    actualDoctorDiscountPaise: number;
    unallocatedDiscountPaise: number;
    finalDoctorCommissionPaise: number;
    invoiceStatus: InvoiceStatus;
    createdAt: string;
    updatedAt: string;
}
//# sourceMappingURL=billing.d.ts.map