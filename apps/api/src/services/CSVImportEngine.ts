import crypto from 'crypto';
import { getFirestore } from '../lib/firebase-admin';
import { COLLECTIONS } from '@pulseclinic/config';
import {
  MedicineMaster,
  BatchInventory,
  StockLedgerEntry,
  BaseUnits,
  ScheduleCategories,
  BaseUnit,
  CSVPreviewResult,
  ImportJob,
  ImportRowError,
  parseDecimalToPaise,
  getBatchExpiryStatus,
  BatchStatuses,
} from '@pulseclinic/types';

export interface ParsedCSVRow {
  rowNumber: number;
  data: Record<string, string>;
}

const HEADER_ALIASES: Record<string, string[]> = {
  brandname: ['brand name', 'medicine name', 'name', 'brand', 'medicine', 'brandname'],
  dosageform: ['form', 'dosage form', 'dosageform', 'type', 'medicine form'],
  racklocation: ['rack', 'rack location', 'racklocation', 'shelf', 'location'],
  stripsize: ['units/strip', 'units per strip', 'pack size', 'strip size', 'stripsize', 'packsize', 'unitperstrip'],
  mrp: ['mrp', 'mrp/strip', 'mrp per strip', 'price', 'mrprupees', 'mrp rupees'],
  batchnumber: ['batch #', 'batch no', 'batch number', 'batchnumber', 'batch', 'batchno'],
  expirydate: ['expiry', 'expiry date', 'expirydate', 'exp', 'exp date'],
  initialstockunits: ['qty', 'quantity', 'stock', 'initial stock', 'initialstock', 'initialstockunits', 'stock qty'],
  genericname: ['generic name', 'genericname', 'generic', 'molecule', 'salt', 'salt name'],
  category: ['category', 'therapeutic category'],
  strength: ['strength', 'dose', 'dosage'],
  manufacturer: ['manufacturer', 'mfr', 'company'],
  costprice: ['cost price', 'costprice', 'cost', 'purchase price'],
};

