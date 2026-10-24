"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAadhaarLastFour = validateAadhaarLastFour;
exports.validatePanLastFour = validatePanLastFour;
exports.formatMaskedAadhaar = formatMaskedAadhaar;
exports.formatMaskedPan = formatMaskedPan;
/**
 * DPDP Compliance Validation (DEC-OPEN-04)
 * Strictly enforces approved last-four digit retention and rejects any raw 12-digit Aadhaar.
 */
function validateAadhaarLastFour(input) {
    if (!input) {
        return { valid: false, error: 'Aadhaar last four digits are required.' };
    }
    const clean = input.trim();
    if (clean.length > 4) {
        return {
            valid: false,
            error: 'Raw Aadhaar numbers are strictly rejected under DPDP compliance. Submit only the approved last 4 digits.',
        };
    }
    if (!/^\d{4}$/.test(clean)) {
        return { valid: false, error: 'Aadhaar last four must contain exactly 4 numeric digits.' };
    }
    return { valid: true };
}
/**
 * DPDP Compliance Validation (DEC-OPEN-04)
 * Strictly enforces approved last-four character retention and rejects any raw 10-character PAN.
 */
function validatePanLastFour(input) {
    if (!input) {
        return { valid: false, error: 'PAN last four characters are required.' };
    }
    const clean = input.trim().toUpperCase();
    if (clean.length > 4) {
        return {
            valid: false,
            error: 'Raw PAN numbers are strictly rejected under DPDP compliance. Submit only the approved last 4 characters.',
        };
    }
    if (!/^[A-Z0-9]{4}$/.test(clean)) {
        return { valid: false, error: 'PAN last four must contain exactly 4 alphanumeric characters.' };
    }
    return { valid: true };
}
/**
 * Displays masked Aadhaar according to DPDP visual presentation standard.
 */
function formatMaskedAadhaar(lastFour) {
    if (!lastFour || lastFour.length < 4)
        return 'XXXX-XXXX-????';
    return `XXXX-XXXX-${lastFour.slice(-4)}`;
}
/**
 * Displays masked PAN according to DPDP visual presentation standard.
 */
function formatMaskedPan(lastFour) {
    if (!lastFour || lastFour.length < 4)
        return 'XXXXXX????';
    return `XXXXXX${lastFour.slice(-4).toUpperCase()}`;
}
//# sourceMappingURL=employee.js.map