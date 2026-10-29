import { describe, it } from 'node:test';
import assert from 'node:assert';
import { calculateBillingQuote } from '@pulseclinic/types';

describe('Cash Round-off and Exact Paise Billing Tests', () => {
  it('Scenario 1: No cash round-off by default (exact ?514.80 net payable)', () => {
    // Grand total = 51480 paise (?514.80)
    const quote = calculateBillingQuote({
      items: [
        {
          medicineId: 'med_test',
          batchId: 'batch_test_01',
          quantityUnits: 1,
          unitPricePaise: 46800, // 468.00 taxable
          discountBps: 0,
          gstRateBps: 1000, // 10% GST -> 46.80 tax -> 514.80 grand total
          hsnCode: '30049099',
        },
      ],
      storeStateCode: '29',
      customerStateCode: '29',
    });

    assert.strictEqual(quote.grandTotalPaise, 51480); // ?514.80
    assert.strictEqual(quote.roundOffPaise, 0); // No round off applied
    assert.strictEqual(quote.netPayablePaise, 51480); // Exact net payable ?514.80

    // Cash payment of full amount ?514.80
    const paymentModes = [{ mode: 'CASH' as const, amountPaise: 51480 }];
    const totalPaidPaise = paymentModes.reduce((acc, p) => acc + p.amountPaise, 0);

    // Exact match: must not throw "Payment total does not match net payable"
    assert.strictEqual(totalPaidPaise, quote.netPayablePaise);
  });

  it('Scenario 2: Store owner leaves 80 paise and collects ?514.00 only (roundOffMode: DOWN)', () => {
    const quote = calculateBillingQuote({
      items: [
        {
          medicineId: 'med_test',
          batchId: 'batch_test_01',
          quantityUnits: 1,
          unitPricePaise: 46800,
          discountBps: 0,
          gstRateBps: 1000,
          hsnCode: '30049099',
        },
      ],
      storeStateCode: '29',
      customerStateCode: '29',
      roundOffMode: 'DOWN',
    });

    assert.strictEqual(quote.grandTotalPaise, 51480); // ?514.80
    assert.strictEqual(quote.roundOffPaise, -80); // -80 paise round off
    assert.strictEqual(quote.netPayablePaise, 51400); // ?514.00 integer amount

    // Store owner collects integer amount ?514.00 in cash
    const paymentModes = [{ mode: 'CASH' as const, amountPaise: 51400 }];
    const totalPaidPaise = paymentModes.reduce((acc, p) => acc + p.amountPaise, 0);

    // Exact match against ?514.00
    assert.strictEqual(totalPaidPaise, quote.netPayablePaise);
  });
});

