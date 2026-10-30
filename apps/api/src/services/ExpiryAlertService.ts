import { getFirestore } from '../lib/firebase-admin';
import { COLLECTIONS } from '@pulseclinic/config';
import { BatchInventory } from '@pulseclinic/types';
import { OutboxWorker } from './OutboxWorker';

export interface ExpiryAlertItem {
  id: string;
  medicineBrandName: string;
  medicineGenericName?: string;
  strength?: string;
  dosageForm?: string;
  batchNumber: string;
  expiryDate: string;
  stockUnits: number;
  mrpPaise: number;
  costPricePaise?: number;
  rackLocation: string;
  daysRemaining: number;
  totalValuePaise: number;
  urgency: 'EXPIRED' | 'CRITICAL' | 'WARNING';
}

export interface ExpiryScanResult {
  storeId: string;
  storeName: string;
  items: ExpiryAlertItem[];
  totalBatches: number;
  totalUnits: number;
  totalValuePaise: number;
  totalValueRupees: string;
  scanTimeIST: string;
}

export class ExpiryAlertService {
  /**
   * Scans store batches for products expiring within thresholdDays (default 30 days)
   * and with stockUnits > 0.
   */
  static async scanStoreBatches(
    storeId: string = 'pulseclinic-main',
    thresholdDays: number = 30
  ): Promise<ExpiryScanResult> {
    const db = getFirestore();
    const batchesCol = db.collection(COLLECTIONS.batches(storeId));
    const snapshot = await batchesCol.get();

    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    const items: ExpiryAlertItem[] = [];
    let totalUnits = 0;
    let totalValuePaise = 0;

    for (const doc of snapshot.docs) {
      const b = doc.data() as BatchInventory;

      // Only check non-recalled batches with active stock
      if (b.status === 'RECALLED' || !b.stockUnits || b.stockUnits <= 0 || !b.expiryDate) {
        continue;
      }

      // Parse expiry date YYYY-MM-DD
      const parts = b.expiryDate.split('-').map(Number);
      if (parts.length < 2) continue;
      const year = parts[0];
      const month = parts[1] - 1;
      const day = parts.length >= 3 ? parts[2] : 28;
      const expMidnight = new Date(year, month, day, 0, 0, 0, 0);

      const diffMs = expMidnight.getTime() - todayMidnight.getTime();
      const daysRemaining = Math.round(diffMs / (1000 * 60 * 60 * 24));

      // Threshold: expiring within 30 days (or already expired)
      if (daysRemaining <= thresholdDays) {
        const itemValuePaise = (b.stockUnits || 0) * (b.mrpPaise || 0);
        totalUnits += b.stockUnits || 0;
        totalValuePaise += itemValuePaise;

        let urgency: 'EXPIRED' | 'CRITICAL' | 'WARNING' = 'WARNING';
        if (daysRemaining <= 0) urgency = 'EXPIRED';
        else if (daysRemaining <= 15) urgency = 'CRITICAL';

        items.push({
          id: doc.id,
          medicineBrandName: b.medicineBrandName || 'Medicine',
          medicineGenericName: b.medicineGenericName || undefined,
          strength: b.strength || undefined,
          dosageForm: b.dosageForm || undefined,
          batchNumber: b.batchNumber || 'N/A',
          expiryDate: b.expiryDate,
          stockUnits: b.stockUnits,
          mrpPaise: b.mrpPaise || 0,
          costPricePaise: b.costPricePaise,
          rackLocation: b.rackLocation || 'Shelf A',
          daysRemaining,
          totalValuePaise: itemValuePaise,
          urgency,
        });
      }
    }

    // Sort strictly by earliest expiry date first (FEFO order)
    items.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

    // Resolve store name
    let storeName = 'New Sanjivani Multispeciality Clinic';
    try {
      const storeDoc = await db.collection(COLLECTIONS.stores).doc(storeId).get();
      if (storeDoc.exists) {
        const sData = storeDoc.data();
        if (sData?.name || sData?.storeName) {
          storeName = sData.name || sData.storeName;
        }
      }
    } catch {
      // Fallback to clinic name
    }

    const scanTimeIST = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    return {
      storeId,
      storeName,
      items,
      totalBatches: items.length,
      totalUnits,
      totalValuePaise,
      totalValueRupees: (totalValuePaise / 100).toFixed(2),
      scanTimeIST,
    };
  }

