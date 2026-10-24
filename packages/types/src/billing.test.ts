import { calculateBillingQuote, BillingCalculationInput } from './billing';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('Running Versioned Billing Calculation Engine Tests (ADR-007, ADR-008, ADR-009, Prompt 11)...');

// Test 1: Simple Intra-state Sale (12% GST, 50/50 CGST & SGST)
// Paracetamol: 10 units @ ₹4.50 (450 paise) = ₹45.00 (4500 paise gross)
// GST 1200 bps -> CGST 600 bps = ₹2.70 (270 paise), SGST 600 bps = ₹2.70 (270 paise)
// Total tax = 540 paise, Grand Total = 5040 paise
const test1Input: BillingCalculationInput = {
  items: [
    {
      medicineId: 'med-1',
      batchId: 'batch-1',
      medicineName: 'Paracetamol 500mg',
      quantityUnits: 10,
      unitPricePaise: 450,
      gstRateBps: 1200,
    },
  ],
  storeStateCode: '29',
  customerStateCode: '29',
  roundOffToRupee: false,
};

const res1 = calculateBillingQuote(test1Input);
assert(res1.grossTotalPaise === 4500, 'Gross total must be 4500 paise');
assert(res1.taxableTotalPaise === 4500, 'Taxable total must be 4500 paise');
assert(res1.cgstTotalPaise === 270, 'CGST must be 270 paise (6%)');
assert(res1.sgstTotalPaise === 270, 'SGST must be 270 paise (6%)');
assert(res1.igstTotalPaise === 0, 'IGST must be 0 for intra-state sale');
assert(res1.taxTotalPaise === 540, 'Total tax must be 540 paise (12%)');
assert(res1.grandTotalPaise === 5040, 'Grand total must be 5040 paise');
assert(res1.isInterState === false, 'Sale must be detected as intra-state');

// Test 2: Inter-state Sale (18% GST allocated 100% to IGST)
// Store in Karnataka ('29'), Customer in Maharashtra ('27')
const test2Input: BillingCalculationInput = {
  items: [
    {
      medicineId: 'med-2',
      batchId: 'batch-2',
      medicineName: 'Amoxicillin 500mg',
      quantityUnits: 20,
      unitPricePaise: 1000, // ₹10.00 each = ₹200.00 (20000 paise)
      gstRateBps: 1800,
    },
  ],
  storeStateCode: '29',
  customerStateCode: '27',
  roundOffToRupee: false,
};

const res2 = calculateBillingQuote(test2Input);
assert(res2.isInterState === true, 'Sale must be detected as inter-state');
assert(res2.cgstTotalPaise === 0, 'CGST must be 0 for inter-state');
assert(res2.sgstTotalPaise === 0, 'SGST must be 0 for inter-state');
assert(res2.igstTotalPaise === 3600, 'IGST must be 3600 paise (18% of 20000)');
assert(res2.taxTotalPaise === 3600, 'Total tax must match IGST');
assert(res2.grandTotalPaise === 23600, 'Grand total must be 23600 paise');

// Test 3: Basis-point discount on line items (10% discount = 1000 bps)
// Item 1: 5 units @ ₹100.00 = ₹500.00 (50000 paise), 1000 bps discount = ₹50.00 (5000 paise)
// Taxable = 45000 paise. 5% GST (500 bps) -> CGST 2.5% (1125 paise), SGST 2.5% (1125 paise)
const test3Input: BillingCalculationInput = {
  items: [
    {
      medicineId: 'med-3',
      batchId: 'batch-3',
      quantityUnits: 5,
      unitPricePaise: 10000,
      gstRateBps: 500,
      discountBps: 1000, // 10%
    },
  ],
  storeStateCode: '29',
  customerStateCode: '29',
  roundOffToRupee: false,
};

const res3 = calculateBillingQuote(test3Input);
assert(res3.totalDiscountPaise === 5000, 'Discount must be 5000 paise (₹50.00)');
assert(res3.taxableTotalPaise === 45000, 'Taxable must be 45000 paise (₹450.00)');
assert(res3.cgstTotalPaise === 1125, 'CGST must be 1125 paise (2.5%)');
assert(res3.sgstTotalPaise === 1125, 'SGST must be 1125 paise (2.5%)');
assert(res3.grandTotalPaise === 47250, 'Grand total must be 47250 paise');

