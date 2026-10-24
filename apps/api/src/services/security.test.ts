import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Sanitizer } from '../utils/sanitizer';

describe('Prompt 25: Security Hardening & DPDP Privacy Compliance', () => {
  it('should mask phone numbers to last 4 digits only', () => {
    assert.strictEqual(Sanitizer.maskPhone('9876543210'), 'XXXXXX3210');
    assert.strictEqual(Sanitizer.maskPhone('+919876543210'), 'XXXXXXXX3210');
    assert.strictEqual(Sanitizer.maskPhone(''), '');
  });

  it('should mask email addresses retaining first and last characters', () => {
    assert.strictEqual(Sanitizer.maskEmail('rahul.verma@example.com'), 'r*****a@example.com');
    assert.strictEqual(Sanitizer.maskEmail('me@pulseclinic.in'), 'm*@pulseclinic.in');
  });

  it('should mask Aadhaar numbers leaving only last 4 digits compliant with DPDP', () => {
    assert.strictEqual(Sanitizer.maskAadhaar('1234-5678-9012'), 'XXXX-XXXX-9012');
    assert.strictEqual(Sanitizer.maskAadhaar('987654321098'), 'XXXX-XXXX-1098');
  });

  it('should mask PAN numbers displaying only last 5 characters', () => {
    assert.strictEqual(Sanitizer.maskPAN('ABCDE1234F'), 'XXXXX1234F');
    assert.strictEqual(Sanitizer.maskPAN('abcde1234f'), 'XXXXX1234F');
  });

  it('should sanitize dangerous XSS scripts and HTML tags from user inputs', () => {
    const malicious = '<script>alert("hacked")</script>Paracetamol 500mg';
    const cleaned = Sanitizer.sanitizeString(malicious);
    assert.strictEqual(cleaned.includes('<script>'), false);
    assert.strictEqual(cleaned.includes('Paracetamol 500mg'), true);
  });

  it('should scrub passwords, secrets, tokens, and raw Aadhaar/PAN from audit payloads', () => {
    const rawPayload = {
      actorUid: 'usr_123',
      action: 'EMPLOYEE_CREATED',
      password: 'super_secret_pwd_99',
      apiToken: 'jwt_bearer_token_xyz',
      aadhaarNumber: '123456789012',
      panNumber: 'ABCDE1234F',
      aadhaarLastFour: '9012',
      panLastFour: '1234F',
      email: 'doctor@pulseclinic.in',
      phone: '9876543210',
    };

    const redacted = Sanitizer.redactObject(rawPayload);

    assert.strictEqual(redacted.password, '[REDACTED_DPDP_PII]');
    assert.strictEqual(redacted.apiToken, '[REDACTED_DPDP_PII]');
    assert.strictEqual(redacted.aadhaarNumber, '[REDACTED_DPDP_PII]');
    assert.strictEqual(redacted.panNumber, '[REDACTED_DPDP_PII]');
    // Whitelisted last-four fields must remain intact
    assert.strictEqual(redacted.aadhaarLastFour, '9012');
    assert.strictEqual(redacted.panLastFour, '1234F');
    // Email and phone must be masked
    assert.strictEqual(redacted.phone, 'XXXXXX3210');
    assert.strictEqual(redacted.email.includes('****'), true);
  });
});
