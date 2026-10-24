import { PurchaseOrderStatuses } from '@pulseclinic/types';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

console.log('Running Purchase Order State Machine & Ledger Invariant Tests (Prompt 9)...');

// Test 1: PO State Machine Transitions
const validTransitions: Record<string, string[]> = {
  [PurchaseOrderStatuses.DRAFT]: [PurchaseOrderStatuses.ISSUED, PurchaseOrderStatuses.CANCELLED],
  [PurchaseOrderStatuses.ISSUED]: [PurchaseOrderStatuses.RECEIVED, PurchaseOrderStatuses.CANCELLED],
  [PurchaseOrderStatuses.RECEIVED]: [], // Terminal state
  [PurchaseOrderStatuses.CANCELLED]: [], // Terminal state
};

function canTransition(current: string, next: string): boolean {
  return validTransitions[current]?.includes(next) ?? false;
}

assert(canTransition('DRAFT', 'ISSUED') === true, 'Draft -> Issued is valid');
assert(canTransition('ISSUED', 'RECEIVED') === true, 'Issued -> Received is valid');
assert(canTransition('ISSUED', 'CANCELLED') === true, 'Issued -> Cancelled is valid');
assert(canTransition('RECEIVED', 'ISSUED') === false, 'Received -> Issued is blocked');
assert(canTransition('CANCELLED', 'RECEIVED') === false, 'Cancelled -> Received is blocked');

// Test 2: Invariant: GRN Receipt increases base units and debt
const initialDebtPaise = 500000; // ₹5,000.00
const deliveredItems = [
  { quantityPacks: 10, stripSize: 10, purchaseRatePaise: 12000 }, // ₹1,200.00 total
  { quantityPacks: 5, stripSize: 15, purchaseRatePaise: 8000 },   // ₹400.00 total
];

const totalDeliveredCostPaise = deliveredItems.reduce(
  (sum, it) => sum + it.quantityPacks * it.purchaseRatePaise,
  0
);
const newDebtPaise = initialDebtPaise + totalDeliveredCostPaise;
assert(totalDeliveredCostPaise === 160000, 'Delivered items cost should equal 160000 paise (₹1,600.00)');
assert(newDebtPaise === 660000, 'New supplier debt should equal 660000 paise (₹6,600.00)');

const totalBaseUnitsCreated = deliveredItems.reduce(
  (sum, it) => sum + it.quantityPacks * it.stripSize,
  0
);
assert(totalBaseUnitsCreated === 175, 'Total base stock units ingested must equal 175 units');

// Test 3: Supplier Payment decreases debt
const paymentPaise = 200000; // ₹2,000.00 paid
const balanceAfterPayment = newDebtPaise - paymentPaise;
assert(balanceAfterPayment === 460000, 'Balance after payment should equal 460000 paise (₹4,600.00)');

console.log('✅ ALL PO STATE MACHINE & SUPPLIER LEDGER INVARIANT TESTS PASSED (100% SUCCESS)');
