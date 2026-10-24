"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockMovementTypes = exports.BatchStatuses = void 0;
exports.getBatchExpiryStatus = getBatchExpiryStatus;
exports.isBatchSellable = isBatchSellable;
exports.sortBatchesFEFO = sortBatchesFEFO;
exports.BatchStatuses = {
    ACTIVE: 'ACTIVE',
    EXPIRED: 'EXPIRED',
    RECALLED: 'RECALLED',
    DEPLETED: 'DEPLETED',
};
exports.StockMovementTypes = {
    INITIAL_STOCK: 'INITIAL_STOCK',
    PURCHASE_RECEIPT: 'PURCHASE_RECEIPT',
    SALE: 'SALE',
    SALE_RETURN: 'SALE_RETURN',
    ADJUSTMENT_ADD: 'ADJUSTMENT_ADD',
    ADJUSTMENT_SUBTRACT: 'ADJUSTMENT_SUBTRACT',
    DAMAGE: 'DAMAGE',
    EXPIRED: 'EXPIRED',
};
function getBatchExpiryStatus(expiryDateStr, refDate = new Date()) {
    const parts = expiryDateStr.split('-');
    if (parts.length < 2)
        return 'VALID';
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parts.length >= 3 ? parseInt(parts[2], 10) : 28;
    const expDateMidnight = new Date(year, month, day, 0, 0, 0, 0);
    const refMidnight = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 0, 0, 0, 0);
    const diffMs = expDateMidnight.getTime() - refMidnight.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0)
        return 'EXPIRED';
    if (diffDays <= 30)
        return 'CRITICAL_30';
    if (diffDays <= 60)
        return 'WARNING_60';
    if (diffDays <= 90)
        return 'ATTENTION_90';
    return 'VALID';
}
function isBatchSellable(batch, refDate = new Date()) {
    if (batch.status !== exports.BatchStatuses.ACTIVE)
        return false;
    if (batch.stockUnits <= 0)
        return false;
    const status = getBatchExpiryStatus(batch.expiryDate, refDate);
    return status !== 'EXPIRED';
}
/**
 * Sorts batches by First-Expiry-First-Out (FEFO) order (expiryDate ascending).
 * Batches with earlier expiration date appear first.
 */
function sortBatchesFEFO(batches) {
    return [...batches].sort((a, b) => {
        // 1. Valid sellable items first
        const aValid = a.stockUnits > 0 && a.status === exports.BatchStatuses.ACTIVE;
        const bValid = b.stockUnits > 0 && b.status === exports.BatchStatuses.ACTIVE;
        if (aValid && !bValid)
            return -1;
        if (!aValid && bValid)
            return 1;
        // 2. Sort by expiry date ascending
        return a.expiryDate.localeCompare(b.expiryDate);
    });
}
//# sourceMappingURL=batch.js.map