// Test 4: Multi-item Cart with Diverse GST Slabs (0%, 5%, 12%, 18%)
const test4Input: BillingCalculationInput = {
  items: [
    {
      medicineId: 'm-zero',
      batchId: 'b-zero',
      quantityUnits: 1,
      unitPricePaise: 1000,
      gstRateBps: 0,
    },
    {
      medicineId: 'm-five',
      batchId: 'b-five',
      quantityUnits: 2,
      unitPricePaise: 2500, // 5000 paise
      gstRateBps: 500,
    },
    {
      medicineId: 'm-twelve',
      batchId: 'b-twelve',
      quantityUnits: 1,
      unitPricePaise: 10000, // 10000 paise
      gstRateBps: 1200,
    },
    {
      medicineId: 'm-eighteen',
      batchId: 'b-eighteen',
      quantityUnits: 1,
      unitPricePaise: 20000, // 20000 paise
      gstRateBps: 1800,
    },
  ],
  storeStateCode: '29',
  customerStateCode: '29',
  roundOffToRupee: true,
};

const res4 = calculateBillingQuote(test4Input);
assert(res4.grossTotalPaise === 36000, 'Gross total must be 36000 paise');
assert(res4.taxSlabs.length === 4, 'Must have 4 separate tax slab breakdowns');

// Verify 0% slab
const slab0 = res4.taxSlabs.find((s) => s.gstRateBps === 0);
assert(slab0 !== undefined && slab0.taxablePaise === 1000 && slab0.totalTaxPaise === 0, '0% slab correct');

// Verify 5% slab: 5000 paise -> 250 paise tax (125 CGST + 125 SGST)
const slab5 = res4.taxSlabs.find((s) => s.gstRateBps === 500);
assert(slab5 !== undefined && slab5.taxablePaise === 5000 && slab5.totalTaxPaise === 250, '5% slab correct');

// Verify 12% slab: 10000 paise -> 1200 paise tax (600 CGST + 600 SGST)
const slab12 = res4.taxSlabs.find((s) => s.gstRateBps === 1200);
assert(slab12 !== undefined && slab12.taxablePaise === 10000 && slab12.totalTaxPaise === 1200, '12% slab correct');

// Verify 18% slab: 20000 paise -> 3600 paise tax (1800 CGST + 1800 SGST)
const slab18 = res4.taxSlabs.find((s) => s.gstRateBps === 1800);
assert(slab18 !== undefined && slab18.taxablePaise === 20000 && slab18.totalTaxPaise === 3600, '18% slab correct');

// Total tax = 0 + 250 + 1200 + 3600 = 5050 paise
assert(res4.taxTotalPaise === 5050, 'Total tax must be 5050 paise');
// Grand total = 36000 + 5050 = 41050 paise (₹410.50)
assert(res4.grandTotalPaise === 41050, 'Grand total must be 41050 paise');
// Net payable with roundOffToRupee = ₹411.00 (41100 paise), roundOff = +50 paise
assert(res4.netPayablePaise === 41100, 'Net payable must round to 41100 paise');
assert(res4.roundOffPaise === 50, 'Round off adjustment must be +50 paise');

// Test 5: Doctor Commission Governance (DEC-OPEN-02)
// Disabled by default: commission must be 0
const docDisabledRes = calculateBillingQuote({
  items: test1Input.items,
  enableDoctorCommission: false,
  doctorCommissionBps: 500,
});
assert(docDisabledRes.doctorCommissionPaise === 0, 'Doctor commission must be 0 when disabled by default');

// Enabled: 500 bps (5%) on taxable 4500 paise = 225 paise
const docEnabledRes = calculateBillingQuote({
  items: test1Input.items,
  enableDoctorCommission: true,
  doctorCommissionBps: 500,
});
assert(docEnabledRes.doctorCommissionPaise === 225, 'Doctor commission must be 225 paise when enabled');

// Test 6: Zero Floating-Point Drift on Odd Decimal Fractions
// 3 units @ 333 paise (₹3.33) = 999 paise. 12% GST (1200 bps)
// CGST 6% of 999 = round(999 * 600 / 10000) = round(59.94) = 60 paise
// SGST 6% of 999 = round(999 * 600 / 10000) = round(59.94) = 60 paise
// Total tax = 120 paise. Grand total = 999 + 120 = 1119 paise.
const res6 = calculateBillingQuote({
  items: [
    {
      medicineId: 'med-odd',
      batchId: 'b-odd',
      quantityUnits: 3,
      unitPricePaise: 333,
      gstRateBps: 1200,
    },
  ],
  roundOffToRupee: false,
});
assert(res6.grossTotalPaise === 999, 'Gross total must be exactly 999 paise');
assert(res6.cgstTotalPaise === 60, 'CGST must be exact 60 paise');
assert(res6.sgstTotalPaise === 60, 'SGST must be exact 60 paise');
assert(res6.grandTotalPaise === 1119, 'Grand total must be exact 1119 paise');

console.log('All 6 Billing Calculation Engine tests passed with 100% precision!');
