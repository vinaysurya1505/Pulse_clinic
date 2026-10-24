import crypto from 'crypto';
import { getFirestore } from '../lib/firebase-admin';
import { COLLECTIONS, APP_CONFIG } from '@pulseclinic/config';
import { ApprovalRequest } from '@pulseclinic/types';
import { OutboxWorker } from './OutboxWorker';

const HMAC_SECRET = process.env.HMAC_SECRET || 'pulseclinic-hmac-otp-secret-key-2026';

export class ApprovalCodeService {
  /**
   * Generates a cryptographically strong 8-character uppercase OTP (ADR-015)
   */
  static generateOTP(): string {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude ambiguous chars (0, O, 1, I)
    let otp = '';
    const bytes = crypto.randomBytes(APP_CONFIG.approvalCode.length);
    for (let i = 0; i < APP_CONFIG.approvalCode.length; i++) {
      otp += chars[bytes[i] % chars.length];
    }
    return otp;
  }

  /**
   * Generates HMAC-SHA256 hash of the OTP (RSK-013)
   */
  static hashOTP(otp: string): string {
    return crypto
      .createHmac('sha256', HMAC_SECRET)
      .update(otp.trim().toUpperCase())
      .digest('hex');
  }

  /**
   * Compares two hex hashes in constant time to prevent timing attacks
   */
  static timingSafeEqualHex(aHex: string, bHex: string): boolean {
    const aBuf = Buffer.from(aHex, 'hex');
    const bBuf = Buffer.from(bHex, 'hex');
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
  }

  /**
   * Creates an approval request and dispatches an encrypted email to the admin (Prompt 17)
   */
  static async requestApproval(
    storeId: string,
    invoiceId: string,
    requesterUid: string,
    reason: string
  ): Promise<{ requestId: string; expiresAt: string; message: string }> {
    const db = getFirestore();
    const invoiceRef = db.collection(COLLECTIONS.invoices(storeId)).doc(invoiceId);
    const invoiceDoc = await invoiceRef.get();

    if (!invoiceDoc.exists) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    const invoiceData = invoiceDoc.data();
    if (invoiceData?.status !== 'FINALIZED') {
      throw new Error(`Cannot request refund for invoice with status "${invoiceData?.status}". Only FINALIZED bills can be refunded.`);
    }

    const invoiceNumber = invoiceData.invoiceNumber || invoiceId;
    const approvalCol = db.collection(COLLECTIONS.approvalRequests(storeId));
    const reqRef = approvalCol.doc();

    const plainOtp = this.generateOTP();
    const otpHash = this.hashOTP(plainOtp);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + APP_CONFIG.approvalCode.expiryMinutes * 60 * 1000).toISOString();
    const createdAt = now.toISOString();

    const requestRecord: ApprovalRequest = {
      id: reqRef.id,
      storeId,
      invoiceId,
      invoiceNumber,
      requesterUid,
      reason,
      otpHash,
      attempts: 0,
      maxAttempts: APP_CONFIG.approvalCode.maxAttempts,
      status: 'PENDING',
      expiresAt,
      createdAt,
      updatedAt: createdAt,
    };

    await reqRef.set(requestRecord);

    // Enqueue encrypted email to Super Admin / Owner outbox (ADR-016)
    // The plaintext OTP is ONLY sent in this outbox email and NEVER saved in Firestore or returned to requester
    const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@pulseclinic.in';
    await OutboxWorker.enqueueEmail({
      to: adminEmail,
      subject: `[PulseClinic Approval] Refund Authorization Code for Invoice ${invoiceNumber}`,
      body: `A refund/cancellation was requested for invoice ${invoiceNumber} at store ${storeId}.
Reason: ${reason}
Requester UID: ${requesterUid}

Your 8-character approval code is: ${plainOtp}

This code expires in 15 minutes. Provide this code to the store operator only after verifying the legitimacy of this refund.`,
      metadata: { storeId, invoiceId, requestId: reqRef.id },
    });

    // Also execute outbox worker to deliver dev notifications to log immediately
    try {
      await OutboxWorker.processOutbox(5);
    } catch {
      // Non-blocking in request lifecycle
    }

