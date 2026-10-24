export const CURRENT_CALCULATION_VERSION = 1;

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
  quantityUnits: number; // In base units
  unitPricePaise: number; // Price per base unit in integer paise
  gstRateBps: number; // e.g. 0, 500, 1200, 1800, 2800
  discountBps?: number; // e.g. 500 = 5.00%
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

export interface BillingCalculationInput {
  calculationVersion?: number;
  items: BillingLineItemInput[];
  overallDiscountBps?: number; // e.g. 500 = 5.00%
  storeStateCode?: string; // Default '29' (Karnataka)
  customerStateCode?: string;
  enableDoctorCommission?: boolean; // Configurable toggle per DEC-OPEN-02
  doctorCommissionBps?: number;
  roundOffToRupee?: boolean; // Default true
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
  roundOffPaise: number; // Difference applied to reach netPayablePaise
  netPayablePaise: number;
  taxSlabs: GstTaxSlabBreakdown[];
  doctorCommissionPaise: number;
  isInterState: boolean;
}

/**
 * Version 1 Billing Calculation Engine (Prompt 11, ADR-007, ADR-008, ADR-009)
 * Pure integer paise arithmetic with zero floating point drift.
 */
export function calculateBillingQuote(input: BillingCalculationInput): BillingQuoteResult {
  const version = input.calculationVersion || CURRENT_CALCULATION_VERSION;
  const storeState = (input.storeStateCode || '29').trim();
  const customerState = (input.customerStateCode || storeState).trim();
  const isInterState = customerState !== storeState;

  const defaultOverallDiscount = Math.max(0, input.overallDiscountBps || 0);

  const calculatedItems: CalculatedLineItem[] = [];
  const taxSlabMap = new Map<number, GstTaxSlabBreakdown>();

  let grossTotalPaise = 0;
  let totalDiscountPaise = 0;
  let taxableTotalPaise = 0;
  let cgstTotalPaise = 0;
  let sgstTotalPaise = 0;
  let igstTotalPaise = 0;

  for (const item of input.items) {
    const qty = Math.max(0, Math.floor(item.quantityUnits));
    const unitPrice = Math.max(0, Math.floor(item.unitPricePaise));
    const grossLinePaise = unitPrice * qty;

    const discountBps = item.discountBps !== undefined ? Math.max(0, item.discountBps) : defaultOverallDiscount;
    const discountPaise = Math.round((grossLinePaise * discountBps) / 10000);
    const taxablePaise = Math.max(0, grossLinePaise - discountPaise);

    const gstRateBps = Math.max(0, Math.floor(item.gstRateBps));
    let cgstRateBps = 0;
    let sgstRateBps = 0;
    let igstRateBps = 0;
    let cgstPaise = 0;
    let sgstPaise = 0;
    let igstPaise = 0;

    if (isInterState) {
      igstRateBps = gstRateBps;
      igstPaise = Math.round((taxablePaise * igstRateBps) / 10000);
    } else {
      cgstRateBps = Math.floor(gstRateBps / 2);
      sgstRateBps = gstRateBps - cgstRateBps;
      cgstPaise = Math.round((taxablePaise * cgstRateBps) / 10000);
      sgstPaise = Math.round((taxablePaise * sgstRateBps) / 10000);
    }

    const lineTaxPaise = cgstPaise + sgstPaise + igstPaise;
    const lineTotalPaise = taxablePaise + lineTaxPaise;

    grossTotalPaise += grossLinePaise;
    totalDiscountPaise += discountPaise;
    taxableTotalPaise += taxablePaise;
    cgstTotalPaise += cgstPaise;
    sgstTotalPaise += sgstPaise;
    igstTotalPaise += igstPaise;

    // Accumulate in tax slab breakdown
    if (!taxSlabMap.has(gstRateBps)) {
      taxSlabMap.set(gstRateBps, {
        gstRateBps,
        taxablePaise: 0,
        cgstPaise: 0,
        sgstPaise: 0,
        igstPaise: 0,
        totalTaxPaise: 0,
      });
    }
    const slab = taxSlabMap.get(gstRateBps)!;
    slab.taxablePaise += taxablePaise;
    slab.cgstPaise += cgstPaise;
    slab.sgstPaise += sgstPaise;
    slab.igstPaise += igstPaise;
    slab.totalTaxPaise += lineTaxPaise;

    calculatedItems.push({
      medicineId: item.medicineId,
      batchId: item.batchId,
      medicineName: item.medicineName || 'Medicine',
      hsnCode: item.hsnCode,
      batchNumber: item.batchNumber,
      expiryDate: item.expiryDate,
      quantityUnits: qty,
      unitPricePaise: unitPrice,
      grossLinePaise,
      discountBps,
      discountPaise,
      taxablePaise,
      gstRateBps,
      cgstRateBps,
      sgstRateBps,
      igstRateBps,
      cgstPaise,
      sgstPaise,
      igstPaise,
      lineTaxPaise,
      lineTotalPaise,
    });
  }

  const taxTotalPaise = cgstTotalPaise + sgstTotalPaise + igstTotalPaise;
  const grandTotalPaise = taxableTotalPaise + taxTotalPaise;

  // Round-off to nearest rupee (standard Indian retail billing practice)
  let netPayablePaise = grandTotalPaise;
  let roundOffPaise = 0;
  if (input.roundOffToRupee !== false) {
    netPayablePaise = Math.round(grandTotalPaise / 100) * 100;
    roundOffPaise = netPayablePaise - grandTotalPaise;
  }

  // Doctor commission (DEC-OPEN-02): Configurable toggle, default false
  let doctorCommissionPaise = 0;
  if (input.enableDoctorCommission && input.doctorCommissionBps && input.doctorCommissionBps > 0) {
    doctorCommissionPaise = Math.round((taxableTotalPaise * input.doctorCommissionBps) / 10000);
  }

  const taxSlabs = Array.from(taxSlabMap.values()).sort((a, b) => a.gstRateBps - b.gstRateBps);

  return {
    calculationVersion: version,
    items: calculatedItems,
    grossTotalPaise,
    totalDiscountPaise,
    taxableTotalPaise,
    cgstTotalPaise,
    sgstTotalPaise,
    igstTotalPaise,
    taxTotalPaise,
    grandTotalPaise,
    roundOffPaise,
    netPayablePaise,
    taxSlabs,
    doctorCommissionPaise,
    isInterState,
  };
}

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
  createdAt: string;
  updatedAt: string;
}

