"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDecimalToPaise = parseDecimalToPaise;
exports.formatPaiseToDecimal = formatPaiseToDecimal;
exports.formatPaiseToINR = formatPaiseToINR;
/**
 * String Decimal to Integer Paise Parser (ADR-008)
 * Guarantees zero IEEE 754 floating-point errors by using string arithmetic.
 */
function parseDecimalToPaise(decimalStr) {
    if (typeof decimalStr === 'number') {
        decimalStr = decimalStr.toString();
    }
    const clean = decimalStr.trim().replace(/^₹\s*/, '').replace(/,/g, '');
    if (!clean || isNaN(Number(clean))) {
        throw new Error(`Invalid monetary amount: "${decimalStr}"`);
    }
    const parts = clean.split('.');
    const whole = parseInt(parts[0] || '0', 10);
    let fraction = 0;
    if (parts.length > 1) {
        const fractionStr = parts[1].slice(0, 2).padEnd(2, '0');
        fraction = parseInt(fractionStr, 10);
    }
    const paise = whole * 100 + fraction;
    if (paise < 0) {
        throw new Error(`Monetary amount cannot be negative: "${decimalStr}"`);
    }
    return paise;
}
function formatPaiseToDecimal(paise) {
    const whole = Math.floor(paise / 100);
    const fraction = (paise % 100).toString().padStart(2, '0');
    return `${whole}.${fraction}`;
}
function formatPaiseToINR(paise) {
    return `₹${formatPaiseToDecimal(paise)}`;
}
//# sourceMappingURL=money.js.map