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
    const invoiceAmount = typeof invoiceData.netPayablePaise === 'number'
      ? (invoiceData.netPayablePaise / 100).toFixed(2)
      : undefined;
    const customerName = invoiceData.customer?.name || undefined;
    const storeName = 'New Sanjivani Multispeciality Clinic';

    const plainTextBody = this.buildApprovalPlainText({
      invoiceNumber,
      storeName,
      reason,
      requesterUid,
      plainOtp,
      invoiceAmount,
      customerName,
      isResend: false,
    });

    const htmlBody = this.buildApprovalEmailHtml({
      invoiceNumber,
      storeName,
      reason,
      requesterUid,
      plainOtp,
      invoiceAmount,
      customerName,
      isResend: false,
    });

    await OutboxWorker.enqueueEmail({
      to: adminEmail,
      subject: `[New Sanjivani Clinic] Refund Approval Code: ${plainOtp} (Invoice ${invoiceNumber})`,
      body: plainTextBody,
      html: htmlBody,
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

    const storeName = 'New Sanjivani Multispeciality Clinic';

    const plainTextBody = this.buildApprovalPlainText({
      invoiceNumber: data.invoiceNumber,
      storeName,
      reason: data.reason,
      requesterUid: data.requesterUid,
      plainOtp,
      isResend: true,
    });

    const htmlBody = this.buildApprovalEmailHtml({
      invoiceNumber: data.invoiceNumber,
      storeName,
      reason: data.reason,
      requesterUid: data.requesterUid,
      plainOtp,
      isResend: true,
    });

    const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@pulseclinic.in';
    await OutboxWorker.enqueueEmail({
      to: adminEmail,
      subject: `[New Sanjivani Clinic - RESEND] New Refund Approval Code: ${plainOtp} (Invoice ${data.invoiceNumber})`,
      body: plainTextBody,
      html: htmlBody,
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

  /**
   * Generates a modern, responsive HTML email template branded for New Sanjivani Clinic
   */
  static buildApprovalEmailHtml(params: {
    invoiceNumber: string;
    storeName: string;
    reason: string;
    requesterUid: string;
    plainOtp: string;
    invoiceAmount?: string;
    customerName?: string;
    isResend?: boolean;
  }): string {
    const {
      invoiceNumber,
      storeName,
      reason,
      requesterUid,
      plainOtp,
      invoiceAmount,
      customerName,
      isResend,
    } = params;

    const requestTime = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Refund Authorization - New Sanjivani Clinic</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 32px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08);" cellspacing="0" cellpadding="0">
          
          <!-- Clinic Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); padding: 28px 24px; text-align: center;">
              <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.15); border-radius: 50%; width: 44px; height: 44px; line-height: 44px; font-size: 22px; margin-bottom: 8px;">
                🏥
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: 0.02em;">
                New Sanjivani Multispeciality Clinic
              </h1>
              <p style="margin: 4px 0 0 0; color: #93c5fd; font-size: 13px; font-weight: 500;">
                Security &amp; Refund Authorization Gateway
              </p>
            </td>
          </tr>

          <!-- Action Alert Ribbon -->
          <tr>
            <td style="padding: 18px 24px 0 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${isResend ? '#fffbeb' : '#fef2f2'}; border-left: 4px solid ${isResend ? '#d97706' : '#ef4444'}; border-radius: 6px; padding: 12px 16px;">
                <tr>
                  <td>
                    <div style="font-weight: 700; font-size: 13px; color: ${isResend ? '#92400e' : '#991b1b'}; text-transform: uppercase; letter-spacing: 0.04em;">
                      ${isResend ? '🔄 Resent: Refund Authorization Code' : '⚠️ Action Required: Refund Authorization'}
                    </div>
                    <div style="font-size: 13px; color: #475569; margin-top: 2px;">
                      A counter operator is requesting authorization to cancel or refund an invoice.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Request Details Table -->
          <tr>
            <td style="padding: 18px 24px 10px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
                <tr>
                  <td colspan="2" style="padding: 10px 16px; background-color: #f1f5f9; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.05em;">
                    📋 Request Details
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 16px; font-size: 13px; color: #64748b; width: 40%; border-bottom: 1px solid #f1f5f9;">Invoice Number:</td>
                  <td style="padding: 10px 16px; font-size: 14px; font-weight: 700; color: #1e40af; border-bottom: 1px solid #f1f5f9;">
                    <span style="background-color: #dbeafe; padding: 2px 8px; border-radius: 4px; font-family: monospace;">${invoiceNumber}</span>
                  </td>
                </tr>
                ${invoiceAmount ? `
                <tr>
                  <td style="padding: 10px 16px; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Invoice Amount:</td>
                  <td style="padding: 10px 16px; font-size: 14px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f1f5f9;">₹${invoiceAmount}</td>
                </tr>` : ''}
                ${customerName ? `
                <tr>
                  <td style="padding: 10px 16px; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Customer:</td>
                  <td style="padding: 10px 16px; font-size: 13px; font-weight: 600; color: #334155; border-bottom: 1px solid #f1f5f9;">${customerName}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding: 10px 16px; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Store Location:</td>
                  <td style="padding: 10px 16px; font-size: 13px; color: #334155; font-weight: 600; border-bottom: 1px solid #f1f5f9;">${storeName}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 16px; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Refund Reason:</td>
                  <td style="padding: 10px 16px; font-size: 13px; color: #b91c1c; font-weight: 600; border-bottom: 1px solid #f1f5f9;">${reason}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 16px; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Requester UID:</td>
                  <td style="padding: 10px 16px; font-size: 12px; font-family: monospace; color: #475569; border-bottom: 1px solid #f1f5f9;">${requesterUid}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 16px; font-size: 13px; color: #64748b;">Request Time:</td>
                  <td style="padding: 10px 16px; font-size: 12px; color: #475569;">${requestTime}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero OTP Box -->
          <tr>
            <td style="padding: 10px 24px 18px 24px; text-align: center;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(180deg, #f0fdf4 0%, #ecfdf5 100%); border: 2px dashed #059669; border-radius: 14px; padding: 20px 16px; text-align: center;">
                <tr>
                  <td align="center">
                    <div style="font-size: 11px; font-weight: 800; color: #047857; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px;">
                      🔑 8-Character Authorization Code
                    </div>
                    <div style="display: inline-block; background-color: #ffffff; border: 1px solid #a7f3d0; border-radius: 10px; padding: 12px 28px; margin: 4px 0; box-shadow: 0 4px 6px -1px rgba(5, 150, 105, 0.1);">
                      <span style="font-family: 'SF Pro Mono', 'Cascadia Code', 'Fira Code', 'Courier New', monospace; font-size: 32px; font-weight: 800; color: #0f172a; letter-spacing: 6px;">
                        ${plainOtp}
                      </span>
                    </div>
                    <div style="margin-top: 10px; font-size: 12px; font-weight: 600; color: #dc2626;">
                      ⏱️ Valid for 15 minutes only &bull; Single-use code
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Security Instructions -->
          <tr>
            <td style="padding: 0 24px 22px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px;">
                <tr>
                  <td style="font-size: 13px; line-height: 1.5; color: #475569;">
                    <div style="font-weight: 700; color: #1e293b; margin-bottom: 6px;">
                      🔒 Verification Advisory:
                    </div>
                    <ul style="margin: 0; padding-left: 18px; color: #475569;">
                      <li style="margin-bottom: 4px;">Provide this authorization code to the store operator <strong>only after verifying</strong> the returned physical goods and invoice validity.</li>
                      <li style="margin-bottom: 4px;">Once entered in the terminal, this code is permanently invalidated.</li>
                      <li>If you did not authorize this action, do not share this code and check the store terminal immediately.</li>
                    </ul>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Clinic Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 22px 24px; text-align: center;">
              <div style="font-weight: 700; font-size: 13px; color: #1e293b; margin-bottom: 4px;">
                New Sanjivani Multispeciality Clinic
              </div>
              <div style="font-size: 11px; color: #64748b; line-height: 1.5; margin-bottom: 8px;">
                Beside Hero Bike Agency, In Front of Rajesh Mani Inter College,<br />
                Padrauna Road, Naurangia, Kushinagar 274305<br />
                <strong>Helpline:</strong> +91 8114000119 / +91 8004807785
              </div>
              <div style="font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 8px;">
                Automated administrative security dispatch &bull; New Sanjivani Clinic Pharmacy System
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  /**
   * Generates formatted plain text fallback for text-only email clients
   */
  static buildApprovalPlainText(params: {
    invoiceNumber: string;
    storeName: string;
    reason: string;
    requesterUid: string;
    plainOtp: string;
    invoiceAmount?: string;
    customerName?: string;
    isResend?: boolean;
  }): string {
    const {
      invoiceNumber,
      storeName,
      reason,
      requesterUid,
      plainOtp,
      invoiceAmount,
      customerName,
      isResend,
    } = params;

    return `============================================================
NEW SANJIVANI MULTISPECIALITY CLINIC
${isResend ? '[RESEND] ' : ''}Security & Refund Authorization Portal
============================================================

A refund/cancellation was requested for invoice: ${invoiceNumber}
Store Location: ${storeName}
Reason: ${reason}
Requester Staff UID: ${requesterUid}
${invoiceAmount ? `Invoice Amount: ₹${invoiceAmount}\n` : ''}${customerName ? `Customer: ${customerName}\n` : ''}
------------------------------------------------------------
YOUR 8-CHARACTER APPROVAL CODE:

    >>>  ${plainOtp}  <<<

Valid for 15 minutes only (Single-use code)
------------------------------------------------------------

SECURITY INSTRUCTIONS:
- Provide this code to the store operator ONLY after verifying the legitimacy of this refund and inspecting returned goods.
- If you did not authorize this request, please investigate the store terminal immediately.

New Sanjivani Multispeciality Clinic
Padrauna Road, Naurangia, Kushinagar 274305
Ph: +91 8114000119 / +91 8004807785
============================================================`;
  }
}
