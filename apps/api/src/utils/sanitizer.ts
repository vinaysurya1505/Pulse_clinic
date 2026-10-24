/**
 * Security and DPDP Compliance Data Sanitizer
 * Implements strict PII masking, input XSS sanitation, and secret scrubbing.
 */

export class Sanitizer {
  /**
   * Masks a 10-digit or 12-digit mobile number, exposing only the last 4 digits.
   * e.g., '9876543210' -> 'XXXXXX3210'
   */
  static maskPhone(phone?: string | null): string {
    if (!phone) return '';
    const clean = phone.replace(/[^0-9]/g, '');
    if (clean.length < 4) return 'XXXX';
    const lastFour = clean.slice(-4);
    return 'X'.repeat(Math.max(0, clean.length - 4)) + lastFour;
  }

  /**
   * Masks an email address to protect personal identifiers.
   * e.g., 'john.doe@example.com' -> 'j***e@example.com'
   */
  static maskEmail(email?: string | null): string {
    if (!email || !email.includes('@')) return '';
    const [user, domain] = email.split('@');
    if (user.length <= 2) {
      return `${user[0]}*@${domain}`;
    }
    const maskedUser = `${user[0]}${'*'.repeat(Math.min(user.length - 2, 5))}${user[user.length - 1]}`;
    return `${maskedUser}@${domain}`;
  }

  /**
   * Masks Aadhaar number according to DPDP compliance (only last 4 digits visible).
   * e.g., '1234-5678-9012' -> 'XXXX-XXXX-9012'
   */
  static maskAadhaar(aadhaar?: string | null): string {
    if (!aadhaar) return '';
    const clean = aadhaar.replace(/[^0-9]/g, '');
    if (clean.length < 4) return 'XXXX-XXXX-XXXX';
    const lastFour = clean.slice(-4);
    return `XXXX-XXXX-${lastFour}`;
  }

  /**
   * Masks PAN number (only last 4 characters visible).
   * e.g., 'ABCDE1234F' -> 'XXXXX1234F'
   */
  static maskPAN(pan?: string | null): string {
    if (!pan) return '';
    const clean = pan.trim().toUpperCase();
    if (clean.length < 5) return 'XXXXX';
    const lastFive = clean.slice(-5);
    return 'X'.repeat(clean.length - 5) + lastFive;
  }

  /**
   * Sanitizes generic string inputs to neutralize XSS and script injection attacks.
   */
  static sanitizeString(input: string): string {
    if (typeof input !== 'string') return input;
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/on\w+='[^']*'/gi, '')
      .replace(/[<>]/g, (match) => (match === '<' ? '&lt;' : '&gt;'))
      .trim();
  }

  /**
   * Deeply scrubs and redacts PII and secrets from arbitrary objects before logging or persistence.
   */
  static redactObject<T>(obj: T): T {
    if (!obj || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map((item) => this.redactObject(item)) as unknown as T;
    }

    const sensitiveKeyPatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /otp/i,
      /privatekey/i,
      /aadhaar(?!lastfour)/i,
      /pan(?!lastfour)/i,
      /cvv/i,
      /cardnumber/i,
    ];

    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      const isSensitive = sensitiveKeyPatterns.some((pattern) => pattern.test(key));

      if (isSensitive) {
        result[key] = '[REDACTED_DPDP_PII]';
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.redactObject(value);
      } else if (typeof value === 'string' && key.toLowerCase().includes('email')) {
        result[key] = this.maskEmail(value);
      } else if (typeof value === 'string' && (key.toLowerCase().includes('phone') || key.toLowerCase().includes('mobile'))) {
        result[key] = this.maskPhone(value);
      } else {
        result[key] = value;
      }
    }

    return result as T;
  }
}