function resolveHeader(rawHeader: string): string {
  const clean = rawHeader.toLowerCase().replace(/[^a-z0-9/ #]/g, '').trim();
  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) {
      if (clean === alias.replace(/[^a-z0-9/ #]/g, '').trim()) return canonical;
    }
  }
  return clean.replace(/[^a-z0-9]/g, '');
}

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  january: '01', february: '02', march: '03', april: '04', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
};

function normalizeExpiry(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();

  // Standard ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // DD/MM/YYYY or DD-MM-YYYY
  const ddMMYYYY = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddMMYYYY) return `${ddMMYYYY[3]}-${ddMMYYYY[2].padStart(2, '0')}-${ddMMYYYY[1].padStart(2, '0')}`;

  // MM/YYYY or MM-YYYY
  const mmYYYY = trimmed.match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (mmYYYY) return `${mmYYYY[2]}-${mmYYYY[1].padStart(2, '0')}-28`;

  // MM/YY or MM-YY (e.g. 08/27 or 8/27)
  const mmYY = trimmed.match(/^(\d{1,2})[\/\-](\d{2})$/);
  if (mmYY) {
    const month = mmYY[1].padStart(2, '0');
    const year = `20${mmYY[2]}`;
    return `${year}-${month}-28`;
  }

  // Text month formats: Aug-27, Aug-2027, Aug/27, Aug 2027
  const textMonthMatch = trimmed.match(/^([a-zA-Z]{3,9})[\/\-\s]+(\d{2,4})$/);
  if (textMonthMatch) {
    const monthStr = textMonthMatch[1].toLowerCase();
    const month = MONTH_MAP[monthStr];
    let year = textMonthMatch[2];
    if (year.length === 2) year = `20${year}`;
    if (month) return `${year}-${month}-28`;
  }

  // Reverse text month: 27-Aug, 2027-Aug
  const revTextMonthMatch = trimmed.match(/^(\d{2,4})[\/\-\s]+([a-zA-Z]{3,9})$/);
  if (revTextMonthMatch) {
    const monthStr = revTextMonthMatch[2].toLowerCase();
    const month = MONTH_MAP[monthStr];
    let year = revTextMonthMatch[1];
    if (year.length === 2) year = `20${year}`;
    if (month) return `${year}-${month}-28`;
  }

  // Fallback: try parsing with native Date
  const parsedDate = new Date(trimmed);
  if (!isNaN(parsedDate.getTime())) {
    const y = parsedDate.getFullYear();
    const m = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const d = String(parsedDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return trimmed;
}

function deriveBaseUnit(dosageForm: string): string {
  const f = dosageForm.toLowerCase();
  if (f.includes('tablet') || f.includes('tab')) return BaseUnits.TABLET;
  if (f.includes('capsule') || f.includes('cap')) return BaseUnits.CAPSULE;
  if (f.includes('syrup') || f.includes('liquid') || f.includes('solution') || f.includes('suspension') || f.includes('drop')) return BaseUnits.BOTTLE;
  if (f.includes('cream') || f.includes('ointment') || f.includes('gel')) return BaseUnits.TUBE;
  if (f.includes('injection') || f.includes('vial') || f.includes('ampoule')) return BaseUnits.VIAL;
  if (f.includes('sachet') || f.includes('powder') || f.includes('granule')) return BaseUnits.SACHET;
  return BaseUnits.PIECE;
}

export class CSVImportEngine {
  static parseCSV(csvText: string): { headers: string[]; rows: ParsedCSVRow[] } {
    const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length === 0) return { headers: [], rows: [] };

    const splitLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
          else inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const rawHeaders = splitLine(lines[0]).map((h) => h.replace(/^["']|["']$/g, '').trim());
    const resolvedHeaders = rawHeaders.map(resolveHeader);
    const rows: ParsedCSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = splitLine(lines[i]);
      const rowData: Record<string, string> = {};
      resolvedHeaders.forEach((h, idx) => {
        const val = values[idx] || '';
        rowData[h] = val.replace(/^["']|["']$/g, '').trim();
      });
      rows.push({ rowNumber: i + 1, data: rowData });
    }

    return { headers: rawHeaders, rows };
  }

  static computeHash(content: string): string {
    return crypto.createHash('sha256').update(content.trim()).digest('hex');
  }

  static async preview(csvText: string, storeId?: string): Promise<CSVPreviewResult> {
    const { headers, rows } = this.parseCSV(csvText);
    const fileHash = this.computeHash(csvText);

    const validationErrors: ImportRowError[] = [];
    const validRows: Array<Record<string, unknown>> = [];

    // Build existing medicine index for upsert detection
    let existingIndex: Map<string, string> = new Map();
    if (storeId) {
      try {
        const db = getFirestore();
        const medsSnap = await db.collection(COLLECTIONS.medicines(storeId))
          .where('isArchived', '==', false).get();
        medsSnap.docs.forEach((doc) => {
          const data = doc.data();
          if (data.brandName) {
            existingIndex.set(data.brandName.toLowerCase().trim(), doc.id);
          }
        });
      } catch { /* ignore */ }
    }

    let createdCount = 0;
    let updatedCount = 0;

    rows.forEach((r) => {
      const d = r.data;
      const brand = d['brandname'] || '';
      if (!brand) {
        validationErrors.push({ rowNumber: r.rowNumber, rawRow: r.data, field: 'Medicine Name', message: 'Medicine Name is required.' });
        return;
      }

      const batchNo = d['batchnumber'] || '';
      const expDate = d['expirydate'] || '';
      const mrpRaw = d['mrp'] || '';

      if (batchNo && !expDate) {
        validationErrors.push({ rowNumber: r.rowNumber, rawRow: r.data, field: 'Expiry', message: 'Expiry date is required when Batch # is specified.' });
        return;
      }
      if (batchNo && !mrpRaw) {
        validationErrors.push({ rowNumber: r.rowNumber, rawRow: r.data, field: 'MRP', message: 'MRP is required when Batch # is specified.' });
        return;
      }

      const isUpdate = existingIndex.has(brand.toLowerCase().trim());
      if (isUpdate) updatedCount++;
      else createdCount++;

      validRows.push({
        rowNumber: r.rowNumber,
        action: isUpdate ? 'UPDATE' : 'CREATE',
        brandName: brand,
        dosageForm: d['dosageform'] || 'Tablet',
        rackLocation: d['racklocation'] || '',
        stripSize: parseInt(d['stripsize'] || '10', 10) || 10,
        mrp: mrpRaw || undefined,
        batchNumber: batchNo || undefined,
        expiryDate: expDate ? normalizeExpiry(expDate) : undefined,
        qty: d['initialstockunits'] || '1',
      });
    });

    return {
      totalRows: rows.length,
      validRowsCount: validRows.length,
      errorRowsCount: validationErrors.length,
      headers,
      samplePreview: validRows.slice(0, 20),
      validationErrors,
      fileHash,
      createdCount,
      updatedCount,
    };
  }

  static async commit(
    storeId: string,
    csvText: string,
    userId: string,
    userName?: string
  ): Promise<ImportJob> {
    const db = getFirestore();
    const fileHash = this.computeHash(csvText);

    const existingJob = await db
      .collection(COLLECTIONS.importJobs(storeId))
      .where('fileHash', '==', fileHash)
      .where('status', '==', 'COMPLETED')
      .limit(1)
      .get();

    if (!existingJob.empty) {
      const prev = existingJob.docs[0].data() as ImportJob;
      throw new Error(
        `DUPLICATE_IMPORT: This file was already successfully imported on ${new Date(prev.createdAt).toLocaleDateString()} (Job ID: ${prev.id}).`
      );
    }

    const { rows } = this.parseCSV(csvText);
    const jobDocRef = db.collection(COLLECTIONS.importJobs(storeId)).doc();
    const now = new Date().toISOString();

    const jobRecord: ImportJob = {
      id: jobDocRef.id,
      storeId,
      importType: 'MEDICINES',
      fileHash,
      status: 'PROCESSING',
      totalRows: rows.length,
      processedRows: 0,
      successCount: 0,
      errorCount: 0,
      createdCount: 0,
      updatedCount: 0,
      errors: [],
      createdAt: now,
      updatedAt: now,
    };

    await jobDocRef.set(jobRecord);

    // Build existing medicine index for upsert
    const existingMeds: Map<string, { id: string; data: MedicineMaster }> = new Map();
    const medsSnap = await db.collection(COLLECTIONS.medicines(storeId))
      .where('isArchived', '==', false).get();
    medsSnap.docs.forEach((doc) => {
      const data = doc.data() as MedicineMaster;
      if (data.brandName) {
        existingMeds.set(data.brandName.toLowerCase().trim(), { id: doc.id, data });
      }
    });

    // Build existing batch index per medicine
    const existingBatches: Map<string, Map<string, { id: string; stockUnits: number }>> = new Map();
    const batchesSnap = await db.collection(COLLECTIONS.batches(storeId)).get();
    batchesSnap.docs.forEach((doc) => {
      const b = doc.data();
      if (!b.medicineId) return;
      if (!existingBatches.has(b.medicineId)) existingBatches.set(b.medicineId, new Map());
      existingBatches.get(b.medicineId)!.set(
        (b.batchNumber || '').toUpperCase().trim(),
        { id: doc.id, stockUnits: b.stockUnits || 0 }
      );
    });

    const CHUNK_SIZE = 25;
    let processedRows = 0;
    let successCount = 0;
    let createdCount = 0;
    let updatedCount = 0;
    const errors: ImportRowError[] = [];

    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const batch = db.batch();

      for (const row of chunk) {
        try {
          const d = row.data;
          const brandName = (d['brandname'] || '').trim();
          if (!brandName) throw new Error('Medicine Name is required');

          const dosageForm = d['dosageform'] || 'Tablet';
          const rackLocation = d['racklocation'] || '';
          const stripSize = Math.max(1, parseInt(d['stripsize'] || '10', 10) || 10);
          const baseUnit = deriveBaseUnit(dosageForm) as BaseUnit;
          const genericName = d['genericname'] || brandName;
          const category = d['category'] || 'Other';
          const strength = d['strength'] || '';

          const existing = existingMeds.get(brandName.toLowerCase().trim());
          let medicineId: string;

          if (existing) {
            // UPDATE existing medicine fields
            medicineId = existing.id;
            const updateFields: Record<string, unknown> = { updatedAt: now };
            if (dosageForm && dosageForm !== 'Tablet') updateFields.dosageForm = dosageForm;
            if (rackLocation) updateFields.rackLocation = rackLocation;
            if (stripSize !== 10) updateFields.stripSize = stripSize;
            batch.update(db.collection(COLLECTIONS.medicines(storeId)).doc(medicineId), updateFields);
            updatedCount++;
          } else {
            // CREATE new medicine
            const medDocRef = db.collection(COLLECTIONS.medicines(storeId)).doc();
            medicineId = medDocRef.id;
            const medicineData: Record<string, unknown> = {
              id: medicineId,
              storeId,
              brandName,
              genericName,
              category,
              dosageForm,
              strength,
              hsnCode: '3004',
              gstRateBps: 0,
              baseUnit,
              stripSize,
              allowLooseSales: true,
              scheduleCategory: ScheduleCategories.NONE,
              reorderLevelUnits: 50,
              isArchived: false,
              createdAt: now,
              updatedAt: now,
            };
            if (d['manufacturer'] && d['manufacturer'].trim()) {
              medicineData.manufacturer = d['manufacturer'].trim();
            }
            if (rackLocation) {
              medicineData.rackLocation = rackLocation;
            }
            if (d['barcode'] && d['barcode'].trim()) {
              medicineData.barcode = d['barcode'].trim();
            }

            batch.set(medDocRef, medicineData as unknown as MedicineMaster);
            existingMeds.set(brandName.toLowerCase().trim(), { id: medicineId, data: medicineData as unknown as MedicineMaster });
            createdCount++;
          }

          // Handle batch if batch fields provided
          const batchNumber = (d['batchnumber'] || '').trim().toUpperCase();
          const expiryRaw = d['expirydate'] || '';
          const mrpRaw = d['mrp'] || '';

          if (batchNumber && expiryRaw) {
            const expiryDate = normalizeExpiry(expiryRaw);
            const mrpPaise = mrpRaw ? parseDecimalToPaise(mrpRaw) : 10000;
            const costRaw = d['costprice'] || '';
            const costPricePaise = costRaw ? parseDecimalToPaise(costRaw) : mrpPaise;
            const initialStockUnits = parseInt(d['initialstockunits'] || '1', 10) || 1;
            const isExpired = getBatchExpiryStatus(expiryDate) === 'EXPIRED';

            const medBatches = existingBatches.get(medicineId);
            const existingBatch = medBatches?.get(batchNumber);

            if (existingBatch) {
              // UPDATE existing batch — add stock
              const newStock = existingBatch.stockUnits + initialStockUnits;
              const batchUpdateData: Record<string, unknown> = {
                stockUnits: newStock,
                mrpPaise,
                costPricePaise,
                expiryDate,
                updatedAt: now,
              };
              if (rackLocation) {
                batchUpdateData.rackLocation = rackLocation;
              }
              batch.update(db.collection(COLLECTIONS.batches(storeId)).doc(existingBatch.id), batchUpdateData);

              if (initialStockUnits > 0) {
                const ledgerRef = db.collection(COLLECTIONS.stockLedger(storeId)).doc();
                const ledgerEntry: StockLedgerEntry = {
                  id: ledgerRef.id,
                  storeId,
                  batchId: existingBatch.id,
                  medicineId,
                  medicineBrandName: brandName,
                  batchNumber,
                  movementType: 'INITIAL_STOCK',
                  changeUnits: initialStockUnits,
                  balanceUnitsBefore: existingBatch.stockUnits,
                  balanceUnitsAfter: newStock,
                  reason: `CSV Bulk Update (Job ${jobDocRef.id})`,
                  performedBy: userId,
                  performedByName: userName || 'Pharmacist',
                  createdAt: now,
                };
                batch.set(ledgerRef, ledgerEntry);
              }
              existingBatch.stockUnits += initialStockUnits;
            } else {
              // CREATE new batch
              const batchDocRef = db.collection(COLLECTIONS.batches(storeId)).doc();
              const batchData: Record<string, unknown> = {
                id: batchDocRef.id,
                storeId,
                medicineId,
                medicineBrandName: brandName,
                medicineGenericName: genericName,
                dosageForm,
                strength,
                batchNumber,
                expiryDate,
                mrpPaise,
                costPricePaise,
                stockUnits: initialStockUnits,
                status: isExpired ? BatchStatuses.EXPIRED : BatchStatuses.ACTIVE,
                createdAt: now,
                updatedAt: now,
              };
              if (rackLocation) {
                batchData.rackLocation = rackLocation;
              }
              batch.set(batchDocRef, batchData as unknown as BatchInventory);

              if (initialStockUnits > 0) {
                const ledgerRef = db.collection(COLLECTIONS.stockLedger(storeId)).doc();
                const ledgerEntry: StockLedgerEntry = {
                  id: ledgerRef.id,
                  storeId,
                  batchId: batchDocRef.id,
                  medicineId,
                  medicineBrandName: brandName,
                  batchNumber,
                  movementType: 'INITIAL_STOCK',
                  changeUnits: initialStockUnits,
                  balanceUnitsBefore: 0,
                  balanceUnitsAfter: initialStockUnits,
                  reason: `CSV Bulk Import (Job ${jobDocRef.id})`,
                  performedBy: userId,
                  performedByName: userName || 'Pharmacist',
                  createdAt: now,
                };
                batch.set(ledgerRef, ledgerEntry);
              }

              if (!existingBatches.has(medicineId)) existingBatches.set(medicineId, new Map());
              existingBatches.get(medicineId)!.set(batchNumber, { id: batchDocRef.id, stockUnits: initialStockUnits });
            }
          }

          successCount++;
        } catch (err: unknown) {
          errors.push({
            rowNumber: row.rowNumber,
            rawRow: row.data,
            message: err instanceof Error ? err.message : 'Row ingestion failed',
          });
        }
      }

      await batch.commit();
      processedRows += chunk.length;

      await jobDocRef.update({
        processedRows,
        successCount,
        createdCount,
        updatedCount,
        errorCount: errors.length,
        errors: errors.slice(0, 50),
        updatedAt: new Date().toISOString(),
      });
    }

    const finalStatus = errors.length === 0 ? 'COMPLETED' : successCount > 0 ? 'PARTIAL' : 'FAILED';
    const finalJob: ImportJob = {
      ...jobRecord,
      status: finalStatus,
      processedRows,
      successCount,
      createdCount,
      updatedCount,
      errorCount: errors.length,
      errors,
      updatedAt: new Date().toISOString(),
    };

    await jobDocRef.update({
      status: finalStatus,
      processedRows,
      successCount,
      createdCount,
      updatedCount,
      errorCount: errors.length,
      errors: errors.slice(0, 100),
      updatedAt: finalJob.updatedAt,
    });

    return finalJob;
  }
}
