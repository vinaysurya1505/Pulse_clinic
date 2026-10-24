/**
 * String Decimal to Integer Paise Parser (ADR-008)
 * Guarantees zero IEEE 754 floating-point errors by using string arithmetic.
 */
export function parseDecimalToPaise(decimalStr: string | number): number {
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

export function formatPaiseToDecimal(paise: number): string {
  const whole = Math.floor(paise / 100);
  const fraction = (paise % 100).toString().padStart(2, '0');
  return `${whole}.${fraction}`;
}

export function formatPaiseToINR(paise: number): string {
  return `₹${formatPaiseToDecimal(paise)}`;
}
