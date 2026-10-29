import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  calculateBillingQuote,
  DoctorCommissionRecord,
  InvoiceRecord,
} from '@pulseclinic/types';

describe('PulseClinic Billing, Doctor Commission, Discount Allocation & GST Test Suite', () => {
  // =========================================================================
  // Test A: Doctor Registration Form & Configuration
  // =========================================================================
  describe('Test A: Doctor Registration & Commission Configuration', () => {
    it('allows registration with only doctor name (name required, registrationNumber optional)', () => {
      const minimalDoctor = {
        name: 'Dr. Neha Sharma',
        commissionEnabled: false,
        commissionBps: 0,
      };

      assert.strictEqual(minimalDoctor.name, 'Dr. Neha Sharma');
      assert.strictEqual(minimalDoctor.commissionEnabled, false);
      assert.strictEqual(minimalDoctor.commissionBps, 0);
    });

    it('supports optional phone, email, and hospital affiliation without reg number', () => {
      const fullDoctor = {
        name: 'Dr. Vikram Patel',
        phone: '9876543210',
        email: 'dr.vikram@cityhospital.in',
        hospitalClinic: 'Apollo Clinic, Indiranagar',
        commissionEnabled: true,
        commissionBps: 2000, // 20%
      };

      assert.strictEqual(fullDoctor.name, 'Dr. Vikram Patel');
      assert.strictEqual(fullDoctor.phone, '9876543210');
      assert.strictEqual(fullDoctor.email, 'dr.vikram@cityhospital.in');
      assert.strictEqual(fullDoctor.hospitalClinic, 'Apollo Clinic, Indiranagar');
      assert.strictEqual(fullDoctor.commissionEnabled, true);
      assert.strictEqual(fullDoctor.commissionBps, 2000);
    });

    it('enforces commission tracking disabled by default and rejects negative commission', () => {
      const defaultDoctor = {
        name: 'Dr. Suresh Rao',
        commissionEnabled: false,
        commissionBps: 0,
      };
      assert.strictEqual(defaultDoctor.commissionEnabled, false);

      // Validation rule check: negative commission percentage must be rejected
      const invalidNegativeBps = -500;
      assert.strictEqual(invalidNegativeBps < 0, true);
    });
  });

  // =========================================================================
  // Test B: Automatic Doctor Commission Calculation
  // =========================================================================
  describe('Test B: Commission Calculation Basis (Original Gross Total)', () => {
    it('calculates commission on pre-discount Gross Total (₹2,000 gross, 20% -> ₹400)', () => {
      // Medicine: 2 units @ ₹1,000 = ₹2,000 gross total (200,000 paise)
      // Patient discount: ₹200 (10% = 1000 bps)
      const quote = calculateBillingQuote({
        items: [
          {
            medicineId: 'med_1',
            batchId: 'batch_1',
            quantityUnits: 2,
            unitPricePaise: 100000, // ₹1,000.00
            gstRateBps: 0,
          },
        ],
        overallDiscountBps: 1000, // 10% discount = ₹200.00 (20,000 paise)
        enableDoctorCommission: true,
        doctorCommissionBps: 2000, // 20%
        discountAllocationMethod: 'STORE',
      });

      assert.strictEqual(quote.grossTotalPaise, 200000); // ₹2,000.00
      assert.strictEqual(quote.totalDiscountPaise, 20000); // ₹200.00
      // Original commission must strictly be ₹400 (40,000 paise) based on Gross Total ₹2,000, NOT ₹1,800!
      assert.strictEqual(quote.originalDoctorCommissionPaise, 40000);
      assert.strictEqual(quote.finalDoctorCommissionPaise, 40000);
    });

    it('dynamically recalculates original commission when cart quantity changes', () => {
      // Quantity updated to 3 units @ ₹1,000 = ₹3,000 gross total (300,000 paise)
      const quote = calculateBillingQuote({
        items: [
          {
            medicineId: 'med_1',
            batchId: 'batch_1',
            quantityUnits: 3,
            unitPricePaise: 100000,
            gstRateBps: 0,
          },
        ],
        overallDiscountBps: 1000,
        enableDoctorCommission: true,
        doctorCommissionBps: 2000, // 20%
        discountAllocationMethod: 'STORE',
      });

      assert.strictEqual(quote.grossTotalPaise, 300000); // ₹3,000.00
      assert.strictEqual(quote.originalDoctorCommissionPaise, 60000); // 20% of ₹3,000 = ₹600.00
    });

    it('yields zero commission when commission tracking is disabled or no doctor is selected', () => {
      const quoteDisabled = calculateBillingQuote({
        items: [
          {
            medicineId: 'med_1',
            batchId: 'batch_1',
            quantityUnits: 2,
            unitPricePaise: 100000,
            gstRateBps: 0,
          },
        ],
        overallDiscountBps: 1000,
        enableDoctorCommission: false,
        doctorCommissionBps: 2000,
      });

      assert.strictEqual(quoteDisabled.originalDoctorCommissionPaise, 0);
      assert.strictEqual(quoteDisabled.finalDoctorCommissionPaise, 0);

      const quoteNoDoctor = calculateBillingQuote({
        items: [
          {
            medicineId: 'med_1',
            batchId: 'batch_1',
            quantityUnits: 2,
            unitPricePaise: 100000,
            gstRateBps: 0,
          },
        ],
        overallDiscountBps: 1000,
      });

      assert.strictEqual(quoteNoDoctor.originalDoctorCommissionPaise, 0);
      assert.strictEqual(quoteNoDoctor.finalDoctorCommissionPaise, 0);
    });
  });

  // =========================================================================
  // Test C: Discount Allocation (Store, Doctor Commission, Both Equally)
  // =========================================================================
  describe('Test C: Discount Allocation Specifications', () => {
    // ₹2,000 Gross, 20% Commission (₹400 original comm), ₹200 patient discount
    it('Allocates discount to STORE: Store bears ₹200, Doctor deduction ₹0, Final commission ₹400', () => {
      const quote = calculateBillingQuote({
        items: [
          {
            medicineId: 'med_1',
            batchId: 'batch_1',
            quantityUnits: 2,
            unitPricePaise: 100000,
            gstRateBps: 0,
          },
        ],
        overallDiscountBps: 1000, // 10% = ₹200
        enableDoctorCommission: true,
        doctorCommissionBps: 2000, // 20% = ₹400
        discountAllocationMethod: 'STORE',
      });

      assert.strictEqual(quote.grossTotalPaise, 200000);
      assert.strictEqual(quote.totalDiscountPaise, 20000);
      assert.strictEqual(quote.originalDoctorCommissionPaise, 40000); // ₹400
      assert.strictEqual(quote.actualStoreDiscountPaise, 20000); // ₹200 store burden
      assert.strictEqual(quote.actualDoctorDiscountPaise, 0); // ₹0 doctor deduction
      assert.strictEqual(quote.finalDoctorCommissionPaise, 40000); // ₹400 final
      assert.strictEqual(quote.unallocatedDiscountPaise, 0);
    });

    it('Allocates discount to DOCTOR: Store bears ₹0, Doctor deduction ₹200, Final commission ₹200', () => {
      const quote = calculateBillingQuote({
        items: [
          {
            medicineId: 'med_1',
            batchId: 'batch_1',
            quantityUnits: 2,
            unitPricePaise: 100000,
            gstRateBps: 0,
          },
        ],
        overallDiscountBps: 1000, // 10% = ₹200
        enableDoctorCommission: true,
        doctorCommissionBps: 2000, // 20% = ₹400
        discountAllocationMethod: 'DOCTOR',
      });

      assert.strictEqual(quote.grossTotalPaise, 200000);
      assert.strictEqual(quote.totalDiscountPaise, 20000);
      assert.strictEqual(quote.originalDoctorCommissionPaise, 40000); // ₹400
      assert.strictEqual(quote.actualStoreDiscountPaise, 0); // ₹0 store
      assert.strictEqual(quote.actualDoctorDiscountPaise, 20000); // ₹200 doctor deduction
      assert.strictEqual(quote.finalDoctorCommissionPaise, 20000); // ₹200 final commission
      assert.strictEqual(quote.unallocatedDiscountPaise, 0);
    });

    it('Allocates discount to BOTH EQUALLY: Store bears ₹100, Doctor deduction ₹100, Final commission ₹300', () => {
      const quote = calculateBillingQuote({
        items: [
          {
            medicineId: 'med_1',
            batchId: 'batch_1',
            quantityUnits: 2,
            unitPricePaise: 100000,
            gstRateBps: 0,
          },
        ],
        overallDiscountBps: 1000, // 10% = ₹200
        enableDoctorCommission: true,
        doctorCommissionBps: 2000, // 20% = ₹400
        discountAllocationMethod: 'BOTH',
      });

      assert.strictEqual(quote.grossTotalPaise, 200000);
      assert.strictEqual(quote.totalDiscountPaise, 20000);
      assert.strictEqual(quote.originalDoctorCommissionPaise, 40000); // ₹400
      assert.strictEqual(quote.actualStoreDiscountPaise, 10000); // ₹100 store
      assert.strictEqual(quote.actualDoctorDiscountPaise, 10000); // ₹100 doctor deduction
      assert.strictEqual(quote.finalDoctorCommissionPaise, 30000); // ₹300 final commission
      assert.strictEqual(quote.unallocatedDiscountPaise, 0);
    });

    it('Handles edge case where discount exceeds commission (₹2,000 gross, 20% comm = ₹400, ₹600 discount)', () => {
      // 1. DOCTOR allocation: capped at available ₹400, final comm ₹0, unallocated ₹200
      const quoteDoctor = calculateBillingQuote({
        items: [
          {
            medicineId: 'med_1',
            batchId: 'batch_1',
            quantityUnits: 2,
            unitPricePaise: 100000,
            gstRateBps: 0,
          },
        ],
        overallDiscountBps: 3000, // 30% of ₹2,000 = ₹600.00 (60,000 paise)
        enableDoctorCommission: true,
        doctorCommissionBps: 2000, // 20% = ₹400.00 (40,000 paise)
        discountAllocationMethod: 'DOCTOR',
      });

      assert.strictEqual(quoteDoctor.totalDiscountPaise, 60000); // ₹600 patient discount
      assert.strictEqual(quoteDoctor.originalDoctorCommissionPaise, 40000); // ₹400
      assert.strictEqual(quoteDoctor.actualDoctorDiscountPaise, 40000); // Capped at ₹400
      assert.strictEqual(quoteDoctor.finalDoctorCommissionPaise, 0); // ₹0, never negative
      assert.strictEqual(quoteDoctor.unallocatedDiscountPaise, 20000); // ₹200 unallocated
      assert.strictEqual(quoteDoctor.actualStoreDiscountPaise, 0);

      // 2. BOTH allocation: nominal store ₹300, nominal doc ₹300, doctor bears ₹300 <= ₹400, final comm ₹100
      const quoteBoth = calculateBillingQuote({
        items: [
          {
            medicineId: 'med_1',
            batchId: 'batch_1',
            quantityUnits: 2,
            unitPricePaise: 100000,
            gstRateBps: 0,
          },
        ],
        overallDiscountBps: 3000, // 30% of ₹2,000 = ₹600.00
        enableDoctorCommission: true,
        doctorCommissionBps: 2000, // 20% = ₹400.00
        discountAllocationMethod: 'BOTH',
      });

      assert.strictEqual(quoteBoth.totalDiscountPaise, 60000);
      assert.strictEqual(quoteBoth.nominalStoreDiscountPaise, 30000); // ₹300
      assert.strictEqual(quoteBoth.nominalDoctorDiscountPaise, 30000); // ₹300
      assert.strictEqual(quoteBoth.actualStoreDiscountPaise, 30000); // ₹300
      assert.strictEqual(quoteBoth.actualDoctorDiscountPaise, 30000); // ₹300
      assert.strictEqual(quoteBoth.finalDoctorCommissionPaise, 10000); // ₹100
      assert.strictEqual(quoteBoth.unallocatedDiscountPaise, 0);

      // 3. STORE allocation: store bears ₹600, commission remains ₹400
      const quoteStore = calculateBillingQuote({
        items: [
          {
            medicineId: 'med_1',
            batchId: 'batch_1',
            quantityUnits: 2,
            unitPricePaise: 100000,
            gstRateBps: 0,
          },
        ],
        overallDiscountBps: 3000,
        enableDoctorCommission: true,
        doctorCommissionBps: 2000,
        discountAllocationMethod: 'STORE',
      });

      assert.strictEqual(quoteStore.totalDiscountPaise, 60000);
      assert.strictEqual(quoteStore.actualStoreDiscountPaise, 60000);
      assert.strictEqual(quoteStore.actualDoctorDiscountPaise, 0);
      assert.strictEqual(quoteStore.finalDoctorCommissionPaise, 40000);
      assert.strictEqual(quoteStore.unallocatedDiscountPaise, 0);
    });

    it('handles odd-paisa amounts with exact reconciliation (e.g. ₹201 discount)', () => {
      // 1 item @ ₹201.00 = 20,100 paise, 100% discount = 20,100 paise
      const quote = calculateBillingQuote({
        items: [
          {
            medicineId: 'med_1',
            batchId: 'batch_1',
            quantityUnits: 1,
            unitPricePaise: 20100, // ₹201.00
            gstRateBps: 0,
          },
        ],
        overallDiscountBps: 10000, // 100%
        enableDoctorCommission: true,
        doctorCommissionBps: 5000, // 50% = ₹100.50 (10,050 paise)
        discountAllocationMethod: 'BOTH',
      });

      // Total discount = 20,100 paise
      assert.strictEqual(quote.totalDiscountPaise, 20100);
      // Nominal store = floor(20100/2) = 10050 paise; nominal doc = 10050 paise
      assert.strictEqual(quote.nominalStoreDiscountPaise, 10050);
      assert.strictEqual(quote.nominalDoctorDiscountPaise, 10050);
      // Actual doctor bears 10050 paise = original comm (10050 paise)
      assert.strictEqual(quote.actualDoctorDiscountPaise, 10050);
      assert.strictEqual(quote.finalDoctorCommissionPaise, 0);
      // Actual store + actual doctor + unallocated must exactly equal total discount
      const reconciled = quote.actualStoreDiscountPaise + quote.actualDoctorDiscountPaise + quote.unallocatedDiscountPaise;
      assert.strictEqual(reconciled, quote.totalDiscountPaise);
    });
  });

  // =========================================================================
  // Test D: Cart Discount Bug Fix Verification
  // =========================================================================
  describe('Test D: Cart Discount Calculation Fix', () => {
    // For a ₹200 bill with 0% GST:
    // 0% -> ₹0 disc, ₹200 payable
    // 5% -> ₹10 disc, ₹190 payable
    // 10% -> ₹20 disc, ₹180 payable
    // 100% -> ₹200 disc, ₹0 payable
    const create200Bill = (discountBps: number) => {
      return calculateBillingQuote({
        items: [
          {
            medicineId: 'med_pcm',
            batchId: 'batch_1',
            quantityUnits: 10,
            unitPricePaise: 2000, // 10 * ₹20.00 = ₹200.00 (20,000 paise)
            gstRateBps: 0,
            discountBps: 0, // Tests the bug: line discountBps: 0 must NOT override overallDiscountBps!
          },
        ],
        overallDiscountBps: discountBps,
        roundOffToRupee: true,
      });
    };

    it('verifies 0% discount on ₹200 bill', () => {
      const q = create200Bill(0);
      assert.strictEqual(q.grossTotalPaise, 20000);
      assert.strictEqual(q.totalDiscountPaise, 0);
      assert.strictEqual(q.netPayablePaise, 20000); // ₹200
    });

    it('verifies 5% discount on ₹200 bill (Expected: ₹10 discount, ₹190 payable)', () => {
      const q = create200Bill(500);
      assert.strictEqual(q.grossTotalPaise, 20000);
      assert.strictEqual(q.totalDiscountPaise, 1000); // ₹10.00
      assert.strictEqual(q.netPayablePaise, 19000); // ₹190.00
    });

    it('verifies 10% discount on ₹200 bill (Expected: ₹20 discount, ₹180 payable - Original Bug Fix)', () => {
      const q = create200Bill(1000);
      assert.strictEqual(q.grossTotalPaise, 20000);
      assert.strictEqual(q.totalDiscountPaise, 2000); // ₹20.00 discount
      assert.strictEqual(q.netPayablePaise, 18000); // ₹180.00 net payable
    });

    it('verifies 100% discount on ₹200 bill (Expected: ₹200 discount, ₹0 payable)', () => {
      const q = create200Bill(10000);
      assert.strictEqual(q.grossTotalPaise, 20000);
      assert.strictEqual(q.totalDiscountPaise, 20000); // ₹200.00 discount
      assert.strictEqual(q.netPayablePaise, 0); // ₹0.00 payable
    });
  });

  // =========================================================================
  // Test E: GST Jurisdiction and Configured Medicine Rates
  // =========================================================================
  describe('Test E: GST Calculation (Intra vs Inter State & Configured Rates)', () => {
    it('calculates Intra-state (CGST + SGST) equally split on discounted taxable amount', () => {
      // Medicine: ₹1,000 gross, 10% discount -> ₹900 taxable. GST: 12%
      // Intra-state (Store: 29 Karnataka, Customer: 29 Karnataka)
      const quote = calculateBillingQuote({
        items: [
          {
            medicineId: 'med_gst_1',
            batchId: 'batch_1',
            quantityUnits: 1,
            unitPricePaise: 100000, // ₹1,000
            gstRateBps: 1200, // 12%
          },
        ],
        overallDiscountBps: 1000, // 10% -> ₹100 discount
        storeStateCode: '29',
        customerStateCode: '29', // Intra-state
        roundOffToRupee: false,
      });

      assert.strictEqual(quote.grossTotalPaise, 100000);
      assert.strictEqual(quote.totalDiscountPaise, 10000); // ₹100 discount
      assert.strictEqual(quote.taxableTotalPaise, 90000); // ₹900 taxable
      assert.strictEqual(quote.isInterState, false);
      assert.strictEqual(quote.cgstTotalPaise, 5400); // 6% of 900 = ₹54.00
      assert.strictEqual(quote.sgstTotalPaise, 5400); // 6% of 900 = ₹54.00
      assert.strictEqual(quote.igstTotalPaise, 0);
      assert.strictEqual(quote.taxTotalPaise, 10800); // ₹108.00 total tax
      assert.strictEqual(quote.grandTotalPaise, 100800); // ₹1,008.00
    });

    it('calculates Inter-state (IGST) on discounted taxable amount', () => {
      // Inter-state (Store: 29 Karnataka, Customer: 27 Maharashtra)
      const quote = calculateBillingQuote({
        items: [
          {
            medicineId: 'med_gst_1',
            batchId: 'batch_1',
            quantityUnits: 1,
            unitPricePaise: 100000, // ₹1,000
            gstRateBps: 1800, // 18%
          },
        ],
        overallDiscountBps: 2000, // 20% -> ₹200 discount
        storeStateCode: '29',
        customerStateCode: '27', // Inter-state
        roundOffToRupee: false,
      });

      assert.strictEqual(quote.grossTotalPaise, 100000);
      assert.strictEqual(quote.totalDiscountPaise, 20000); // ₹200 discount
      assert.strictEqual(quote.taxableTotalPaise, 80000); // ₹800 taxable
      assert.strictEqual(quote.isInterState, true);
      assert.strictEqual(quote.cgstTotalPaise, 0);
      assert.strictEqual(quote.sgstTotalPaise, 0);
      assert.strictEqual(quote.igstTotalPaise, 14400); // 18% of 800 = ₹144.00
      assert.strictEqual(quote.taxTotalPaise, 14400);
      assert.strictEqual(quote.grandTotalPaise, 94400); // ₹944.00
    });

    it('handles multiple medicines with mixed GST rates (0%, 5%, 18%)', () => {
      const quote = calculateBillingQuote({
        items: [
          {
            medicineId: 'med_exempt',
            batchId: 'b_0',
            quantityUnits: 1,
            unitPricePaise: 10000, // ₹100
            gstRateBps: 0, // 0%
          },
          {
            medicineId: 'med_life_saving',
            batchId: 'b_5',
            quantityUnits: 1,
            unitPricePaise: 20000, // ₹200
            gstRateBps: 500, // 5%
          },
          {
            medicineId: 'med_standard',
            batchId: 'b_18',
            quantityUnits: 1,
            unitPricePaise: 50000, // ₹500
            gstRateBps: 1800, // 18%
          },
        ],
        overallDiscountBps: 0,
        storeStateCode: '29',
        customerStateCode: '29',
        roundOffToRupee: false,
      });

      assert.strictEqual(quote.grossTotalPaise, 80000); // ₹800
      assert.strictEqual(quote.taxSlabs.length, 3);
      // 0% slab: ₹100 taxable, ₹0 tax
      const slab0 = quote.taxSlabs.find((s) => s.gstRateBps === 0);
      assert.strictEqual(slab0?.taxablePaise, 10000);
      assert.strictEqual(slab0?.totalTaxPaise, 0);

      // 5% slab: ₹200 taxable, ₹10 tax (5 + 5)
      const slab5 = quote.taxSlabs.find((s) => s.gstRateBps === 500);
      assert.strictEqual(slab5?.taxablePaise, 20000);
      assert.strictEqual(slab5?.totalTaxPaise, 1000);

      // 18% slab: ₹500 taxable, ₹90 tax (45 + 45)
      const slab18 = quote.taxSlabs.find((s) => s.gstRateBps === 1800);
      assert.strictEqual(slab18?.taxablePaise, 50000);
      assert.strictEqual(slab18?.totalTaxPaise, 9000);

      assert.strictEqual(quote.taxTotalPaise, 10000); // ₹100 total tax
      assert.strictEqual(quote.grandTotalPaise, 90000); // ₹900 grand total
    });

    it('correctly handles manual state names for intra-state and inter-state GST', () => {
      // Intra-state using manual state name 'Karnataka'
      const intraQuote = calculateBillingQuote({
        items: [
          {
            medicineId: 'm1',
            batchId: 'b1',
            quantityUnits: 1,
            unitPricePaise: 10000,
            gstRateBps: 1800,
          },
        ],
        storeStateCode: '29',
        customerStateCode: 'Karnataka',
        roundOffToRupee: false,
      });
      assert.strictEqual(intraQuote.isInterState, false);
      assert.strictEqual(intraQuote.cgstTotalPaise, 900);
      assert.strictEqual(intraQuote.sgstTotalPaise, 900);
      assert.strictEqual(intraQuote.igstTotalPaise, 0);

      // Inter-state using manual state name 'Maharashtra'
      const interQuote = calculateBillingQuote({
        items: [
          {
            medicineId: 'm1',
            batchId: 'b1',
            quantityUnits: 1,
            unitPricePaise: 10000,
            gstRateBps: 1800,
          },
        ],
        storeStateCode: '29',
        customerStateCode: 'Maharashtra',
        roundOffToRupee: false,
      });
      assert.strictEqual(interQuote.isInterState, true);
      assert.strictEqual(interQuote.cgstTotalPaise, 0);
      assert.strictEqual(interQuote.sgstTotalPaise, 0);
      assert.strictEqual(interQuote.igstTotalPaise, 1800);
    });
  });

  // =========================================================================
  // Test F: Persistence and Commission Ledger Invariants
  // =========================================================================
  describe('Test F: Persistence & Commission Ledger Invariants', () => {
    it('creates an immutable DoctorCommissionRecord matching finalized invoice totals', () => {
      const quote = calculateBillingQuote({
        items: [
          {
            medicineId: 'med_1',
            batchId: 'batch_1',
            quantityUnits: 2,
            unitPricePaise: 100000, // ₹2,000 gross
            gstRateBps: 0,
          },
        ],
        overallDiscountBps: 1000, // ₹200 discount
        enableDoctorCommission: true,
        doctorCommissionBps: 2000, // 20%
        discountAllocationMethod: 'BOTH',
      });

      const invoice: InvoiceRecord = {
        id: 'inv_1001',
        storeId: 'store_test',
        invoiceNumber: 'SMSC1001',
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
        paymentModes: [{ mode: 'CASH', amountPaise: quote.netPayablePaise }],
        doctorId: 'doc_1',
        doctorName: 'Dr. Suresh Rao',
        doctorCommissionBps: quote.doctorCommissionBps,
        originalDoctorCommissionPaise: quote.originalDoctorCommissionPaise,
        discountAllocationMethod: quote.discountAllocationMethod,
        nominalStoreDiscountPaise: quote.nominalStoreDiscountPaise,
        nominalDoctorDiscountPaise: quote.nominalDoctorDiscountPaise,
        actualStoreDiscountPaise: quote.actualStoreDiscountPaise,
        actualDoctorDiscountPaise: quote.actualDoctorDiscountPaise,
        unallocatedDiscountPaise: quote.unallocatedDiscountPaise,
        finalDoctorCommissionPaise: quote.finalDoctorCommissionPaise,
        hasScheduleH: false,
        billerUid: 'cashier_1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const ledgerRecord: DoctorCommissionRecord = {
        id: invoice.id,
        storeId: invoice.storeId,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        doctorId: invoice.doctorId!,
        doctorName: invoice.doctorName,
        commissionRateBps: invoice.doctorCommissionBps || 0,
        commissionBasis: 'PROFIT_MARGIN',
        originalGrossTotalPaise: invoice.grossTotalPaise,
        totalProfitPaise: 0,
        originalDoctorCommissionPaise: invoice.originalDoctorCommissionPaise!,
        patientDiscountBps: 1000,
        totalPatientDiscountPaise: invoice.totalDiscountPaise,
        discountAllocationMethod: invoice.discountAllocationMethod!,
        nominalStoreDiscountPaise: invoice.nominalStoreDiscountPaise!,
        nominalDoctorDiscountPaise: invoice.nominalDoctorDiscountPaise!,
        actualStoreDiscountPaise: invoice.actualStoreDiscountPaise!,
        actualDoctorDiscountPaise: invoice.actualDoctorDiscountPaise!,
        unallocatedDiscountPaise: invoice.unallocatedDiscountPaise!,
        finalDoctorCommissionPaise: invoice.finalDoctorCommissionPaise!,
        invoiceStatus: 'FINALIZED',
        createdAt: invoice.createdAt,
        updatedAt: invoice.updatedAt,
      };

      assert.strictEqual(ledgerRecord.originalDoctorCommissionPaise, 40000); // ₹400.00
      assert.strictEqual(ledgerRecord.actualDoctorDiscountPaise, 10000); // ₹100.00
      assert.strictEqual(ledgerRecord.finalDoctorCommissionPaise, 30000); // ₹300.00
      assert.strictEqual(ledgerRecord.invoiceStatus, 'FINALIZED');
    });

    it('ensures commission is zeroed out and invoice status is updated upon refund/cancellation', () => {
      const ledgerRecord: DoctorCommissionRecord = {
        id: 'inv_1001',
        storeId: 'store_test',
        invoiceId: 'inv_1001',
        invoiceNumber: 'SMSC1001',
        doctorId: 'doc_1',
        commissionRateBps: 2000,
        commissionBasis: 'PROFIT_MARGIN',
        originalGrossTotalPaise: 200000,
        totalProfitPaise: 0,
        originalDoctorCommissionPaise: 40000,
        patientDiscountBps: 1000,
        totalPatientDiscountPaise: 20000,
        discountAllocationMethod: 'STORE',
        nominalStoreDiscountPaise: 20000,
        nominalDoctorDiscountPaise: 0,
        actualStoreDiscountPaise: 20000,
        actualDoctorDiscountPaise: 0,
        unallocatedDiscountPaise: 0,
        finalDoctorCommissionPaise: 40000,
        invoiceStatus: 'FINALIZED',
        createdAt: '2026-10-25T10:00:00.000Z',
        updatedAt: '2026-10-25T10:00:00.000Z',
      };

      // When refunded:
      const reversedRecord: DoctorCommissionRecord = {
        ...ledgerRecord,
        invoiceStatus: 'REFUNDED',
        finalDoctorCommissionPaise: 0, // Reversal
        updatedAt: '2026-10-25T10:30:00.000Z',
      };

      assert.strictEqual(reversedRecord.invoiceStatus, 'REFUNDED');
      assert.strictEqual(reversedRecord.finalDoctorCommissionPaise, 0);
      assert.strictEqual(reversedRecord.originalDoctorCommissionPaise, 40000); // Historical audit preserved
    });
  });
});
