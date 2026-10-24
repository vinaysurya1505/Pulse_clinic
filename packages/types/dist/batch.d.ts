export declare const BatchStatuses: {
    readonly ACTIVE: "ACTIVE";
    readonly EXPIRED: "EXPIRED";
    readonly RECALLED: "RECALLED";
    readonly DEPLETED: "DEPLETED";
};
export type BatchStatus = (typeof BatchStatuses)[keyof typeof BatchStatuses];
export declare const StockMovementTypes: {
    readonly INITIAL_STOCK: "INITIAL_STOCK";
    readonly PURCHASE_RECEIPT: "PURCHASE_RECEIPT";
    readonly SALE: "SALE";
    readonly SALE_RETURN: "SALE_RETURN";
    readonly ADJUSTMENT_ADD: "ADJUSTMENT_ADD";
    readonly ADJUSTMENT_SUBTRACT: "ADJUSTMENT_SUBTRACT";
    readonly DAMAGE: "DAMAGE";
    readonly EXPIRED: "EXPIRED";
};
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
    expiryDate: string;
    mrpPaise: number;
    costPricePaise: number;
    stockUnits: number;
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
    changeUnits: number;
    balanceUnitsBefore: number;
    balanceUnitsAfter: number;
    reason: string;
    referenceId?: string;
    performedBy: string;
    performedByName?: string;
    createdAt: string;
}
export interface CreateBatchInput {
    medicineId: string;
    batchNumber: string;
    expiryDate: string;
    mrpPaise: number;
    costPricePaise: number;
    initialStockUnits: number;
    supplierId?: string;
    supplierName?: string;
    rackLocation?: string;
}
export interface StockAdjustmentInput {
    batchId: string;
    adjustmentUnits: number;
    reason: string;
    movementType?: 'ADJUSTMENT_ADD' | 'ADJUSTMENT_SUBTRACT' | 'DAMAGE' | 'EXPIRED';
}
/**
 * FEFO Expiry Calculation and Status Utilities (ADR-011)
 */
export type ExpiryAlertTier = 'EXPIRED' | 'CRITICAL_30' | 'WARNING_60' | 'ATTENTION_90' | 'VALID';
export declare function getBatchExpiryStatus(expiryDateStr: string, refDate?: Date): ExpiryAlertTier;
export declare function isBatchSellable(batch: {
    expiryDate: string;
    status: BatchStatus;
    stockUnits: number;
}, refDate?: Date): boolean;
/**
 * Sorts batches by First-Expiry-First-Out (FEFO) order (expiryDate ascending).
 * Batches with earlier expiration date appear first.
 */
export declare function sortBatchesFEFO<T extends {
    expiryDate: string;
    stockUnits: number;
    status: BatchStatus;
}>(batches: T[]): T[];
//# sourceMappingURL=batch.d.ts.map