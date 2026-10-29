import { CSVImportEngine } from './CSVImportEngine';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function runTests() {
  console.log('Running CSV Import Engine Tests...');

  // Test 1: RFC 4180 parsing with quotes and commas
  const csvSample = `Medicine Name,Form,Rack,Units/Strip,MRP/Strip,Batch #,Expiry,Qty
"Augmentin 625 Duo",Tablet,Rack B-1,10,205.50,AUG101,08/2027,100
"Dolo 650",Tablet,Rack A-1,15,31.20,DOL992,12/2026,200`;

  const parsed = CSVImportEngine.parseCSV(csvSample);
  assert(parsed.headers.length === 8, 'Should parse 8 headers');
  assert(parsed.rows.length === 2, 'Should parse 2 rows');
  assert(parsed.rows[0].data['medicinename'] !== undefined || parsed.rows[0].data['brandname'] !== undefined, 'Row 1 has medicine name');
  assert(parsed.rows[1].rowNumber === 3, 'Row 2 is line 3');

  // Test 2: SHA-256 Checksum Idempotency
  const hash1 = CSVImportEngine.computeHash(csvSample);
  const hash2 = CSVImportEngine.computeHash(csvSample);
  assert(hash1 === hash2, 'Hash must be strictly deterministic');
  assert(hash1.length === 64, 'SHA-256 hash length must be 64 characters');

  // Test 3: Validation and Preview (without storeId — no upsert detection)
  const preview = await CSVImportEngine.preview(csvSample);
  assert(preview.totalRows === 2, 'Preview total rows = 2');
  assert(preview.validRowsCount === 2, 'Preview valid rows = 2');
  assert(preview.errorRowsCount === 0, 'Preview error rows = 0');

  // Test 4: Error detection on missing mandatory fields
  const malformedCSV = `Medicine Name,Form,MRP/Strip
,Tablet,50.00
"Crocin",Tablet,30.00`;

  const malformedPreview = await CSVImportEngine.preview(malformedCSV);
  assert(malformedPreview.errorRowsCount === 1, 'Should detect 1 invalid row (missing medicine name)');
  assert(malformedPreview.validationErrors[0].field === 'Medicine Name', 'Row 1 missing Medicine Name');

  console.log('All CSV Import Engine tests passed.');
}

runTests().catch(console.error);
