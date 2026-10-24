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
  ScheduleCategory,
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

export class CSVImportEngine {
  /**
   * Fast, reliable RFC 4180 CSV parser handling quoted fields, commas, and line endings.
   */
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
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
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

    const headers = splitLine(lines[0]).map((h) => h.replace(/^["']|["']$/g, '').trim());
    const rows: ParsedCSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = splitLine(lines[i]);
      const rowData: Record<string, string> = {};
      headers.forEach((h, idx) => {
        const val = values[idx] || '';
        rowData[h] = val.replace(/^["']|["']$/g, '').trim();
      });
      rows.push({ rowNumber: i + 1, data: rowData });
    }

    return { headers, rows };
  }

  /**
   * Generates SHA-256 checksum of CSV content for idempotency (ADR-013)
   */
  static computeHash(content: string): string {
    return crypto.createHash('sha256').update(content.trim()).digest('hex');
  }

  /**
   * Validates row headers and normalizes key names (case-insensitive)
   */
  static normalizeRow(raw: Record<string, string>): Record<string, string> {
    const norm: Record<string, string> = {};
    for (const [key, val] of Object.entries(raw)) {
      const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      norm[cleanKey] = val;
    }
    return norm;
  }

  /**
   * Previews CSV, validates row schemas, and detects errors before writing to DB
   */
  static preview(csvText: string): CSVPreviewResult {
    const { headers, rows } = this.parseCSV(csvText);
    const fileHash = this.computeHash(csvText);

    const validationErrors: ImportRowError[] = [];
    const validRows: Array<Record<string, unknown>> = [];

    rows.forEach((r) => {
      const norm = this.normalizeRow(r.data);
      const brand = norm['brandname'] || norm['brand'] || norm['name'] || '';
      const generic = norm['genericname'] || norm['generic'] || norm['molecule'] || '';

      if (!brand) {
        validationErrors.push({
          rowNumber: r.rowNumber,
          rawRow: r.data,
          field: 'brandName',
          message: 'Brand Name is mandatory.',
        });
        return;
      }
      if (!generic) {
        validationErrors.push({
          rowNumber: r.rowNumber,
          rawRow: r.data,
          field: 'genericName',
          message: 'Generic Name is mandatory.',
        });
        return;
      }

      // Check batch validation if batch fields are present
      const batchNo = norm['batchnumber'] || norm['batch'] || norm['batchno'] || '';
      const expDate = norm['expirydate'] || norm['expiry'] || norm['exp'] || '';
      if (batchNo && !expDate) {
        validationErrors.push({
          rowNumber: r.rowNumber,
          rawRow: r.data,
          field: 'expiryDate',
          message: 'Expiry date (YYYY-MM-DD) is required when batch number is specified.',
        });
        return;
      }

      validRows.push({
        rowNumber: r.rowNumber,
        brandName: brand,
        genericName: generic,
        category: norm['category'] || 'Other',
        dosageForm: norm['dosageform'] || 'Tablet',
        strength: norm['strength'] || 'Standard',
        stripSize: parseInt(norm['stripsize'] || norm['packsize'] || '10', 10) || 10,
        batchNumber: batchNo || undefined,
        expiryDate: expDate || undefined,
        mrp: norm['mrp'] || undefined,
      });
    });

    return {
      totalRows: rows.length,
      validRowsCount: validRows.length,
      errorRowsCount: validationErrors.length,
      headers,
      samplePreview: validRows.slice(0, 10),
      validationErrors,
      fileHash,
    };
  }

  /**
   * Commits the CSV import with dynamic write-budget chunking (ADR-013)
   */
  static async commit(
    storeId: string,
    csvText: string,
    userId: string,
    userName?: string
  ): Promise<ImportJob> {
    const db = getFirestore();
    const fileHash = this.computeHash(csvText);

    // 1. Idempotency Check: prevent duplicate double-imports
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
      errors: [],
      createdAt: now,
      updatedAt: now,
    };

    await jobDocRef.set(jobRecord);

    const CHUNK_SIZE = 25; // Max 25 rows per batch chunk (ADR-013)
    let processedRows = 0;
    let successCount = 0;
    const errors: ImportRowError[] = [];

    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const batch = db.batch();

      for (const row of chunk) {
        try {
          const norm = this.normalizeRow(row.data);
          const brandName = norm['brandname'] || norm['brand'] || norm['name'];
          const genericName = norm['genericname'] || norm['generic'] || norm['molecule'];

          if (!brandName || !genericName) {
            throw new Error('Brand name and Generic molecule name are required');
          }

          // Parse unit & packaging
          const rawBaseUnit = (norm['baseunit'] || 'TABLET').toUpperCase();
          const baseUnit = (BaseUnits as Record<string, BaseUnit>)[rawBaseUnit] || BaseUnits.TABLET;
          const stripSize = Math.max(1, parseInt(norm['stripsize'] || norm['packsize'] || '10', 10) || 10);
          const looseRaw = (norm['allowloosesales'] || norm['loosesales'] || 'true').toLowerCase();
          const allowLooseSales = looseRaw === 'true' || looseRaw === '1' || looseRaw === 'yes';

          // Regulatory schedule & GST
          const schedRaw = (norm['schedulecategory'] || norm['schedule'] || 'NONE').toUpperCase();
          const scheduleCategory = (ScheduleCategories as Record<string, ScheduleCategory>)[schedRaw] || ScheduleCategories.NONE;
          const gstPercentRaw = norm['gstratepercent'] || norm['gstpercent'] || norm['gst'] || '12';
          const gstRateBps = Math.round(parseFloat(gstPercentRaw.replace('%', '')) * 100) || 1200;

          // 1. Create Medicine Doc
          const medDocRef = db.collection(COLLECTIONS.medicines(storeId)).doc();
          const medicineData: MedicineMaster = {
            id: medDocRef.id,
            storeId,
            brandName: brandName.trim(),
            genericName: genericName.trim(),
            category: norm['category'] || 'Other',
            dosageForm: norm['dosageform'] || 'Tablet',
            strength: norm['strength'] || '',
            manufacturer: norm['manufacturer'] || undefined,
            hsnCode: norm['hsncode'] || '3004',
            gstRateBps,
            baseUnit,
            stripSize,
            allowLooseSales,
            scheduleCategory,
            rackLocation: norm['racklocation'] || norm['rack'] || undefined,
            barcode: norm['barcode'] || undefined,
            reorderLevelUnits: parseInt(norm['reorderlevelunits'] || '50', 10) || 50,
            isArchived: false,
            createdAt: now,
            updatedAt: now,
          };
          batch.set(medDocRef, medicineData);

          // 2. Optional Batch & Stock Ledger
          const batchNumber = norm['batchnumber'] || norm['batch'] || norm['batchno'];
          const expiryDate = norm['expirydate'] || norm['expiry'] || norm['exp'];

          if (batchNumber && expiryDate) {
            const rawMrp = norm['mrp'] || '100.00';
            const rawCost = norm['costprice'] || norm['cost'] || '70.00';
            const mrpPaise = parseDecimalToPaise(rawMrp);
            const costPricePaise = parseDecimalToPaise(rawCost);
            const initialStockUnits = parseInt(norm['initialstockunits'] || norm['stock'] || '50', 10) || 0;

            const isExpired = getBatchExpiryStatus(expiryDate) === 'EXPIRED';

            const batchDocRef = db.collection(COLLECTIONS.batches(storeId)).doc();
            const batchData: BatchInventory = {
              id: batchDocRef.id,
              storeId,
              medicineId: medDocRef.id,
              medicineBrandName: medicineData.brandName,
              medicineGenericName: medicineData.genericName,
              dosageForm: medicineData.dosageForm,
              strength: medicineData.strength,
              batchNumber: batchNumber.trim().toUpperCase(),
              expiryDate: expiryDate.trim(),
              mrpPaise,
              costPricePaise,
              stockUnits: initialStockUnits,
              status: isExpired ? BatchStatuses.EXPIRED : BatchStatuses.ACTIVE,
              rackLocation: medicineData.rackLocation,
              createdAt: now,
              updatedAt: now,
            };
            batch.set(batchDocRef, batchData);

            if (initialStockUnits > 0) {
              const ledgerDocRef = db.collection(COLLECTIONS.stockLedger(storeId)).doc();
              const ledgerEntry: StockLedgerEntry = {
                id: ledgerDocRef.id,
                storeId,
                batchId: batchDocRef.id,
                medicineId: medDocRef.id,
                medicineBrandName: medicineData.brandName,
                batchNumber: batchData.batchNumber,
                movementType: 'INITIAL_STOCK',
                changeUnits: initialStockUnits,
                balanceUnitsBefore: 0,
                balanceUnitsAfter: initialStockUnits,
                reason: `CSV Bulk Ingestion (Job ${jobDocRef.id})`,
                performedBy: userId,
                performedByName: userName || 'Pharmacist',
                createdAt: now,
              };
              batch.set(ledgerDocRef, ledgerEntry);
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

      // Update intermediate progress on job record
      await jobDocRef.update({
        processedRows,
        successCount,
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
      errorCount: errors.length,
      errors,
      updatedAt: new Date().toISOString(),
    };

    await jobDocRef.update({
      status: finalStatus,
      processedRows,
      successCount,
      errorCount: errors.length,
      errors: errors.slice(0, 100),
      updatedAt: finalJob.updatedAt,
    });

    return finalJob;
  }
}
