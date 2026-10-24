import { parseDecimalToPaise, formatPaiseToDecimal, formatPaiseToINR } from './money';
function assert(cond, msg) {
    if (!cond)
        throw new Error(`Assertion failed: ${msg}`);
}
console.log('Running Monetary Integer-Paise Precision Tests (ADR-008)...');
assert(parseDecimalToPaise('10.50') === 1050, '10.50 must equal 1050 paise');
assert(parseDecimalToPaise('40.00') === 4000, '40.00 must equal 4000 paise');
assert(parseDecimalToPaise('0.05') === 5, '0.05 must equal 5 paise');
assert(parseDecimalToPaise('0.5') === 50, '0.5 must equal 50 paise');
assert(parseDecimalToPaise('100') === 10000, '100 must equal 10000 paise');
assert(parseDecimalToPaise('₹ 1,250.75') === 125075, '₹ 1,250.75 must equal 125075 paise');
assert(parseDecimalToPaise(40) === 4000, 'Number 40 must equal 4000 paise');
assert(formatPaiseToDecimal(1050) === '10.50', 'Format 1050 -> 10.50');
assert(formatPaiseToDecimal(5) === '0.05', 'Format 5 -> 0.05');
assert(formatPaiseToINR(125075) === '₹1250.75', 'Format INR');
console.log('✅ ALL MONETARY TESTS PASSED (ADR-008 VERIFIED)');
//# sourceMappingURL=money.test.js.map