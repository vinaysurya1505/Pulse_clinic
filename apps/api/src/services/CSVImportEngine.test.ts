import { CSVImportEngine } from './CSVImportEngine';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

console.log('Running CSV Import Engine Tests (Prompt 8 & ADR-013)...');

// Test 1: RFC 4180 parsing with quotes and commas
const csvSample = `Brand Name,Generic Name,Category,Dosage Form,Strength,Pack Size,MRP,Batch Number,Expiry Date
"Augmentin 625 Duo","Amoxicillin, Clavulanate","Antibiotics",Tablet,625mg,10,205.50,AUG101,2027-10-31
"Dolo 650","Paracetamol",Analgesic,Tablet,650mg,15,31.20,DOL992,2026-12-31`;

const parsed = CSVImportEngine.parseCSV(csvSample);
assert(parsed.headers.length === 9, 'Should parse 9 headers');
assert(parsed.rows.length === 2, 'Should parse 2 rows');
assert(parsed.rows[0].data['Brand Name'] === 'Augmentin 625 Duo', 'Row 1 Brand Name unquoted');
assert(parsed.rows[0].data['Generic Name'] === 'Amoxicillin, Clavulanate', 'Row 1 comma in quotes handled');
assert(parsed.rows[1].data['Brand Name'] === 'Dolo 650', 'Row 2 Brand Name');

// Test 2: SHA-256 Checksum Idempotency
const hash1 = CSVImportEngine.computeHash(csvSample);
const hash2 = CSVImportEngine.computeHash(csvSample);
assert(hash1 === hash2, 'Hash must be strictly deterministic');
assert(hash1.length === 64, 'SHA-256 hash length must be 64 characters');

// Test 3: Validation and Preview
const preview = CSVImportEngine.preview(csvSample);
assert(preview.totalRows === 2, 'Preview total rows = 2');
assert(preview.validRowsCount === 2, 'Preview valid rows = 2');
assert(preview.errorRowsCount === 0, 'Preview error rows = 0');

// Test 4: Error detection on missing mandatory fields
const malformedCSV = `Brand Name,Generic Name,MRP
,Paracetamol,50.00
"Crocin",,30.00`;

const malformedPreview = CSVImportEngine.preview(malformedCSV);
assert(malformedPreview.errorRowsCount === 2, 'Should detect 2 invalid rows');
assert(malformedPreview.validationErrors[0].field === 'brandName', 'Row 1 missing brandName');
assert(malformedPreview.validationErrors[1].field === 'genericName', 'Row 2 missing genericName');

console.log('✅ ALL CSV IMPORT ENGINE TESTS PASSED (100% SUCCESS)');
