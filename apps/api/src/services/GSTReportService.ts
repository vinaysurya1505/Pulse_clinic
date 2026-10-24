import { getFirestore } from '../lib/firebase-admin';
import { COLLECTIONS } from '@pulseclinic/config';
import { InvoiceRecord, Gstr1ReportResponse, Gstr1HsnSummaryItem } from '@pulseclinic/types';

export class GSTReportService {
  /**
   * Compiles GSTR-1 HSN summary report for GST portal filing (Prompt 21, DEC-OPEN-01)
   */
  static async compileGstr1Report(
    storeId: string,
    startDate?: string,
    endDate?: string
  ): Promise<Gstr1ReportResponse> {
    const db = getFirestore();
    const invoicesSnapshot = await db.collection(COLLECTIONS.invoices(storeId)).get();

    const start = startDate ? new Date(startDate).toISOString() : '2000-01-01T00:00:00.000Z';
    const end = endDate ? new Date(endDate).toISOString() : '2099-12-31T23:59:59.999Z';

    const hsnMap = new Map<string, Gstr1HsnSummaryItem>();

    let totalTaxableValuePaise = 0;
    let totalCgstPaise = 0;
    let totalSgstPaise = 0;
    let totalIgstPaise = 0;
    let totalInvoicesCount = 0;

    for (const doc of invoicesSnapshot.docs) {
      const inv = doc.data() as InvoiceRecord;

      if (inv.status === 'FINALIZED' && inv.createdAt >= start && inv.createdAt <= end) {
        totalInvoicesCount++;

        for (const item of inv.items || []) {
          const hsn = (item.hsnCode || '300490').trim();
          const desc = item.medicineName || 'Pharmaceutical Preparations';
          const uqc = 'NOS';

          const existing = hsnMap.get(hsn) || {
            hsnCode: hsn,
            description: desc,
            uqc,
            totalQuantity: 0,
            totalValuePaise: 0,
            taxableValuePaise: 0,
            igstPaise: 0,
            cgstPaise: 0,
            sgstPaise: 0,
            cessPaise: 0,
          };

          existing.totalQuantity += item.quantityUnits;
          existing.totalValuePaise += item.lineTotalPaise;
          existing.taxableValuePaise += item.taxablePaise;
          existing.cgstPaise += item.cgstPaise;
          existing.sgstPaise += item.sgstPaise;
          existing.igstPaise += item.igstPaise;

          totalTaxableValuePaise += item.taxablePaise;
          totalCgstPaise += item.cgstPaise;
          totalSgstPaise += item.sgstPaise;
          totalIgstPaise += item.igstPaise;

          hsnMap.set(hsn, existing);
        }
      }
    }

    const hsnSummary = Array.from(hsnMap.values()).sort((a, b) => a.hsnCode.localeCompare(b.hsnCode));

    return {
      storeId,
      gstin: '29AABCU9603R1ZM',
      startDate: start.split('T')[0],
      endDate: end.split('T')[0],
      totalInvoicesCount,
      totalTaxableValuePaise,
      totalCgstPaise,
      totalSgstPaise,
      totalIgstPaise,
      hsnSummary,
    };
  }

  /**
   * Generates government GST portal compliant CSV string
   */
  static generateGstr1Csv(report: Gstr1ReportResponse): string {
    const headers = [
      'HSN',
      'Description',
      'UQC',
      'Total Quantity',
      'Total Value (INR)',
      'Taxable Value (INR)',
      'Integrated Tax (INR)',
      'Central Tax (INR)',
      'State/UT Tax (INR)',
      'Cess (INR)',
    ];

    const rows = report.hsnSummary.map((hsn) => [
      hsn.hsnCode,
      `"${hsn.description.replace(/"/g, '""')}"`,
      hsn.uqc,
      hsn.totalQuantity.toString(),
      (hsn.totalValuePaise / 100).toFixed(2),
      (hsn.taxableValuePaise / 100).toFixed(2),
      (hsn.igstPaise / 100).toFixed(2),
      (hsn.cgstPaise / 100).toFixed(2),
      (hsn.sgstPaise / 100).toFixed(2),
      '0.00',
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
}
