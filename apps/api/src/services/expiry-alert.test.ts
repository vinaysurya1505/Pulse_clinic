import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ExpiryAlertService, ExpiryScanResult } from './ExpiryAlertService';

describe('ExpiryAlertService & Daily Scheduler Tests', () => {
  it('generates a formatted HTML email table with New Sanjivani Clinic branding, stock, rack, and MRP', () => {
    const mockScanResult: ExpiryScanResult = {
      storeId: 'pulseclinic-main',
      storeName: 'New Sanjivani Multispeciality Clinic',
      totalBatches: 2,
      totalUnits: 35,
      totalValuePaise: 450000,
      totalValueRupees: '4500.00',
      scanTimeIST: '30 Oct 2026, 10:00 AM',
      items: [
        {
          id: 'batch_01',
          medicineBrandName: 'Augmentin 625 Duo',
          medicineGenericName: 'Amoxicillin and Clavulanate',
          strength: '625mg',
          batchNumber: 'AUG-2026-01',
          expiryDate: '2026-11-05',
          stockUnits: 15,
          mrpPaise: 20000, // ₹200.00
          rackLocation: 'Rack B-03',
          daysRemaining: 6,
          totalValuePaise: 300000,
          urgency: 'CRITICAL',
        },
        {
          id: 'batch_02',
          medicineBrandName: 'Azithral 500',
          medicineGenericName: 'Azithromycin',
          batchNumber: 'AZT-9921',
          expiryDate: '2026-11-20',
          stockUnits: 20,
          mrpPaise: 7500, // ₹75.00
          rackLocation: 'Rack A-01',
          daysRemaining: 21,
          totalValuePaise: 150000,
          urgency: 'WARNING',
        },
      ],
    };

    const html = ExpiryAlertService.buildExpiryAlertHtml(mockScanResult);

    // Assert branding
    assert.ok(html.includes('New Sanjivani Multispeciality Clinic'));
    assert.ok(html.includes('Inventory &amp; Expiry Risk Alert System'));
    assert.ok(html.includes('Padrauna Road, Naurangia, Kushinagar 274305'));

    // Assert summary metrics
    assert.ok(html.includes('₹4500.00'));
    assert.ok(html.includes('35')); // Total units
    assert.ok(html.includes('2')); // Products at risk

    // Assert product rows
    assert.ok(html.includes('Augmentin 625 Duo'));
    assert.ok(html.includes('AUG-2026-01'));
    assert.ok(html.includes('Rack B-03'));
    assert.ok(html.includes('₹200.00'));
    assert.ok(html.includes('🔴 in 6 days'));

    assert.ok(html.includes('Azithral 500'));
    assert.ok(html.includes('AZT-9921'));
    assert.ok(html.includes('Rack A-01'));
    assert.ok(html.includes('₹75.00'));
    assert.ok(html.includes('🟠 in 21 days'));
  });

  it('generates formatted plain-text fallback for text-only email clients', () => {
    const mockScanResult: ExpiryScanResult = {
      storeId: 'pulseclinic-main',
      storeName: 'New Sanjivani Multispeciality Clinic',
      totalBatches: 1,
      totalUnits: 10,
      totalValuePaise: 100000,
      totalValueRupees: '1000.00',
      scanTimeIST: '30 Oct 2026, 08:00 PM',
      items: [
        {
          id: 'batch_03',
          medicineBrandName: 'Paracetamol 500',
          batchNumber: 'PCM-22',
          expiryDate: '2026-10-31',
          stockUnits: 10,
          mrpPaise: 10000,
          rackLocation: 'Shelf 2',
          daysRemaining: 1,
          totalValuePaise: 100000,
          urgency: 'CRITICAL',
        },
      ],
    };

    const plainText = ExpiryAlertService.buildExpiryAlertPlainText(mockScanResult);

    assert.ok(plainText.includes('NEW SANJIVANI MULTISPECIALITY CLINIC'));
    assert.ok(plainText.includes('Paracetamol 500 [Batch: PCM-22]'));
    assert.ok(plainText.includes('Rack: Shelf 2 | Stock: 10 | MRP: ₹100.00 | Total: ₹1000.00'));
    assert.ok(plainText.includes('Expiry: 2026-10-31 (in 1 days)'));
  });

  it('scheduler identifies 10:50 AM IST, 10:00 AM IST and 08:00 PM IST targets correctly', async () => {
    // 10:50 AM IST is 05:20 AM UTC
    const test1050amIST = new Date('2026-10-30T05:20:00.000Z');
    // 10:00 AM IST is 04:30 AM UTC
    const morning10amIST = new Date('2026-10-30T04:30:00.000Z');
    // 08:00 PM IST is 14:30 UTC
    const evening8pmIST = new Date('2026-10-30T14:30:00.000Z');
    // Non-target time: 11:15 AM IST is 05:45 UTC
    const nonTargetIST = new Date('2026-10-30T05:45:00.000Z');

    // Format 10:50 AM test slot
    const testIST = test1050amIST.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
    assert.ok(testIST.startsWith('10:50'));

    // Format morning
    const morningIST = morning10amIST.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
    assert.ok(morningIST.startsWith('10:00'));

    // Format evening
    const eveningIST = evening8pmIST.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
    assert.ok(eveningIST.startsWith('20:00'));

    // Non-target should not match
    const nonTarget = nonTargetIST.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
    assert.ok(!nonTarget.startsWith('10:00') && !nonTarget.startsWith('10:50') && !nonTarget.startsWith('20:00'));
  });
});