  /**
   * Generates a modern, responsive HTML email table for near-expiry products
   */
  static buildExpiryAlertHtml(result: ExpiryScanResult): string {
    const { storeName, items, totalBatches, totalUnits, totalValueRupees, scanTimeIST } = result;

    const rowsHtml = items.length > 0 ? items.map((it, idx) => {
      const isEven = idx % 2 === 0;
      const unitMrp = (it.mrpPaise / 100).toFixed(2);
      const totalVal = (it.totalValuePaise / 100).toFixed(2);

      let badgeBg = '#fef3c7';
      let badgeColor = '#92400e';
      let badgeText = `🟠 in ${it.daysRemaining} days`;

      if (it.urgency === 'EXPIRED') {
        badgeBg = '#fee2e2';
        badgeColor = '#991b1b';
        badgeText = it.daysRemaining === 0 ? '🔴 Today (Expired)' : `🔴 Expired (${Math.abs(it.daysRemaining)}d ago)`;
      } else if (it.urgency === 'CRITICAL') {
        badgeBg = '#fee2e2';
        badgeColor = '#b91c1c';
        badgeText = `🔴 in ${it.daysRemaining} days`;
      }

      return `
        <tr style="background-color: ${isEven ? '#ffffff' : '#f8fafc'}; border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px 12px; font-size: 12px; color: #64748b; text-align: center;">${idx + 1}</td>
          <td style="padding: 10px 12px;">
            <div style="font-weight: 700; color: #0f172a; font-size: 13px;">${it.medicineBrandName}</div>
            ${it.medicineGenericName ? `<div style="font-size: 11px; color: #64748b;">${it.medicineGenericName}${it.strength ? ` • ${it.strength}` : ''}</div>` : ''}
          </td>
          <td style="padding: 10px 12px; font-family: monospace; font-size: 12px; font-weight: 600; color: #1e40af;">
            <span style="background-color: #dbeafe; padding: 2px 6px; border-radius: 4px;">${it.batchNumber}</span>
          </td>
          <td style="padding: 10px 12px; font-size: 12px; color: #334155; font-weight: 500;">
            ${it.rackLocation}
          </td>
          <td style="padding: 10px 12px; font-size: 13px; font-weight: 800; color: #0f172a; text-align: right;">
            ${it.stockUnits}
          </td>
          <td style="padding: 10px 12px; font-size: 12px; color: #475569; text-align: right;">
            ₹${unitMrp}
          </td>
          <td style="padding: 10px 12px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right;">
            ₹${totalVal}
          </td>
          <td style="padding: 10px 12px; text-align: center;">
            <div style="font-size: 11px; font-weight: 700; font-family: monospace; color: #0f172a;">${it.expiryDate}</div>
            <div style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 700; background-color: ${badgeBg}; color: ${badgeColor}; margin-top: 3px;">
              ${badgeText}
            </div>
          </td>
        </tr>
      `;
    }).join('') : `
      <tr>
        <td colspan="8" style="padding: 24px; text-align: center; color: #16a34a; font-weight: 600; font-size: 13px;">
          🎉 All batches are in healthy shelf-life (&gt; 30 days). No immediate action required.
        </td>
      </tr>
    `;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Urgent Expiry Product Report - ${storeName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 32px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" style="max-width: 680px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08);" cellspacing="0" cellpadding="0">
          
          <!-- Clinic Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); padding: 26px 24px; text-align: center;">
              <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.15); border-radius: 50%; width: 44px; height: 44px; line-height: 44px; font-size: 22px; margin-bottom: 8px;">
                🏥
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: 0.02em;">
                ${storeName}
              </h1>
              <p style="margin: 4px 0 0 0; color: #93c5fd; font-size: 13px; font-weight: 500;">
                Inventory &amp; Expiry Risk Alert System
              </p>
            </td>
          </tr>

          <!-- Alert Banner -->
          <tr>
            <td style="padding: 18px 24px 0 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fef2f2; border-left: 4px solid #dc2626; border-radius: 6px; padding: 12px 16px;">
                <tr>
                  <td>
                    <div style="font-weight: 800; font-size: 13px; color: #991b1b; text-transform: uppercase; letter-spacing: 0.05em;">
                      ⚠️ URGENT INVENTORY NOTICE: NEAR-EXPIRY PRODUCTS (≤ 30 DAYS)
                    </div>
                    <div style="font-size: 13px; color: #475569; margin-top: 2px;">
                      The following products require immediate attention (discounting, priority FEFO sales, or supplier return) before expiration.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Risk Summary Cards -->
          <tr>
            <td style="padding: 16px 24px 12px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="32%" style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 10px; padding: 14px 16px; text-align: center;">
                    <div style="font-size: 11px; font-weight: 700; color: #9f1239; text-transform: uppercase;">Products at Risk</div>
                    <div style="font-size: 24px; font-weight: 800; color: #881337; margin-top: 4px;">${totalBatches}</div>
                    <div style="font-size: 10px; color: #be123c;">Batches ≤ 30 days</div>
                  </td>
                  <td width="2%">&nbsp;</td>
                  <td width="32%" style="background-color: #fef3c7; border: 1px solid #fde68a; border-radius: 10px; padding: 14px 16px; text-align: center;">
                    <div style="font-size: 11px; font-weight: 700; color: #92400e; text-transform: uppercase;">Stock Units</div>
                    <div style="font-size: 24px; font-weight: 800; color: #78350f; margin-top: 4px;">${totalUnits}</div>
                    <div style="font-size: 10px; color: #b45309;">Total units on shelf</div>
                  </td>
                  <td width="2%">&nbsp;</td>
                  <td width="32%" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 14px 16px; text-align: center;">
                    <div style="font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase;">Value at Risk</div>
                    <div style="font-size: 22px; font-weight: 800; color: #14532d; margin-top: 4px;">₹${totalValueRupees}</div>
                    <div style="font-size: 10px; color: #15803d;">Total retail value</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Product Details Table -->
          <tr>
            <td style="padding: 10px 24px 16px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; border-collapse: collapse;">
                <thead>
                  <tr style="background-color: #0f172a; color: #ffffff;">
                    <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; text-align: center; text-transform: uppercase; width: 5%;">#</th>
                    <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; text-align: left; text-transform: uppercase; width: 33%;">Medicine</th>
                    <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; text-align: left; text-transform: uppercase; width: 14%;">Batch</th>
                    <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; text-align: left; text-transform: uppercase; width: 12%;">Rack</th>
                    <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; text-align: right; text-transform: uppercase; width: 10%;">Stock</th>
                    <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; text-align: right; text-transform: uppercase; width: 12%;">MRP</th>
                    <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; text-align: right; text-transform: uppercase; width: 14%;">Total</th>
                    <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; text-align: center; text-transform: uppercase; width: 14%;">Expiry</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Recommended Actions -->
          <tr>
            <td style="padding: 0 24px 20px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px;">
                <tr>
                  <td style="font-size: 13px; line-height: 1.5; color: #475569;">
                    <div style="font-weight: 700; color: #1e293b; margin-bottom: 6px;">
                      💡 Recommended Store Actions:
                    </div>
                    <ul style="margin: 0; padding-left: 18px; color: #475569;">
                      <li style="margin-bottom: 4px;"><strong>Supplier Return:</strong> Review batches eligible for credit note or replacement with your pharmaceutical distributor before the return window closes.</li>
                      <li style="margin-bottom: 4px;"><strong>Priority FEFO Dispensing:</strong> Ensure retail counter staff dispenses these specific batches first for upcoming patient prescriptions.</li>
                      <li><strong>Front-Shelf Placement / Discounting:</strong> Relocate near-expiry OTC or wellness products to fast-moving counters with clearance discounts.</li>
                    </ul>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center;">
              <div style="font-weight: 700; font-size: 13px; color: #1e293b; margin-bottom: 4px;">
                ${storeName}
              </div>
              <div style="font-size: 11px; color: #64748b; line-height: 1.5; margin-bottom: 8px;">
                Beside Hero Bike Agency, In Front of Rajesh Mani Inter College,<br />
                Padrauna Road, Naurangia, Kushinagar 274305<br />
                <strong>Helpline:</strong> +91 8114000119 / +91 8004807785
              </div>
              <div style="font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 8px;">
                Automated Inventory Intelligence Dispatch &bull; Report Generated: ${scanTimeIST}
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  /**
   * Generates formatted plain text fallback for text-only email clients
   */
  static buildExpiryAlertPlainText(result: ExpiryScanResult): string {
    const { storeName, items, totalBatches, totalUnits, totalValueRupees, scanTimeIST } = result;

    const listLines = items.map((it, idx) => {
      const unitMrp = (it.mrpPaise / 100).toFixed(2);
      const totalVal = (it.totalValuePaise / 100).toFixed(2);
      const status = it.urgency === 'EXPIRED' ? 'EXPIRED' : `in ${it.daysRemaining} days`;
      return `${idx + 1}. ${it.medicineBrandName} [Batch: ${it.batchNumber}]
   Rack: ${it.rackLocation} | Stock: ${it.stockUnits} | MRP: ₹${unitMrp} | Total: ₹${totalVal}
   Expiry: ${it.expiryDate} (${status})`;
    }).join('\n\n');

    return `============================================================
${storeName.toUpperCase()}
Inventory & Expiry Risk Alert (≤ 30 Days)
Report Generated: ${scanTimeIST}
============================================================

RISK SUMMARY:
- Products at Risk: ${totalBatches} batches
- Total Stock Units: ${totalUnits} units
- Financial Value at Risk: ₹${totalValueRupees}

------------------------------------------------------------
NEAR-EXPIRY / EXPIRED PRODUCTS LIST:
------------------------------------------------------------

${listLines}

------------------------------------------------------------
RECOMMENDED ACTIONS:
1. Contact pharmaceutical suppliers/distributors for credit note/replacement eligibility.
2. Prioritize FEFO dispensing at the retail checkout counter.
3. Apply clearances on shelf displays for fast liquidation.

${storeName}
Padrauna Road, Naurangia, Kushinagar 274305
Ph: +91 8114000119 / +91 8004807785
============================================================`;
  }

  /**
   * Scans inventory and dispatches expiry alert email to administrator.
   */
  static async sendExpiryAlert(options?: {
    storeId?: string;
    force?: boolean;
  }): Promise<{
    sent: boolean;
    reason?: string;
    totalBatches: number;
    totalUnits: number;
    totalValueRupees: string;
    recipient?: string;
  }> {
    const storeId = options?.storeId || 'pulseclinic-main';
    const force = Boolean(options?.force);

    const scanResult = await this.scanStoreBatches(storeId, 30);
    const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@pulseclinic.in';

    // If no products are near expiry and force is not set, skip email
    if (scanResult.totalBatches === 0 && !force) {
      console.log(`[EXPIRY_ALERT] No batches expiring within 30 days for store "${storeId}". Skipping email.`);
      return {
        sent: false,
        reason: 'NO_EXPIRING_BATCHES',
        totalBatches: 0,
        totalUnits: 0,
        totalValueRupees: '0.00',
      };
    }

    const html = this.buildExpiryAlertHtml(scanResult);
    const plainText = this.buildExpiryAlertPlainText(scanResult);

    const subject = scanResult.totalBatches > 0
      ? `[New Sanjivani Clinic] ⚠️ Urgent: ${scanResult.totalBatches} Products Expiring Soon (≤ 30 Days)`
      : `[New Sanjivani Clinic] ✅ Inventory Expiry Report: All Products Healthy (0 Expiring)`;

    await OutboxWorker.enqueueEmail({
      to: adminEmail,
      subject,
      body: plainText,
      html,
      metadata: {
        type: 'EXPIRY_ALERT',
        storeId,
        totalBatches: scanResult.totalBatches,
        totalUnits: scanResult.totalUnits,
        totalValuePaise: scanResult.totalValuePaise,
      },
    });

    // Deliver immediately via SMTP worker if Gmail SMTP is configured
    try {
      await OutboxWorker.processOutbox(5);
    } catch (err: any) {
      console.error('[EXPIRY_ALERT] Error processing outbox immediately:', err.message);
    }

    return {
      sent: true,
      recipient: adminEmail,
      totalBatches: scanResult.totalBatches,
      totalUnits: scanResult.totalUnits,
      totalValueRupees: scanResult.totalValueRupees,
    };
  }
}
