import { packToUnits, unitsToPacks, calculateUnitPrice, validateLooseSale, } from './medicine';
function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}
console.log('Running Medicine Unit & Pack Conversion Model Tests (ADR-010)...');
// Test 1: packToUnits
assert(packToUnits(1, 10) === 10, '1 pack of 10 should be 10 units');
assert(packToUnits(5, 15) === 75, '5 packs of 15 should be 75 units');
assert(packToUnits(0, 10) === 0, '0 packs should be 0 units');
let threw = false;
try {
    packToUnits(2, 0);
}
catch {
    threw = true;
}
assert(threw, 'stripSize <= 0 must throw error');
// Test 2: unitsToPacks
const res1 = unitsToPacks(25, 10);
assert(res1.fullPacks === 2 && res1.looseUnits === 5, '25 units of 10 should be 2 packs and 5 loose units');
const res2 = unitsToPacks(30, 10);
assert(res2.fullPacks === 3 && res2.looseUnits === 0, '30 units of 10 should be 3 packs and 0 loose units');
const res3 = unitsToPacks(7, 10);
assert(res3.fullPacks === 0 && res3.looseUnits === 7, '7 units of 10 should be 0 packs and 7 loose units');
// Test 3: calculateUnitPrice in integer paise
// 1000 paise (₹10.00) / 10 = 100 paise (₹1.00)
assert(calculateUnitPrice(1000, 10) === 100, '1000 paise for 10 units = 100 paise/unit');
// 1250 paise (₹12.50) / 10 = 125 paise (₹1.25)
assert(calculateUnitPrice(1250, 10) === 125, '1250 paise for 10 units = 125 paise/unit');
// Integer division floor: 105 paise / 10 = 10 paise
assert(calculateUnitPrice(105, 10) === 10, '105 paise for 10 units floor = 10 paise/unit');
// Test 4: validateLooseSale
// Loose sales allowed: any positive unit quantity is valid
assert(validateLooseSale(1, 10, true) === true, '1 unit allowed when loose sales enabled');
assert(validateLooseSale(7, 10, true) === true, '7 units allowed when loose sales enabled');
assert(validateLooseSale(10, 10, true) === true, '10 units allowed when loose sales enabled');
// Loose sales NOT allowed: ONLY exact multiples of stripSize permitted
assert(validateLooseSale(10, 10, false) === true, '10 units (1 strip) allowed when loose sales forbidden');
assert(validateLooseSale(20, 10, false) === true, '20 units (2 strips) allowed when loose sales forbidden');
assert(validateLooseSale(1, 10, false) === false, '1 unit rejected when loose sales forbidden');
assert(validateLooseSale(5, 10, false) === false, '5 units rejected when loose sales forbidden');
assert(validateLooseSale(15, 10, false) === false, '15 units rejected when loose sales forbidden');
assert(validateLooseSale(0, 10, false) === false, '0 units rejected');
assert(validateLooseSale(-5, 10, false) === false, 'Negative units rejected');
console.log('✅ ALL 18 UNIT & PACK CONVERSION TESTS PASSED (100% SUCCESS)');
//# sourceMappingURL=medicine.test.js.map