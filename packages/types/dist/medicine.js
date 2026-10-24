"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScheduleCategories = exports.BaseUnits = void 0;
exports.packToUnits = packToUnits;
exports.unitsToPacks = unitsToPacks;
exports.calculateUnitPrice = calculateUnitPrice;
exports.validateLooseSale = validateLooseSale;
exports.BaseUnits = {
    TABLET: 'TABLET',
    CAPSULE: 'CAPSULE',
    ML: 'ML',
    VIAL: 'VIAL',
    BOTTLE: 'BOTTLE',
    PIECE: 'PIECE',
    SACHET: 'SACHET',
    TUBE: 'TUBE',
};
exports.ScheduleCategories = {
    NONE: 'NONE',
    H: 'H',
    H1: 'H1',
    X: 'X',
};
/**
 * Unit & Pack Conversion Utilities (ADR-010)
 */
/**
 * Converts pack quantities to smallest base units.
 * E.g., 2 packs with stripSize 10 = 20 units.
 */
function packToUnits(packs, stripSize) {
    if (stripSize <= 0)
        throw new Error('stripSize must be greater than 0');
    return Math.floor(packs * stripSize);
}
/**
 * Converts smallest base units into whole packs and loose units.
 * E.g., 25 units with stripSize 10 = { fullPacks: 2, looseUnits: 5 }
 */
function unitsToPacks(units, stripSize) {
    if (stripSize <= 0)
        throw new Error('stripSize must be greater than 0');
    const fullPacks = Math.floor(units / stripSize);
    const looseUnits = units % stripSize;
    return { fullPacks, looseUnits };
}
/**
 * Computes unit price in integer paise given a pack price in integer paise.
 * E.g., 1000 paise (₹10.00) for a 10-unit strip = 100 paise (₹1.00) per unit.
 */
function calculateUnitPrice(packPricePaise, stripSize) {
    if (stripSize <= 0)
        throw new Error('stripSize must be greater than 0');
    return Math.floor(packPricePaise / stripSize);
}
/**
 * Validates whether a requested sale quantity in units is legally permissible
 * given the medicine's loose sales policy.
 */
function validateLooseSale(quantityUnits, stripSize, allowLooseSales) {
    if (stripSize <= 0 || quantityUnits <= 0)
        return false;
    if (allowLooseSales)
        return true;
    // If loose sales are not permitted, the quantity MUST be an exact multiple of the stripSize
    return quantityUnits % stripSize === 0;
}
//# sourceMappingURL=medicine.js.map