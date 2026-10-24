import {
  getBatchExpiryStatus,
  isBatchSellable,
  sortBatchesFEFO,
  BatchStatuses,
} from './batch';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('Running Batch & FEFO Selection Engine Tests (ADR-011)...');

const mockToday = new Date('2026-10-24T00:00:00.000Z');

// Test 1: Expiry tier calculations
assert(
  getBatchExpiryStatus('2026-10-20', mockToday) === 'EXPIRED',
  'Past date must evaluate to EXPIRED'
);
assert(
  getBatchExpiryStatus('2026-10-24', mockToday) === 'EXPIRED',
  'Today must evaluate to EXPIRED (strictly non-sellable on expiry date)'
);
assert(
  getBatchExpiryStatus('2026-11-10', mockToday) === 'CRITICAL_30',
  '17 days away must evaluate to CRITICAL_30 (<30 days)'
);
assert(
  getBatchExpiryStatus('2026-12-15', mockToday) === 'WARNING_60',
  '52 days away must evaluate to WARNING_60 (<60 days)'
);
assert(
  getBatchExpiryStatus('2027-01-15', mockToday) === 'ATTENTION_90',
  '83 days away must evaluate to ATTENTION_90 (<90 days)'
);
assert(
  getBatchExpiryStatus('2027-06-30', mockToday) === 'VALID',
  'Over 90 days away must evaluate to VALID'
);

// Test 2: Sellability check
assert(
  isBatchSellable(
    { expiryDate: '2027-05-01', status: BatchStatuses.ACTIVE, stockUnits: 50 },
    mockToday
  ) === true,
  'Valid active batch with stock must be sellable'
);
assert(
  isBatchSellable(
    { expiryDate: '2026-10-20', status: BatchStatuses.ACTIVE, stockUnits: 50 },
    mockToday
  ) === false,
  'Expired batch must NOT be sellable'
);
assert(
  isBatchSellable(
    { expiryDate: '2027-05-01', status: BatchStatuses.ACTIVE, stockUnits: 0 },
    mockToday
  ) === false,
  'Zero stock batch must NOT be sellable'
);
assert(
  isBatchSellable(
    { expiryDate: '2027-05-01', status: BatchStatuses.RECALLED, stockUnits: 50 },
    mockToday
  ) === false,
  'Recalled batch must NOT be sellable'
);

// Test 3: FEFO ordering
const batches = [
  { id: 'b3', expiryDate: '2027-12-31', stockUnits: 100, status: BatchStatuses.ACTIVE },
  { id: 'b1', expiryDate: '2026-11-30', stockUnits: 20, status: BatchStatuses.ACTIVE },
  { id: 'b2', expiryDate: '2027-06-30', stockUnits: 50, status: BatchStatuses.ACTIVE },
];
const sorted = sortBatchesFEFO(batches);
assert(sorted[0].id === 'b1', 'FEFO: earliest expiry (2026-11-30) must be first');
assert(sorted[1].id === 'b2', 'FEFO: middle expiry (2027-06-30) must be second');
assert(sorted[2].id === 'b3', 'FEFO: latest expiry (2027-12-31) must be third');

console.log('✅ ALL FEFO & EXPIRY ENGINE TESTS PASSED (100% SUCCESS)');
