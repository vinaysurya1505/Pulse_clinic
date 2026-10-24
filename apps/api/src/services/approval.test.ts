import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ApprovalCodeService } from './ApprovalCodeService';
import { OutboxWorker } from './OutboxWorker';

describe('Prompt 17 & 18: Approval Code & Outbox Encryption Engine', () => {
  it('generates an 8-character uppercase OTP conforming to ADR-015', () => {
    const otp = ApprovalCodeService.generateOTP();
    assert.strictEqual(otp.length, 8);
    assert.match(otp, /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
  });

  it('generates reproducible HMAC-SHA256 hashes for the same OTP and different hashes for different OTPs', () => {
    const otp = '8KLM39XZ';
    const hash1 = ApprovalCodeService.hashOTP(otp);
    const hash2 = ApprovalCodeService.hashOTP(otp);
    const hashDiff = ApprovalCodeService.hashOTP('8KLM39XY');

    assert.strictEqual(hash1, hash2);
    assert.notStrictEqual(hash1, hashDiff);
    assert.strictEqual(hash1.length, 64); // 32 bytes hex = 64 chars
  });

  it('performs constant-time verification with timingSafeEqualHex', () => {
    const hashA = ApprovalCodeService.hashOTP('TEST1234');
    const hashB = ApprovalCodeService.hashOTP('TEST1234');
    const hashC = ApprovalCodeService.hashOTP('WRONG123');

    assert.strictEqual(ApprovalCodeService.timingSafeEqualHex(hashA, hashB), true);
    assert.strictEqual(ApprovalCodeService.timingSafeEqualHex(hashA, hashC), false);
  });

  it('encrypts and decrypts outbox email payloads using AES-256-GCM (ADR-016)', () => {
    const payload = {
      to: 'admin@pulseclinic.in',
      subject: 'Approval Code for INV-202610-000001',
      body: 'Your authorization OTP is 9XYZ24AB. Valid for 15 minutes.',
    };

    const encrypted = OutboxWorker.encryptPayload(payload);
    assert.ok(encrypted.encryptedData.length > 0);
    assert.ok(encrypted.iv.length === 24); // 12 bytes = 24 hex chars
    assert.ok(encrypted.authTag.length === 32); // 16 bytes = 32 hex chars

    // Plaintext should NOT exist in encrypted payload
    assert.ok(!encrypted.encryptedData.includes('9XYZ24AB'));

    // Decrypt and assert exact match
    const decrypted = OutboxWorker.decryptPayload(encrypted.encryptedData, encrypted.iv, encrypted.authTag);
    assert.deepStrictEqual(decrypted, payload);
  });
});
