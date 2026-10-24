import { validateAadhaarLastFour, validatePanLastFour, formatMaskedAadhaar, formatMaskedPan, } from './employee';
function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}
console.log('Running DPDP Compliance & Sensitive Data Protection Tests (DEC-OPEN-04, Prompt 10)...');
// Test 1: Aadhaar Last Four Validation
const validAadhaar = validateAadhaarLastFour('4921');
assert(validAadhaar.valid === true, 'Valid 4-digit Aadhaar suffix must be accepted');
assert(!validAadhaar.error, 'Valid Aadhaar suffix must have no error');
// Test 2: Reject Raw 12-digit Aadhaar (REQ-PII-001 / DEC-OPEN-04)
const rawAadhaar = validateAadhaarLastFour('987654324921');
assert(rawAadhaar.valid === false, 'Raw 12-digit Aadhaar must be strictly rejected');
assert(rawAadhaar.error?.includes('Raw Aadhaar numbers are strictly rejected') === true, 'Error message must state raw Aadhaar rejection under DPDP');
// Test 3: Reject non-4-digit Aadhaar
const shortAadhaar = validateAadhaarLastFour('123');
assert(shortAadhaar.valid === false, 'Aadhaar shorter than 4 digits must be rejected');
const alphaAadhaar = validateAadhaarLastFour('12A4');
assert(alphaAadhaar.valid === false, 'Aadhaar with non-numeric chars must be rejected');
const emptyAadhaar = validateAadhaarLastFour('');
assert(emptyAadhaar.valid === false, 'Empty Aadhaar must be rejected');
// Test 4: PAN Last Four Validation
const validPan = validatePanLastFour('921F');
assert(validPan.valid === true, 'Valid 4-char PAN suffix must be accepted');
assert(!validPan.error, 'Valid PAN suffix must have no error');
// Test 5: Reject Raw 10-char PAN
const rawPan = validatePanLastFour('ABCDE1234F');
assert(rawPan.valid === false, 'Raw 10-char PAN must be strictly rejected');
assert(rawPan.error?.includes('Raw PAN numbers are strictly rejected') === true, 'Error message must state raw PAN rejection under DPDP');
// Test 6: Reject non-4-char PAN
const shortPan = validatePanLastFour('92F');
assert(shortPan.valid === false, 'PAN shorter than 4 chars must be rejected');
const emptyPan = validatePanLastFour('');
assert(emptyPan.valid === false, 'Empty PAN must be rejected');
// Test 7: Presentation formatters
assert(formatMaskedAadhaar('4921') === 'XXXX-XXXX-4921', 'Masked Aadhaar must format as XXXX-XXXX-4921');
assert(formatMaskedPan('921f') === 'XXXXXX921F', 'Masked PAN must format uppercase as XXXXXX921F');
assert(formatMaskedAadhaar('') === 'XXXX-XXXX-????', 'Empty Aadhaar must format gracefully');
assert(formatMaskedPan('') === 'XXXXXX????', 'Empty PAN must format gracefully');
console.log('All DPDP Compliance & Employee Sensitive Data tests passed successfully!');
//# sourceMappingURL=employee.test.js.map