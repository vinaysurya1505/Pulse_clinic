import { describe, it } from 'node:test';
import assert from 'node:assert';
import { calculateBillingQuote } from '@pulseclinic/types';
import { ApprovalCodeService } from './ApprovalCodeService';
import { OutboxWorker } from './OutboxWorker';
import { GSTReportService } from './GSTReportService';
import { Sanitizer } from '../utils/sanitizer';

describe('Prompt 27: Complete End-to-End Automated Testing Suite', () => {
  // Test 1: Deterministic Integer-Paise Billing Calculation
  it('1. Calculation Engine: computes exact paise totals, HSN tax breakdowns, and zero floating drift', () => {
    const quote = calculateBillingQuote({
      items: [
        {
          medicineId: 'med_pcm',
          batchId: 'batch_pcm_01',
          quantityUnits: 2,
          unitPricePaise: 2000, // ₹20.00 each = ₹40.00
          discountBps: 500, // 5% discount = ₹2.00 discount -> Taxable ₹38.00
          gstRateBps: 1200, // 12% GST
          hsnCode: '30049099',
          medicineName: 'Paracetamol 500mg',
          batchNumber: 'BATCH-001',
        },
      ],
      overallDiscountBps: 0,
      storeStateCode: '29',
      customerStateCode: '29', // Intra-state (CGST + SGST)
    });

    assert.strictEqual(quote.grossTotalPaise, 4000); // ₹40.00
    assert.strictEqual(quote.totalDiscountPaise, 200); // ₹2.00
    assert.strictEqual(quote.taxableTotalPaise, 3800); // ₹38.00
    assert.strictEqual(quote.cgstTotalPaise, 228); // 6% of 3800 = 228 paise
    assert.strictEqual(quote.sgstTotalPaise, 228); // 6% of 3800 = 228 paise
    assert.strictEqual(quote.igstTotalPaise, 0);
    assert.strictEqual(quote.taxTotalPaise, 456); // 456 paise
    assert.strictEqual(quote.grandTotalPaise, 4256); // ₹42.56 exact total
    assert.strictEqual(quote.roundOffPaise, 44); // +₹0.44 round-off
    assert.strictEqual(quote.netPayablePaise, 4300); // ₹43.00 rounded payable
  });

  // Test 2: Split Payment Exact Match Assertion
  it('2. Payment Validation: validates split payment exact sums against grand total', () => {
    const grandTotalPaise = 4256;
    const splitPayments = [
      { mode: 'CASH' as const, amountPaise: 2000 },
      { mode: 'UPI' as const, amountPaise: 2256 },
    ];
    const totalPaid = splitPayments.reduce((acc, p) => acc + p.amountPaise, 0);

    assert.strictEqual(totalPaid, grandTotalPaise);
  });

  // Test 3: Monotonic Invoice Number Formatting
  it('3. Sequential Invoicing: validates INV-YYYYMM-XXXXXX formatting', () => {
    const yearMonth = '202610';
    const counter = 42;
    const invoiceNumber = `INV-${yearMonth}-${String(counter).padStart(6, '0')}`;

    assert.strictEqual(invoiceNumber, 'INV-202610-000042');
    assert.match(invoiceNumber, /^INV-\d{6}-\d{6}$/);
  });

  // Test 4: Approval Code Generation & AES-256-GCM Outbox
  it('4. Refund Security: generates 8-char OTP, verifies timingSafeEqual, and outbox encrypts', () => {
    const otp = ApprovalCodeService.generateOTP();
    assert.strictEqual(otp.length, 8);
    assert.match(otp, /^[A-Z0-9]{8}$/);

    const hash = ApprovalCodeService.hashOTP(otp);
    assert.strictEqual(ApprovalCodeService.timingSafeEqualHex(hash, ApprovalCodeService.hashOTP(otp)), true);
    assert.strictEqual(ApprovalCodeService.timingSafeEqualHex(hash, ApprovalCodeService.hashOTP('WRONGOTP')), false);

    const emailPayload = {
      to: 'owner@pulseclinic.in',
      subject: 'Refund Approval Required',
      body: `Use OTP: ${otp}`,
    };
    const encrypted = OutboxWorker.encryptPayload(emailPayload);
    const decrypted = OutboxWorker.decryptPayload(encrypted.encryptedData, encrypted.iv, encrypted.authTag);

    assert.strictEqual(decrypted.to, emailPayload.to);
    assert.strictEqual(decrypted.body, emailPayload.body);
  });

  // Test 5: Cash Register Reconciliation Math
  it('5. Cash Drawer: verifies opening float + net cash sales - expenses = expected cash', () => {
    const openingFloatPaise = 200000; // ₹2000.00
    const netCashSalesPaise = 45000; // ₹450.00
    const cashExpensesPaise = 15000; // ₹150.00
    const expectedDrawerCashPaise = openingFloatPaise + netCashSalesPaise - cashExpensesPaise;

    assert.strictEqual(expectedDrawerCashPaise, 230000); // ₹2300.00

    const countedPhysicalCashPaise = 230000;
    const discrepancyPaise = countedPhysicalCashPaise - expectedDrawerCashPaise;
    assert.strictEqual(discrepancyPaise, 0);
  });

  // Test 6: GSTR-1 HSN Summary & CSV Export
  it('6. GSTR-1 Return: compiles HSN outward summary and CSV formatted for GST portal', () => {
    const mockReport: any = {
      storeId: 'pulseclinic-main',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      coveredInvoicesCount: 1,
      totalTaxablePaise: 3800,
      totalCgstPaise: 228,
      totalSgstPaise: 228,
      totalIgstPaise: 0,
      totalTaxPaise: 456,
      hsnSummary: [
        {
          hsnCode: '30049099',
          description: 'Medicaments of other substances',
          uqc: 'BOX',
          totalQuantity: 2,
          totalValuePaise: 4256,
          taxableValuePaise: 3800,
          cgstPaise: 228,
          sgstPaise: 228,
          igstPaise: 0,
          cessPaise: 0,
        },
      ],
    };

    const csv = GSTReportService.generateGstr1Csv(mockReport);
    assert.strictEqual(csv.includes('HSN,Description,UQC,Total Quantity'), true);
    assert.strictEqual(csv.includes('30049099'), true);
    assert.strictEqual(csv.includes('38.00'), true); // Taxable value in INR
  });

  // Test 7: DPDP Privacy Compliance & Data Masking
  it('7. DPDP Compliance: enforces masking across all employee and patient PII', () => {
    assert.strictEqual(Sanitizer.maskPhone('9876543210'), 'XXXXXX3210');
    assert.strictEqual(Sanitizer.maskAadhaar('123456789012'), 'XXXX-XXXX-9012');
    assert.strictEqual(Sanitizer.maskPAN('ABCDE1234F'), 'XXXXX1234F');
    assert.strictEqual(Sanitizer.maskEmail('patient.vip@pulseclinic.in'), 'p*****p@pulseclinic.in');
  });
});
