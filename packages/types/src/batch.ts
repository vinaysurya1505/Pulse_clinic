export const BatchStatuses = {
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  RECALLED: 'RECALLED',
  DEPLETED: 'DEPLETED',
} as const;

export type BatchStatus = (typeof BatchStatuses)[keyof typeof BatchStatuses];

export const StockMovementTypes = {
  INITIAL_STOCK: 'INITIAL_STOCK',
  PURCHASE_RECEIPT: 'PURCHASE_RECEIPT',
  SALE: 'SALE',
  SALE_RETURN: 'SALE_RETURN',
  ADJUSTMENT_ADD: 'ADJUSTMENT_ADD',
  ADJUSTMENT_SUBTRACT: 'ADJUSTMENT_SUBTRACT',
  DAMAGE: 'DAMAGE',
  EXPIRED: 'EXPIRED',
} as const;

export type StockMovementType = (typeof StockMovementTypes)[keyof typeof StockMovementTypes];

export interface BatchInventory {
  id: string;
  storeId: string;
  medicineId: string;
  medicineBrandName?: string;
  medicineGenericName?: string;
  dosageForm?: string;
  strength?: string;
  batchNumber: string;
  expiryDate: string; // YYYY-MM-DD
  mrpPaise: number; // MRP in paise (e.g. 15000 = ₹150.00)
  costPricePaise: number; // Cost in paise
  stockUnits: number; // Current stock in base units (>= 0)
  status: BatchStatus;
  supplierId?: string;
  supplierName?: string;
  rackLocation?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockLedgerEntry {
  id: string;
  storeId: string;
  batchId: string;
  medicineId: string;
  medicineBrandName?: string;
  batchNumber: string;
  movementType: StockMovementType;
  changeUnits: number; // Positive for additions, negative for deductions
  balanceUnitsBefore: number;
  balanceUnitsAfter: number;
  reason: string;
  referenceId?: string; // invoiceId, purchaseOrderId, adjustmentId
  performedBy: string; // UID
  performedByName?: string;
  createdAt: string;
}

export interface CreateBatchInput {
  medicineId: string;
  batchNumber: string;
  expiryDate: string; // YYYY-MM-DD
  mrpPaise: number;
  costPricePaise: number;
  initialStockUnits: number;
  supplierId?: string;
  supplierName?: string;
  rackLocation?: string;
}

export interface StockAdjustmentInput {
  batchId: string;
  adjustmentUnits: number; // Positive to add, negative to subtract
  reason: string;
  movementType?: 'ADJUSTMENT_ADD' | 'ADJUSTMENT_SUBTRACT' | 'DAMAGE' | 'EXPIRED';
}

/**
 * FEFO Expiry Calculation and Status Utilities (ADR-011)
 */

export type ExpiryAlertTier = 'EXPIRED' | 'CRITICAL_30' | 'WARNING_60' | 'ATTENTION_90' | 'VALID';

export function getBatchExpiryStatus(expiryDateStr: string, refDate: Date = new Date()): ExpiryAlertTier {
  const parts = expiryDateStr.split('-');
  if (parts.length < 2) return 'VALID';
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parts.length >= 3 ? parseInt(parts[2], 10) : 28;
  const expDateMidnight = new Date(year, month, day, 0, 0, 0, 0);
  const refMidnight = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 0, 0, 0, 0);

  const diffMs = expDateMidnight.getTime() - refMidnight.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'EXPIRED';
  if (diffDays <= 30) return 'CRITICAL_30';
  if (diffDays <= 60) return 'WARNING_60';
  if (diffDays <= 90) return 'ATTENTION_90';
  return 'VALID';
}

export function isBatchSellable(
  batch: { expiryDate: string; status: BatchStatus; stockUnits: number },
  refDate: Date = new Date()
): boolean {
  if (batch.status !== BatchStatuses.ACTIVE) return false;
  if (batch.stockUnits <= 0) return false;
  const status = getBatchExpiryStatus(batch.expiryDate, refDate);
  return status !== 'EXPIRED';
}

/**
 * Sorts batches by First-Expiry-First-Out (FEFO) order (expiryDate ascending).
 * Batches with earlier expiration date appear first.
 */
export function sortBatchesFEFO<T extends { expiryDate: string; stockUnits: number; status: BatchStatus }>(
  batches: T[]
): T[] {
  return [...batches].sort((a, b) => {
    // 1. Valid sellable items first
    const aValid = a.stockUnits > 0 && a.status === BatchStatuses.ACTIVE;
    const bValid = b.stockUnits > 0 && b.status === BatchStatuses.ACTIVE;
    if (aValid && !bValid) return -1;
    if (!aValid && bValid) return 1;

    // 2. Sort by expiry date ascending
    return a.expiryDate.localeCompare(b.expiryDate);
  });
}
