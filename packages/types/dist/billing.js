"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CURRENT_CALCULATION_VERSION = void 0;
exports.calculateBillingQuote = calculateBillingQuote;
exports.CURRENT_CALCULATION_VERSION = 1;
/**
 * Version 1 Billing Calculation Engine (Prompt 11, ADR-007, ADR-008, ADR-009)
 * Pure integer paise arithmetic with zero floating point drift.
 */
function calculateBillingQuote(input) {
    const version = input.calculationVersion || exports.CURRENT_CALCULATION_VERSION;
    const storeState = (input.storeStateCode || '29').trim();
    const customerState = (input.customerStateCode || storeState).trim();
    const isInterState = customerState !== storeState;
    const defaultOverallDiscount = Math.max(0, input.overallDiscountBps || 0);
    const calculatedItems = [];
    const taxSlabMap = new Map();
    let grossTotalPaise = 0;
    let totalDiscountPaise = 0;
    let taxableTotalPaise = 0;
    let cgstTotalPaise = 0;
    let sgstTotalPaise = 0;
    let igstTotalPaise = 0;
    for (const item of input.items) {
        const qty = Math.max(0, Math.floor(item.quantityUnits));
        const unitPrice = Math.max(0, Math.floor(item.unitPricePaise));
        const grossLinePaise = unitPrice * qty;
        const discountBps = item.discountBps !== undefined ? Math.max(0, item.discountBps) : defaultOverallDiscount;
        const discountPaise = Math.round((grossLinePaise * discountBps) / 10000);
        const taxablePaise = Math.max(0, grossLinePaise - discountPaise);
        const gstRateBps = Math.max(0, Math.floor(item.gstRateBps));
        let cgstRateBps = 0;
        let sgstRateBps = 0;
        let igstRateBps = 0;
        let cgstPaise = 0;
        let sgstPaise = 0;
        let igstPaise = 0;
        if (isInterState) {
            igstRateBps = gstRateBps;
            igstPaise = Math.round((taxablePaise * igstRateBps) / 10000);
        }
        else {
            cgstRateBps = Math.floor(gstRateBps / 2);
            sgstRateBps = gstRateBps - cgstRateBps;
            cgstPaise = Math.round((taxablePaise * cgstRateBps) / 10000);
            sgstPaise = Math.round((taxablePaise * sgstRateBps) / 10000);
        }
        const lineTaxPaise = cgstPaise + sgstPaise + igstPaise;
        const lineTotalPaise = taxablePaise + lineTaxPaise;
        grossTotalPaise += grossLinePaise;
        totalDiscountPaise += discountPaise;
        taxableTotalPaise += taxablePaise;
        cgstTotalPaise += cgstPaise;
        sgstTotalPaise += sgstPaise;
        igstTotalPaise += igstPaise;
        // Accumulate in tax slab breakdown
        if (!taxSlabMap.has(gstRateBps)) {
            taxSlabMap.set(gstRateBps, {
                gstRateBps,
                taxablePaise: 0,
                cgstPaise: 0,
                sgstPaise: 0,
                igstPaise: 0,
                totalTaxPaise: 0,
            });
        }
        const slab = taxSlabMap.get(gstRateBps);
        slab.taxablePaise += taxablePaise;
        slab.cgstPaise += cgstPaise;
        slab.sgstPaise += sgstPaise;
        slab.igstPaise += igstPaise;
        slab.totalTaxPaise += lineTaxPaise;
        calculatedItems.push({
            medicineId: item.medicineId,
            batchId: item.batchId,
            medicineName: item.medicineName || 'Medicine',
            hsnCode: item.hsnCode,
            batchNumber: item.batchNumber,
            expiryDate: item.expiryDate,
            quantityUnits: qty,
            unitPricePaise: unitPrice,
            grossLinePaise,
            discountBps,
            discountPaise,
            taxablePaise,
            gstRateBps,
            cgstRateBps,
            sgstRateBps,
            igstRateBps,
            cgstPaise,
            sgstPaise,
            igstPaise,
            lineTaxPaise,
            lineTotalPaise,
        });
    }
    const taxTotalPaise = cgstTotalPaise + sgstTotalPaise + igstTotalPaise;
    const grandTotalPaise = taxableTotalPaise + taxTotalPaise;
    // Round-off to nearest rupee (standard Indian retail billing practice)
    let netPayablePaise = grandTotalPaise;
    let roundOffPaise = 0;
    if (input.roundOffToRupee !== false) {
        netPayablePaise = Math.round(grandTotalPaise / 100) * 100;
        roundOffPaise = netPayablePaise - grandTotalPaise;
    }
    // Doctor commission (DEC-OPEN-02): Configurable toggle, default false
    let doctorCommissionPaise = 0;
    if (input.enableDoctorCommission && input.doctorCommissionBps && input.doctorCommissionBps > 0) {
        doctorCommissionPaise = Math.round((taxableTotalPaise * input.doctorCommissionBps) / 10000);
    }
    const taxSlabs = Array.from(taxSlabMap.values()).sort((a, b) => a.gstRateBps - b.gstRateBps);
    return {
        calculationVersion: version,
        items: calculatedItems,
        grossTotalPaise,
        totalDiscountPaise,
        taxableTotalPaise,
        cgstTotalPaise,
        sgstTotalPaise,
        igstTotalPaise,
        taxTotalPaise,
        grandTotalPaise,
        roundOffPaise,
        netPayablePaise,
        taxSlabs,
        doctorCommissionPaise,
        isInterState,
    };
}
//# sourceMappingURL=billing.js.map