    return {
      requestId: reqRef.id,
      expiresAt,
      message: 'Approval request generated. 8-character authorization code has been dispatched to the administrator email.',
    };
  }

  /**
   * Resends / regenerates an approval code for an active request
   */
  static async resendApproval(
    storeId: string,
    requestId: string
  ): Promise<{ success: boolean; expiresAt: string; message: string }> {
    const db = getFirestore();
    const reqRef = db.collection(COLLECTIONS.approvalRequests(storeId)).doc(requestId);
    const doc = await reqRef.get();

    if (!doc.exists) {
      throw new Error(`Approval request ${requestId} not found`);
    }

    const data = doc.data() as ApprovalRequest;
    if (data.status === 'CONSUMED') {
      throw new Error('This approval request has already been consumed.');
    }

    const plainOtp = this.generateOTP();
    const otpHash = this.hashOTP(plainOtp);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + APP_CONFIG.approvalCode.expiryMinutes * 60 * 1000).toISOString();

    await reqRef.update({
      otpHash,
      attempts: 0,
      status: 'PENDING',
      expiresAt,
      updatedAt: now.toISOString(),
    });

    const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@pulseclinic.in';
    await OutboxWorker.enqueueEmail({
      to: adminEmail,
      subject: `[PulseClinic Approval RESEND] Refund Authorization Code for Invoice ${data.invoiceNumber}`,
      body: `A new approval code was requested for invoice ${data.invoiceNumber}.
Your new 8-character approval code is: ${plainOtp}

Expires in 15 minutes.`,
      metadata: { storeId, invoiceId: data.invoiceId, requestId },
    });

    try {
      await OutboxWorker.processOutbox(5);
    } catch {
      // Non-blocking
    }

    return {
      success: true,
      expiresAt,
      message: 'New approval authorization code dispatched to store administrator.',
    };
  }

  /**
   * Verifies and atomically consumes the approval code (Prompt 18, RSK-012)
   */
  static async verifyAndConsumeCode(
    t: FirebaseFirestore.Transaction,
    storeId: string,
    requestId: string,
    providedCode: string
  ): Promise<ApprovalRequest> {
    const db = getFirestore();
    const reqRef = db.collection(COLLECTIONS.approvalRequests(storeId)).doc(requestId);
    const reqDoc = await t.get(reqRef);

    if (!reqDoc.exists) {
      throw new Error(`Approval request ${requestId} not found`);
    }

    const reqData = reqDoc.data() as ApprovalRequest;

    if (reqData.status === 'CONSUMED') {
      throw new Error('Approval request has already been used.');
    }
    if (reqData.status === 'EXPIRED_MAX_ATTEMPTS') {
      throw new Error('Approval code locked due to exceeding maximum incorrect attempts (3 of 3). Please request a new code.');
    }
    if (reqData.status === 'EXPIRED') {
      throw new Error('Approval code has expired. Please request a new code.');
    }

    const now = new Date();
    if (new Date(reqData.expiresAt).getTime() < now.getTime()) {
      t.update(reqRef, { status: 'EXPIRED', updatedAt: now.toISOString() });
      throw new Error('Approval code has expired (15-minute validity window elapsed).');
    }

    const providedHash = this.hashOTP(providedCode);
    const isMatch = this.timingSafeEqualHex(reqData.otpHash, providedHash);

    if (!isMatch) {
      const nextAttempts = (reqData.attempts || 0) + 1;
      const isLocked = nextAttempts >= reqData.maxAttempts;

      t.update(reqRef, {
        attempts: nextAttempts,
        status: isLocked ? 'EXPIRED_MAX_ATTEMPTS' : 'PENDING',
        updatedAt: now.toISOString(),
      });

      if (isLocked) {
        throw new Error('Maximum incorrect verification attempts (3 of 3) exceeded. This approval code is now locked.');
      } else {
        throw new Error(`Invalid approval authorization code. Attempt ${nextAttempts} of ${reqData.maxAttempts}.`);
      }
    }

    // Success: Consume code
    t.update(reqRef, {
      status: 'CONSUMED',
      consumedAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    return reqData;
  }
}
